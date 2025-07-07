---
title: Spring Security快速上手
published: 2025-05-20
description: 由于Spring Security可配置内容较为复杂，初学者直接上手使用可能会感觉无从下手。本文将直接从快速应用的角度出发，介绍如何使用Spring Security的基本功能
image: ./assets/cover.png
tags: [Spring]
category: 学习笔记
draft: false
---

# 1. 基本介绍

[Spring Security](https://spring.io/projects/spring-security) 是一个功能强大且高度可定制的 **安全框架** ，用于为基于 Java 的企业级应用程序提供身份认证（Authentication）、授权（Authorization）以及防护常见的 Web 安全威胁的功能。

它是 Spring 框架的一部分，可以无缝集成到 Spring 应用中，比如 Spring Boot、Spring MVC 等项目中。同时它也支持非 Spring 项目（如原生的 Servlet 应用）。



## 1.1 核心功能

1. **身份认证（Authentication）**
   - 验证用户是谁，例如通过用户名和密码登录。
   - 支持多种认证方式：表单登录、HTTP Basic、OAuth2、JWT、LDAP、SAML 等。
2. **权限控制（Authorization）**
   - 控制用户能访问哪些资源或操作。
   - 可以在方法级别或 URL 层面对请求进行限制。
   - 支持角色（Role）和权限（Authority）机制。
3. **防止常见攻击**
   - CSRF（跨站请求伪造）
   - XSS（跨站脚本攻击）
   - Session 固定保护
   - Clickjacking 保护等
4. **安全上下文管理**
   - 使用 `SecurityContextHolder` 来保存当前用户的认证信息。
   - 提供 `Authentication` 和 `UserDetails` 接口来表示用户信息。
5. **支持多种认证源**
   - 内存中的用户数据库（适合测试）
   - JDBC 数据库认证
   - LDAP 认证
   - 自定义 UserDetailsService 实现
   - 第三方 OAuth2 / OpenID Connect 登录（如 Google、GitHub）
6. **集成现代认证协议**
   - OAuth2（Open Authorization）
   - JWT（JSON Web Token）
   - SAML（Security Assertion Markup Language）



## 1.2 核心组件

| 组件                    | 功能                             |
| ----------------------- | -------------------------------- |
| `SecurityFilterChain`   | 过滤器链，处理所有进入的安全请求 |
| `AuthenticationManager` | 负责认证流程的核心接口           |
| `UserDetailsService`    | 加载用户详细信息的接口           |
| `PasswordEncoder`       | 密码加密与验证工具               |
| `GrantedAuthority`      | 用户拥有的权限                   |
| `SecurityContext`       | 存储当前用户的认证信息           |
| `AccessDecisionManager` | 决定用户是否有权访问某个资源     |



## 1.3 使用场景

- 后台管理系统：对不同角色用户设置不同的访问权限。
- REST API 安全：使用 JWT 或 OAuth2 对接口进行保护。
- 单点登录（SSO）：结合 OAuth2 或 SAML 实现多系统统一登录。
- 微服务安全架构：结合 Spring Cloud Gateway + OAuth2 + JWT 实现网关鉴权。
- 多租户系统：根据不同租户隔离用户权限。



## 1.4 引入依赖

本文将基于`Spring Boot`进行介绍，因此只需引入启动类依赖即可

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-security</artifactId>
</dependency>
```



# 2. 用户信息

