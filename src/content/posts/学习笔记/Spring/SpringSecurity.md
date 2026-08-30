---
title: Spring Security 快速上手
published: 2025-05-20
description: 从一次请求的处理过程出发，理解 Spring Security 的认证、授权、会话与常见安全配置
image: ./assets/cover.png
tags: [Spring, 安全认证]
category: 学习笔记
draft: false
---

Spring Security 的配置项很多，但刚开始并不需要把每个过滤器都背下来。先抓住两个问题就够了：当前请求是谁发出的，以及这个人能不能访问目标资源。

这篇笔记使用 Spring Boot 3.4.x、Spring Security 6.4.x 和 JDK 17，讨论的是基于 Servlet 的 Spring MVC 应用。WebFlux 使用的是 `SecurityWebFilterChain`，配置方式并不相同。

# 1. Spring Security 在做什么

[Spring Security](https://spring.io/projects/spring-security) 主要处理三类事情：认证用户身份、判断访问权限，以及提供 CSRF、防会话固定攻击、安全响应头等 Web 安全能力。

认证（Authentication）回答“你是谁”，授权（Authorization）回答“你能做什么”。登录成功只说明身份已经确认，并不代表用户可以访问所有接口。

在 Servlet 应用里，可以先把 Spring Security 理解成放在 `DispatcherServlet` 前面的一组过滤器。请求到达 Controller 之前，会依次经过认证、异常处理和授权等过滤器；其中任意一步拒绝请求，后面的业务代码就不会执行。

常见组件之间的关系如下：

| 组件 | 作用 |
| --- | --- |
| `SecurityFilterChain` | 定义哪些请求进入这条安全过滤器链，以及链中启用哪些安全功能 |
| `Authentication` | 保存当前主体、凭据、权限和认证状态 |
| `AuthenticationManager` | 接收认证请求，并把它交给合适的 `AuthenticationProvider` |
| `DaoAuthenticationProvider` | 处理常见的用户名、密码认证 |
| `UserDetailsService` | 按用户名读取用户资料 |
| `PasswordEncoder` | 对密码做单向编码，并在登录时校验密码 |
| `GrantedAuthority` | 表示用户拥有的一项角色或权限 |
| `SecurityContext` | 保存当前请求对应的 `Authentication` |
| `AuthorizationManager` | 根据当前用户和访问规则作出授权决定 |

Spring Security 6 已不再使用继承 `WebSecurityConfigurerAdapter` 的配置方式。现在通常直接声明一个或多个 `SecurityFilterChain` Bean。

# 2. 跑起最小示例

## 2.1 引入依赖

Spring Boot 项目只需要加入 Starter，具体版本交给 Spring Boot 的依赖管理处理：

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```

依赖加入后，即使一行配置都没写，应用也已经被保护起来了。Spring Boot 会创建用户名为 `user` 的临时用户，并在启动日志中输出随机密码；访问任意接口时，浏览器会跳到默认登录页。

这套默认行为适合确认依赖是否生效，不适合直接拿来开发业务。下面先准备三个接口，分别测试公开访问、登录访问和管理员访问。

```java
@RestController
@RequestMapping("/demo")
public class DemoController {

    @GetMapping("/public")
    public String publicEndpoint() {
        return "public";
    }

    @GetMapping("/profile")
    public String profile() {
        return "profile";
    }

    @GetMapping("/admin")
    public String admin() {
        return "admin";
    }
}
```

## 2.2 配置过滤器链

下面的配置创建了两个内存用户。密码写在代码里只为了演示，真实项目应从数据库或外部身份服务读取用户信息。

```java
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers("/demo/public", "/error").permitAll()
                        .requestMatchers("/demo/admin").hasRole("ADMIN")
                        .anyRequest().authenticated()
                )
                .formLogin(Customizer.withDefaults())
                .logout(Customizer.withDefaults())
                .build();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    UserDetailsService userDetailsService(PasswordEncoder passwordEncoder) {
        UserDetails reader = User.withUsername("reader")
                .password(passwordEncoder.encode("read123"))
                .roles("USER")
                .build();

        UserDetails admin = User.withUsername("admin")
                .password(passwordEncoder.encode("admin123"))
                .roles("ADMIN")
                .build();

        return new InMemoryUserDetailsManager(reader, admin);
    }
}
```

启动应用后，三个接口的结果应当是：

| 请求 | 结果 |
| --- | --- |
| `GET /demo/public` | 无需登录 |
| `GET /demo/profile` | `reader` 和 `admin` 都能访问 |
| `GET /demo/admin` | 只有 `admin` 能访问 |

`requestMatchers` 按声明顺序匹配，命中第一条规则后就不再继续。具体路径要放在前面，兜底的 `anyRequest()` 放在最后，否则后面的规则永远没有机会生效。

# 3. 一次登录经过了什么

表单登录提交用户名和密码后，大致会经过下面这条调用链：

```text
请求
  → SecurityFilterChain
  → UsernamePasswordAuthenticationFilter
  → AuthenticationManager（通常是 ProviderManager）
  → DaoAuthenticationProvider
  → UserDetailsService 查询用户
  → PasswordEncoder 校验密码
  → 生成已认证的 Authentication
  → 写入 SecurityContext
  → 执行授权判断
```

`UsernamePasswordAuthenticationFilter` 先把表单中的用户名和密码封装成一个尚未认证的 `Authentication`。`ProviderManager` 找到能处理它的 `DaoAuthenticationProvider`，随后读取用户资料并比对密码。

认证成功后，框架会得到一个新的 `Authentication`，里面包含用户名和权限。表单登录默认把对应的安全上下文保存到 HTTP Session，后续请求带上同一个 Session Cookie，就不必再次提交密码。

在当前请求里，业务代码可以直接注入认证信息：

```java
@GetMapping("/me")
public Map<String, Object> currentUser(Authentication authentication) {
    return Map.of(
            "username", authentication.getName(),
            "authorities", authentication.getAuthorities()
    );
}
```

如果只需要用户主体，也可以使用 `@AuthenticationPrincipal UserDetails userDetails`。这比业务代码到处调用 `SecurityContextHolder` 更容易测试。

# 4. 从数据库读取用户

内存用户只适合示例和少量内部工具。接入数据库时，Spring Security 并不要求使用某一种 ORM，也不关心用户表怎么设计；它只要求项目提供一个 `UserDetailsService`。

假设 `AccountRepository` 能按用户名查询账户，可以这样完成转换：

```java
@Service
public class DatabaseUserDetailsService implements UserDetailsService {

    private final AccountRepository accountRepository;

    public DatabaseUserDetailsService(AccountRepository accountRepository) {
        this.accountRepository = accountRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) {
        Account account = accountRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在"));

        String[] authorities = account.getPermissions().stream()
                .map(Permission::getCode)
                .toArray(String[]::new);

        return User.withUsername(account.getUsername())
                .password(account.getPassword())
                .authorities(authorities)
                .disabled(!account.isEnabled())
                .build();
    }
}
```

数据库中的 `password` 必须保存 `PasswordEncoder#encode` 生成的结果，而不是明文，也不要在登录时把用户输入先编码后再比较。带随机盐的算法每次编码结果可能不同，校验应该交给 `PasswordEncoder#matches`，Spring Security 会替我们调用它。

创建用户时可以这样处理密码：

```java
account.setPassword(passwordEncoder.encode(command.password()));
accountRepository.save(account);
```

项目中只有一种用户名、密码认证方式时，提供 `UserDetailsService` 和 `PasswordEncoder` Bean 通常就够了。如果还要接入短信验证码、LDAP 或其他凭据，再实现对应的 `AuthenticationProvider`，不要把所有认证分支塞进 `UserDetailsService`。

# 5. 角色和权限

`GrantedAuthority` 只是一个字符串，Spring Security 不会替项目规定权限模型。角色和细粒度权限最终都通过这个接口表示，区别主要在命名约定。

```java
User.withUsername("admin")
        .password(encodedPassword)
        .authorities("ROLE_ADMIN", "article:read", "article:write")
        .build();
```

`roles("ADMIN")` 会自动生成 `ROLE_ADMIN`。因此 `hasRole("ADMIN")` 实际检查的是 `ROLE_ADMIN`，而 `hasAuthority("article:read")` 会按原字符串检查，不会添加前缀。

## 5.1 在请求层授权

请求规则既可以匹配路径，也可以区分 HTTP 方法：

```java
.authorizeHttpRequests(authorize -> authorize
        .requestMatchers("/", "/login", "/assets/**").permitAll()
        .requestMatchers(HttpMethod.GET, "/articles/**")
                .hasAuthority("article:read")
        .requestMatchers(HttpMethod.POST, "/articles/**")
                .hasAuthority("article:write")
        .requestMatchers("/admin/**").hasRole("ADMIN")
        .anyRequest().authenticated()
)
```

公开资源也建议使用 `permitAll()`，而不是直接让它们绕过 Spring Security。这样安全响应头等功能仍会执行，规则也集中在同一个地方。

## 5.2 在方法层授权

请求路径只能保护入口，有些规则更适合放在业务方法上。例如删除文章无论从哪个 Controller 进入，都要求同一项权限。

```java
@Service
public class ArticleService {

    @PreAuthorize("hasAuthority('article:delete')")
    public void delete(long articleId) {
        // 删除文章
    }
}
```

方法授权需要通过 `@EnableMethodSecurity` 开启。URL 规则负责挡住明显不该进入的请求，方法规则负责贴近业务约束，两者解决的问题不同。

# 6. 401、403 和异常响应

这两个状态码很容易混在一起：

| 状态码 | 含义 | 常见原因 |
| --- | --- | --- |
| `401 Unauthorized` | 请求尚未通过认证 | 没有登录、凭据缺失或凭据无效 |
| `403 Forbidden` | 身份已经确认，但权限不足 | 缺少角色或权限，也可能是 CSRF 校验失败 |

表单登录面向浏览器，未认证时通常跳转到登录页。REST API 更常见的做法是返回 401 或 403，再由前端决定如何展示。

```java
.exceptionHandling(exceptions -> exceptions
        .authenticationEntryPoint((request, response, exception) ->
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED))
        .accessDeniedHandler((request, response, exception) ->
                response.sendError(HttpServletResponse.SC_FORBIDDEN))
)
```

如果同一个项目既提供网页又提供 API，可以声明两条 `SecurityFilterChain`，用 `securityMatcher` 分开处理。只有第一条匹配请求的过滤器链会执行，所以更具体的链需要更高的顺序。

# 7. CSRF、CORS 和会话

这三个概念经常一起出现在配置里，但它们处理的不是同一个问题

## 7.1 不要看到 403 就关闭 CSRF

Spring Security 默认开启 CSRF 防护。只要浏览器会自动携带 Session Cookie 或其他认证 Cookie，服务端就应认真处理 CSRF；传统表单需要随请求提交 CSRF Token。

如果只有某个回调接口无法提供 Token，可以只忽略对应路径：

```java
.csrf(csrf -> csrf
        .ignoringRequestMatchers("/webhooks/payment")
)
```

仅当 API 使用 `Authorization: Bearer ...` 传递令牌、服务端不创建登录会话，并且浏览器不会自动附带认证凭据时，才适合考虑关闭 CSRF。把 JWT 放进 Cookie 后，这个前提就不成立了。

```java
.sessionManagement(session -> session
        .sessionCreationPolicy(SessionCreationPolicy.STATELESS)
)
.csrf(csrf -> csrf.disable())
```

## 7.2 CORS 不是权限校验

CORS 决定浏览器是否允许前端页面跨域读取响应，它不会替服务端验证用户权限。预检请求应在认证之前处理，Spring Security 可以直接复用 Spring MVC 的 CORS 配置。

```java
.cors(Customizer.withDefaults())
```

允许携带 Cookie 时，不要把允许来源写成 `*`。应该列出实际的前端域名，并限制允许的方法与请求头。

## 7.3 Session 和 JWT 怎么选

普通后台和服务端渲染页面使用 Session 往往更省事，注销、并发会话和服务端失效都比较直观。跨服务 API 或资源服务器可能更适合 Bearer Token，但无状态并不会自动让系统更安全，密钥管理、过期、刷新和撤销都需要单独设计。

Spring Security 本身可以校验 JWT，但不必每个项目都手写解析过滤器。能使用 OAuth2 Resource Server 时，优先复用框架已有的 Bearer Token 处理链；完整的登录与动态权限示例可继续阅读[Spring Security 结合 JWT 实现用户登录与动态权限](/posts/编程实践/springsecurity实战/)。

# 8. 写几条安全测试

安全规则靠浏览器点几次很难覆盖完整。项目可以加入 `spring-security-test`，在 MockMvc 测试中构造不同用户。

```xml
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-test</artifactId>
    <scope>test</scope>
</dependency>
```

```java
@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void publicEndpointAllowsAnonymousUser() throws Exception {
        mockMvc.perform(get("/demo/public"))
                .andExpect(status().isOk());
    }

    @Test
    void profileRedirectsAnonymousUserToLoginPage() throws Exception {
        mockMvc.perform(get("/demo/profile"))
                .andExpect(status().is3xxRedirection());
    }

    @Test
    @WithMockUser(roles = "USER")
    void regularUserCannotVisitAdminEndpoint() throws Exception {
        mockMvc.perform(get("/demo/admin"))
                .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(roles = "ADMIN")
    void adminCanVisitAdminEndpoint() throws Exception {
        mockMvc.perform(get("/demo/admin"))
                .andExpect(status().isOk());
    }
}
```

对 `POST`、`PUT`、`PATCH` 和 `DELETE` 等请求测试时，如果应用保留了 CSRF 防护，需要使用 `with(csrf())` 加入有效 Token。还应保留一条不带 Token 的测试，确认请求确实会被拒绝。

# 9. 常见排查方向

遇到登录或权限问题时，我一般先看状态码，再沿着请求链往回查：

- 登录后仍然返回 403：检查用户实际拥有的 `GrantedAuthority`，以及 `hasRole` 带来的 `ROLE_` 前缀
- 所有请求都落到同一条规则：检查 `requestMatchers` 的声明顺序，并确认 `anyRequest()` 位于最后
- 密码始终不匹配：确认注册和登录使用同一个 `PasswordEncoder`，数据库保存的是完整编码结果
- POST 能进入 Controller 前却返回 403：先检查 CSRF Token，不要直接关闭 CSRF
- 自定义过滤器执行两次：确认它没有同时被 Servlet 容器和 `SecurityFilterChain` 注册
- 多条过滤器链行为不对：检查 `@Order` 与 `securityMatcher`，一个请求只会使用第一条匹配的链

开发环境可以临时打开安全日志：

```yaml
logging:
  level:
    org.springframework.security: TRACE
```

TRACE 日志会列出当前请求经过的过滤器和授权结果，信息量很大，定位完成后应当关掉，不要长期用于生产环境。

# 10. 参考资料

- [Spring Security Servlet 架构](https://docs.spring.io/spring-security/reference/servlet/architecture.html)
- [用户名与密码认证](https://docs.spring.io/spring-security/reference/servlet/authentication/passwords/)
- [HTTP 请求授权](https://docs.spring.io/spring-security/reference/servlet/authorization/authorize-http-requests.html)
- [方法级授权](https://docs.spring.io/spring-security/reference/servlet/authorization/method-security.html)
- [CSRF 防护](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html)
- [MockMvc 测试支持](https://docs.spring.io/spring-security/reference/servlet/test/mockmvc/index.html)
