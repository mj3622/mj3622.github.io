---
title: Swagger2常用注解
published: 2025-04-17
description: Swagger是一套用于描述和文档化RESTful API的规范，通过注解可以方便地生成API文档。本文将介绍其在Java开发中的常用注解，以便开发时使用。
tags: [Web]
category: 编程实践
draft: false
---

## 1. 类级别注解

### @Api

- 描述：用于标注Controller类，表示这是一个Swagger资源
- 常用参数：
  - `tags`: API分组标签
  - `value`: API描述(已过时，建议使用description)
  - `description`: API详细描述
  - `produces`: 指定返回的内容类型
  - `consumes`: 指定接收的内容类型

```java
@Api(tags = "用户管理", description = "用户相关操作接口")
@RestController
@RequestMapping("/users")
public class UserController {
    // ...
}
```

## 2. 方法级别注解

### @ApiOperation

- 描述：描述一个API操作
- 常用参数：
  - `value`: 简要描述
  - `notes`: 详细说明
  - `response`: 返回类型
  - `httpMethod`: HTTP方法类型
  - `produces`: 输出MIME类型
  - `consumes`: 输入MIME类型

```java
@ApiOperation(value = "创建用户", notes = "根据User对象创建用户")
@PostMapping
public User createUser(@RequestBody User user) {
    // ...
}
```

### @ApiResponses 和 @ApiResponse

- 描述：描述方法返回值的状态码和说明
- 常用参数：
  - `code`: HTTP状态码
  - `message`: 描述信息
  - `response`: 返回类型

```java
@ApiResponses({
    @ApiResponse(code = 200, message = "成功", response = User.class),
    @ApiResponse(code = 400, message = "无效的用户输入"),
    @ApiResponse(code = 500, message = "服务器内部错误")
})
@GetMapping("/{id}")
public User getUser(@PathVariable Long id) {
    // ...
}
```

## 3. 参数级别注解

### @ApiParam

- 描述：描述单个参数
- 常用参数：
  - `name`: 参数名称
  - `value`: 参数说明
  - `required`: 是否必填
  - `example`: 示例值

```java
@GetMapping("/{id}")
public User getUser(
    @ApiParam(name = "id", value = "用户ID", required = true, example = "1") 
    @PathVariable Long id) {
    // ...
}
```

### @ApiImplicitParams 和 @ApiImplicitParam

- 描述：描述非JAX-RS标准的参数(如header参数)
- 常用参数：
  - `name`: 参数名称
  - `value`: 参数说明
  - `required`: 是否必填
  - `dataType`: 数据类型
  - `paramType`: 参数类型(query/path/header/body/form)

```java
@ApiImplicitParams({
    @ApiImplicitParam(name = "token", value = "认证token", required = true, dataType = "string", paramType = "header")
})
@GetMapping("/info")
public UserInfo getUserInfo() {
    // ...
}
```

## 4. 模型注解

### @ApiModel

- 描述：描述模型类
- 常用参数：
  - `value`: 模型名称
  - `description`: 模型描述

```java
@ApiModel(value = "用户实体", description = "用户信息描述")
public class User {
    // ...
}
```

### @ApiModelProperty

- 描述：描述模型属性
- 常用参数：
  - `value`: 字段说明
  - `example`: 示例值
  - `required`: 是否必填
  - `hidden`: 是否隐藏

```java
@ApiModelProperty(value = "用户名", example = "admin", required = true)
private String username;

@ApiModelProperty(value = "密码", hidden = true)
private String password;
```

## 5. 其他注解

### @ApiIgnore

- 描述：忽略某个元素，不生成文档
- 可用于类、方法或参数上

```java
@ApiIgnore
public void someHelperMethod() {
    // 这个方法不会出现在API文档中
}
```



## 配置示例

完整的Swagger配置类示例：

```java
@Configuration
@EnableSwagger2
public class SwaggerConfig {
    @Bean
    public Docket api() {
        return new Docket(DocumentationType.SWAGGER_2)
            .select()
            .apis(RequestHandlerSelectors.basePackage("com.example.controller"))
            .paths(PathSelectors.any())
            .build()
            .apiInfo(apiInfo());
    }

    private ApiInfo apiInfo() {
        return new ApiInfoBuilder()
            .title("API文档")
            .description("系统API接口文档")
            .version("1.0")
            .build();
    }
}
```