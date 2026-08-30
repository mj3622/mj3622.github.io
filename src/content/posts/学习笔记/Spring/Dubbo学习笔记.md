---
title: Dubbo 2.6.x 学习笔记：从一次 RPC 调用到故障定位
published: 2026-07-19
description: 以 Dubbo 2.6.x 为基准，从 XML 与注解配置、服务暴露和发现出发，逐步理解调用链、治理参数、No Provider 与网络故障排查。
tags: [Java, Dubbo, RPC, 微服务]
category: 学习笔记
draft: false
---

Dubbo 最容易被理解成“像调用本地方法一样调用远程服务”的工具，但如果只停留在注解怎么写、XML 怎么配，遇到 `No provider available`、调用超时或者“注册中心明明有地址却连不上”时，仍然很难判断问题出在哪里。

这篇笔记以 **Dubbo 2.6.x** 的经典架构为基准，沿着一条由浅入深的主线展开：先让一对 Provider 和 Consumer 跑起来，再追踪 Provider 如何监听和注册、Consumer 如何订阅和直连，随后把配置规则、No Provider 故障、源码调用链和网络排障串成一套完整认知。

> Dubbo 2.6.x 已停止维护，实际生产环境应评估升级。本文选择它，是为了理解仍然广泛存在于旧项目中的 `com.alibaba.dubbo.*` 包名、接口级服务发现、Dubbo 协议和 Spring XML 配置。示例与源码类名按 2.6.x 编写，并以 2.6.12 源码进行核对；不同补丁版本存在细节差异时，应以项目实际依赖为准。

## 一、先从一次远程方法调用说起

RPC 是 Remote Procedure Call，即远程过程调用。它希望把网络请求包装成接近本地方法调用的形式，让业务代码面向 Java 接口编程。

例如 Consumer 写下：

```java
String message = greetingService.sayHello("Dubbo");
```

代码看起来只调用了一个普通接口，实际却经过了更多步骤：

```text
Consumer 调用接口代理
  → 从候选 Provider 中选择一台
  → 序列化接口名、方法名和参数
  → 通过网络发送请求
  → Provider 反序列化并执行实现类方法
  → 序列化返回值
  → Consumer 收到并还原结果
```

Dubbo 负责把动态代理、协议编解码、网络传输、服务发现、负载均衡和失败处理组织起来。业务代码看到的是 Java 接口，框架内部处理的则是一次跨进程调用。

### 先认识经典架构中的角色

Dubbo 2.6.x 的经典架构主要包含以下角色：

- **Provider**：实现并暴露服务，在自己的进程中监听 RPC 端口。
- **Consumer**：引用服务接口，获得代理对象并发起远程调用。
- **Registry**：保存 Provider 地址，接受 Consumer 订阅并推送地址变化。
- **Monitor**：统计调用次数、耗时和异常等数据，是可选组件。
- **Container**：承载并启动 Provider 的运行容器，例如 Spring Container。

在这套模型里，注册中心最重要的职责是**地址协调**。它既不保存业务实现，也不替 Provider 执行方法，更不会默认转发每一次 RPC 请求。

可以先把整个系统分成两条链路：

```text
                             注册与订阅
Provider  ───────────────→  Registry  ───────────────→  Consumer
    ↑                                                       │
    └────────────── RPC 请求与响应（直接连接）───────────────┘
```

- 上半部分是服务注册、订阅和通知，可以理解为控制链路。
- 下半部分是真正承载业务数据的 RPC 链路。

这个区别将贯穿后文：`No provider available` 通常说明地址发现或筛选出了问题；连接拒绝、连接超时则更接近监听与网络问题。

## 二、搭建最小模型：一份接口，两种配置方式

一个便于学习的工程可以拆成三个模块：

```text
dubbo-demo
├── dubbo-api       # 共享接口和 DTO
├── dubbo-provider  # 服务实现与暴露配置
└── dubbo-consumer  # 服务引用与调用代码
```

Provider 和 Consumer 都依赖 `dubbo-api`，但 API 模块不应依赖实现模块。它只负责定义稳定的调用契约。

2.6.x 使用旧 Maven 坐标和旧包名。项目应锁定一个确定的补丁版本，不要把字面量 `2.6.x` 写进 POM；下面以 2.6.12 为例：

```xml
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>dubbo</artifactId>
    <version>2.6.12</version>
</dependency>
```

ZooKeeper 客户端和 Spring 的具体依赖需要根据现有工程统一管理。这里不额外指定版本，避免与旧项目已经锁定的依赖树冲突。

### 定义共享接口

```java
package com.example.api;

public interface GreetingService {
    String sayHello(String name);
}
```

如果接口使用自定义 DTO，Dubbo 2.6.x 的默认 Dubbo 协议会使用 Hessian2 序列化。为了兼容旧项目的常规用法，DTO 通常实现 `Serializable`，并保持 Provider、Consumer 两端的字段结构兼容。

### 先用 XML 跑通 Provider

在 Dubbo 2.6.x 项目中，Spring XML 是最经典、也最容易看清完整配置关系的方式。服务实现只是普通 Java 类：

```java
package com.example.provider;

import com.example.api.GreetingService;

public class GreetingServiceImpl implements GreetingService {

    @Override
    public String sayHello(String name) {
        return "Hello, " + name;
    }
}
```

Provider 的 `dubbo-provider.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:dubbo="http://dubbo.apache.org/schema/dubbo"
       xsi:schemaLocation="
           http://www.springframework.org/schema/beans
           http://www.springframework.org/schema/beans/spring-beans.xsd
           http://dubbo.apache.org/schema/dubbo
           http://dubbo.apache.org/schema/dubbo/dubbo.xsd">

    <dubbo:application name="greeting-provider"/>
    <dubbo:registry address="zookeeper://127.0.0.1:2181"/>
    <dubbo:protocol name="dubbo"
                    port="20880"
                    serialization="hessian2"/>

    <bean id="greetingService"
          class="com.example.provider.GreetingServiceImpl"/>

    <dubbo:service interface="com.example.api.GreetingService"
                   ref="greetingService"/>
</beans>
```

2.6.x 同时兼容旧的 `http://code.alibabatech.com/schema/dubbo` 命名空间；这里使用 2.6.12 源码示例采用的 Apache 命名空间。不要混用两套命名空间和 XSD 地址。

本文默认 Provider 和 Consumer 都运行在已有的 Spring Web 容器中。Provider Web 应用可以在根 Spring 配置 `applicationContext.xml` 中导入 Dubbo 配置：

```xml
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xsi:schemaLocation="
           http://www.springframework.org/schema/beans
           http://www.springframework.org/schema/beans/spring-beans.xsd">

    <import resource="classpath:dubbo-provider.xml"/>
</beans>
```

传统 Spring Web 项目通常已经通过 `web.xml` 创建根容器；如果尚未配置，核心内容如下：

```xml
<context-param>
    <param-name>contextConfigLocation</param-name>
    <param-value>classpath:applicationContext.xml</param-value>
</context-param>

<listener>
    <listener-class>
        org.springframework.web.context.ContextLoaderListener
    </listener-class>
</listener>
```

Tomcat 启动 Web 应用时，`ContextLoaderListener` 会创建根 `ApplicationContext`，随后通过 `<import>` 加载 `dubbo-provider.xml`。Dubbo 服务的暴露和销毁因此与 Web 应用生命周期保持一致，不需要额外编写 Dubbo 启动代码。

这里的四项配置分别回答了四个问题：

- `application`：这个 Dubbo 应用叫什么。
- `registry`：服务地址注册到哪里。
- `protocol`：Provider 用什么协议、在哪个端口接收请求。
- `service`：哪个 Java 接口由哪个 Spring Bean 实现。

### 再用 XML 引用服务

Consumer 的 `dubbo-consumer.xml`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<beans xmlns="http://www.springframework.org/schema/beans"
       xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
       xmlns:dubbo="http://dubbo.apache.org/schema/dubbo"
       xsi:schemaLocation="
           http://www.springframework.org/schema/beans
           http://www.springframework.org/schema/beans/spring-beans.xsd
           http://dubbo.apache.org/schema/dubbo
           http://dubbo.apache.org/schema/dubbo/dubbo.xsd">

    <dubbo:application name="greeting-consumer"/>
    <dubbo:registry address="zookeeper://127.0.0.1:2181"/>

    <dubbo:reference id="greetingService"
                     interface="com.example.api.GreetingService"
                     timeout="3000"/>
</beans>
```

Consumer Web 应用同样在自己的根配置 `applicationContext.xml` 中导入：

```xml
<import resource="classpath:dubbo-consumer.xml"/>
```

`<dubbo:reference>` 创建的是一个实现了 `GreetingService` 的远程代理，同时也是 Spring Bean，可以直接注入 Controller 或其他业务 Bean：

```java
package com.example.consumer;

import com.example.api.GreetingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class GreetingController {

    @Autowired
    private GreetingService greetingService;

    @RequestMapping(value = "/greeting", method = RequestMethod.GET)
    public String greeting(@RequestParam("name") String name) {
        return greetingService.sayHello(name);
    }
}
```

业务代码调用的仍然是代理。代理会把接口方法转换为 Dubbo 的 `Invocation`，再进入服务发现、路由、负载均衡和协议调用链。Dubbo 配置应复用项目已有的根 Spring 容器，不要为了加载它再创建第二个 `ApplicationContext`，否则容易造成 Bean 不互通、重复发布和生命周期不一致。

### 将同一个示例改成注解方式

Dubbo 2.6.x 的注解不是新版本的 `@DubboService` 和 `@DubboReference`，而是：

```java
com.alibaba.dubbo.config.annotation.Service
com.alibaba.dubbo.config.annotation.Reference
```

Provider 实现类可以改成：

```java
package com.example.provider;

import com.alibaba.dubbo.config.annotation.Service;
import com.example.api.GreetingService;

@Service
public class GreetingServiceImpl implements GreetingService {

    @Override
    public String sayHello(String name) {
        return "Hello, " + name;
    }
}
```

XML 中保留应用、注册中心和协议配置，再开启 Dubbo 注解扫描：

```xml
<dubbo:application name="greeting-provider"/>
<dubbo:registry address="zookeeper://127.0.0.1:2181"/>
<dubbo:protocol name="dubbo" port="20880" serialization="hessian2"/>
<dubbo:annotation package="com.example.provider"/>
```

Consumer 中使用 `@Reference`：

```java
package com.example.consumer;

import com.alibaba.dubbo.config.annotation.Reference;
import com.example.api.GreetingService;
import org.springframework.stereotype.Component;

@Component
public class GreetingClient {

    @Reference(timeout = 3000)
    private GreetingService greetingService;

    public String greeting(String name) {
        return greetingService.sayHello(name);
    }
}
```

Consumer 既要扫描 Spring Bean，也要让 Dubbo 处理 `@Reference`：

```xml
<context:component-scan base-package="com.example.consumer"/>
<dubbo:application name="greeting-consumer"/>
<dubbo:registry address="zookeeper://127.0.0.1:2181"/>
<dubbo:annotation package="com.example.consumer"/>
```

以上片段需要在 `<beans>` 中补充 Spring `context` 命名空间。注解改变的是配置入口，不会改变后面的注册、订阅和调用原理。

> 对同一个服务选择一种发布和引用方式即可。不要同时用 `@Service` 与 `<dubbo:service>` 重复发布，也不要同时用 `@Reference` 与 `<dubbo:reference>` 重复引用。由于 Dubbo 2.6.x 的 `@Service` 与 Spring `@Service` 同名，阅读代码时尤其要检查 import。

## 三、服务跑起来之后，地址究竟怎样流动

最小示例能够调用成功，只说明配置组合暂时正确。要真正理解 Dubbo，需要继续追问四个问题：Provider 在哪里监听、注册了什么、Consumer 从哪里拿到地址、请求是否经过注册中心。

### Provider 在自己的进程中监听端口

`<dubbo:protocol name="dubbo" port="20880"/>` 会让 Provider 在自身进程内启动 Dubbo 协议服务器。默认 Dubbo 协议基于 TCP 长连接和 NIO 通信，默认端口是 `20880`，2.6.x 默认传输实现通常是 Netty。

```xml
<dubbo:protocol name="dubbo"
                host="10.0.1.23"
                port="20880"/>
```

这个配置表示 Provider 监听 `10.0.1.23:20880`。通常不必显式设置 `host`，Dubbo 会推导本机地址；但在多网卡、容器或 NAT 环境中，自动选择的地址可能不是 Consumer 可达的地址。

Dubbo RPC 端口与 Web 容器的 HTTP 端口是两套监听器。即使 Tomcat 的 `8080` 可以访问，也不能据此证明 Dubbo 的 `20880` 已经监听。

### Provider 注册的是服务 URL，而不是实现对象

Provider 成功暴露服务后，会向注册中心写入一条可供发现和治理的 Provider URL。以接口级发现模型为例，解码后的信息在概念上类似：

```text
dubbo://10.0.1.23:20880/com.example.api.GreetingService
  ?application=greeting-provider
  &dubbo=2.6.x
  &group=member
  &version=1.0.0
  &methods=sayHello
  &serialization=hessian2
  &side=provider
  &timestamp=...
```

其中最值得关注的是：

- 协议、Provider IP 和端口。
- 接口全限定名。
- `group` 与 `version`。
- 应用名、Dubbo 版本、方法列表和时间戳。
- 权重、超时、序列化等已经配置到 URL 的参数。

ZooKeeper 中常见的组织形式是 `/dubbo/{接口全限定名}/providers`，Provider URL 会经过编码后成为临时节点。Provider 进程退出或会话失效后，临时节点应被移除。

注册中心没有拿到实现类对象，也没有拿到接口源码。真正的 `GreetingServiceImpl` 始终存在于 Provider 进程；注册中心保存的是用于定位和治理服务的地址数据。

### Consumer 通过订阅获得地址，并维护本地目录

Consumer 根据 `<dubbo:reference>` 或 `@Reference` 确定需要的接口，再向 ZooKeeper 订阅相应服务。可以把过程简化为：

1. Consumer 连接配置的注册中心。
2. 使用接口全限定名、`group` 和 `version` 定位目标服务。
3. 注册中心返回当前 Provider URL 列表。
4. Dubbo 将 URL 转换为可调用的 `Invoker`，保存在 Consumer 本地 `Directory` 中。
5. Provider 上下线或治理规则变化时，注册中心通知 Consumer 更新本地视图。

Consumer 不是每调用一次都查询一次 ZooKeeper。它调用时读取本地目录，因此注册中心短暂不可用时，已经建立的 Provider 调用未必立即中断；但新服务发现、地址变化和重新订阅会受影响。

### RPC 请求不会经过注册中心转发

真正调用时，Consumer 会从本地候选列表中执行路由和负载均衡，建立或复用到目标 Provider 的连接，然后直接发送请求：

```text
Consumer ───────── TCP / Dubbo Protocol ─────────→ Provider
```

所以注册中心不是反向代理，也不是 RPC 流量网关。它的故障主要影响注册、订阅和地址变更感知，而不是天然成为每次调用的数据转发瓶颈。

如果系统另外部署了网关、代理或 Service Mesh，数据链路可能经过它们，但那是额外的数据面组件，不能把它们和 Registry 混为一谈。

## 四、从服务地址继续深入到配置体系

理解地址如何流动以后，配置就不再是一组孤立属性。它们分别影响应用身份、地址来源、服务匹配、节点选择和失败处理。

### 先抓住十一项核心配置

| 配置 | 作用 | 排障时关注什么 |
| --- | --- | --- |
| `application` | 定义当前 Dubbo 应用名称 | 日志和注册数据是否属于预期应用 |
| `registry` | 定义注册中心地址及启动检查 | Provider、Consumer 是否连接同一套 Registry |
| `protocol` | 定义 RPC 协议、监听 IP、端口和序列化 | Provider 是否监听，注册地址是否可达 |
| `interface` | 定义服务契约的 Java 接口全限定名 | 包名和类名是否完全一致 |
| `group` | 区分同一接口的多个实现分组 | Provider、Consumer 是否完全匹配 |
| `version` | 隔离同一接口的不同版本 | Provider、Consumer 是否完全匹配 |
| `check` | 控制启动时是否检查注册中心或 Provider 可用性 | 它配置在 `reference`、`consumer` 还是 `registry` |
| `timeout` | 设置远程调用超时 | 最终生效的是方法、接口还是全局配置 |
| `retries` | 设置首次失败后的重试次数 | 次数不包含第一次调用，接口是否幂等 |
| `cluster` | 决定集群调用失败后怎么办 | Failover、Failfast 等策略是否符合业务语义 |
| `loadbalance` | 从候选 Provider 中选择节点 | 它不能从空列表中选出 Provider |

服务匹配键可以先记成：

```text
interface + group + version
```

`application` 说明“我是谁”，`registry` 说明“去哪里交换地址”，`protocol` 说明“怎样监听和通信”，而服务键说明“Consumer 究竟在找谁”。

### 配置有方法级、接口级和全局级

`timeout`、`retries`、`loadbalance` 等配置可以出现在三个粒度：

1. **方法级**：只影响指定方法。
2. **接口级**：影响某个 `<dubbo:service>` 或 `<dubbo:reference>`。
3. **Consumer / Provider 全局级**：为未显式配置的多个服务提供默认值。

Dubbo 2.6.x 常用的覆盖原则是：

```text
方法级 > 接口级 > 全局级
同一粒度下：Consumer 配置 > Provider 配置
```

例如：

```xml
<dubbo:consumer timeout="3000"
                retries="0"
                loadbalance="random"/>

<dubbo:reference id="greetingService"
                 interface="com.example.api.GreetingService"
                 timeout="2000"
                 retries="1"
                 cluster="failover"
                 loadbalance="roundrobin">
    <dubbo:method name="sayHello"
                  timeout="500"
                  retries="0"/>
</dubbo:reference>
```

最终 `sayHello` 的超时是 `500ms`、失败后不重试；负载均衡继承接口级 `roundrobin`，集群策略为 `failover`。

注解也能表达方法级配置：

```java
import com.alibaba.dubbo.config.annotation.Method;
import com.alibaba.dubbo.config.annotation.Reference;

@Reference(
    timeout = 2000,
    retries = 1,
    cluster = "failover",
    loadbalance = "roundrobin",
    methods = @Method(name = "sayHello", timeout = 500, retries = 0)
)
private GreetingService greetingService;
```

`@Method` 注解从 2.6.5 开始提供；如果项目停留在更早的 2.6.x 补丁版本，应使用 XML 的 `<dubbo:method>`，或者先核对实际依赖中的注解定义。

Dubbo 2.6.x 的常见默认值包括：调用超时 `1000ms`、失败后重试 `2` 次且不包含第一次调用、`Failover` 集群策略、`Random` 负载均衡。生产环境中的重要接口不应依赖隐式默认值，应根据幂等性、耗时和容量显式配置。

### 超时与重试必须放在一起理解

超时限制 Consumer 最多等待多久，重试决定一次尝试失败后是否再次选择节点。

```xml
<dubbo:reference id="queryService"
                 interface="com.example.api.QueryService"
                 timeout="800"
                 retries="1"/>

<dubbo:reference id="orderCommandService"
                 interface="com.example.api.OrderCommandService"
                 timeout="1500"
                 retries="0"/>
```

- 查询类、天然幂等接口可以考虑有限重试。
- 下单、扣款等非幂等操作通常应设 `retries="0"`，并在业务层设计幂等机制。
- 重试会增加总耗时和下游压力，不能用来掩盖错误的超时值或性能问题。
- Failover 的 `retries="2"` 表示最多三次尝试：第一次调用加两次重试。

### Router、LoadBalance 和 Cluster 各管一段

假设本地目录中有 A、B、C 三个 Provider：

```text
Directory 给出 A、B、C
  → Router 根据规则过滤，剩下 A、C
  → LoadBalance 为本次调用选择 A
  → Cluster 决定 A 失败后是否重试、是否改选 C
```

常用负载均衡策略：

| 策略 | 配置值 | 适用思路 |
| --- | --- | --- |
| 加权随机 | `random` | 2.6.x 默认策略，长期分布趋近权重比例 |
| 加权轮询 | `roundrobin` | 希望请求较均匀地轮流分配 |
| 最少活跃 | `leastactive` | 优先选择当前活跃调用数较少的节点 |
| 一致性哈希 | `consistenthash` | 希望相同参数较稳定地命中同一节点 |

常用集群容错策略：

- **Failover**：失败后切换节点重试，是 2.6.x 的默认策略。
- **Failfast**：只调用一次，失败立即抛出异常，适合非幂等操作。
- **Failsafe**：出现异常时记录日志并忽略，只适合不影响主流程的操作。
- **Failback**：失败后返回，后台定时重试，常用于消息通知类操作。
- **Forking**：并行调用多个节点，任一成功即返回，但资源消耗更大。

```xml
<dubbo:reference id="orderCommandService"
                 interface="com.example.api.OrderCommandService"
                 cluster="failfast"
                 retries="0"
                 loadbalance="random"/>
```

### group 与 version 决定能否匹配

同一接口存在多个业务实现时，可以用 `group` 分组；接口发生不兼容演进时，可以用 `version` 隔离新旧版本。

```xml
<!-- Provider -->
<dubbo:service interface="com.example.api.GreetingService"
               ref="greetingService"
               group="member"
               version="2.0.0"/>

<!-- Consumer -->
<dubbo:reference id="greetingService"
                 interface="com.example.api.GreetingService"
                 group="member"
                 version="2.0.0"/>
```

注解方式：

```java
@com.alibaba.dubbo.config.annotation.Service(
    group = "member",
    version = "2.0.0"
)
public class MemberGreetingServiceImpl implements GreetingService {
    // ...
}

@com.alibaba.dubbo.config.annotation.Reference(
    group = "member",
    version = "2.0.0"
)
private GreetingService greetingService;
```

Provider 与 Consumer 的值必须一致。注册中心中“存在同名接口”并不代表当前 Consumer 能够匹配它。

### Dubbo 2.6.x 是否需要手动配置序列化

**不要求每个服务手动配置。** 在 Dubbo 2.6.x 中，使用默认 Dubbo 协议时，默认序列化方式是 Hessian2，因此省略 `serialization` 也可以正常调用：

```xml
<dubbo:protocol name="dubbo" port="20880"/>
```

显式写出则更容易审计两端行为：

```xml
<dubbo:protocol name="dubbo"
                port="20880"
                serialization="hessian2"/>
```

还可以只针对某个 Provider 服务设置：

```xml
<dubbo:service interface="com.example.api.GreetingService"
               ref="greetingService"
               serialization="hessian2"/>
```

在 2.6.12 的配置模型中，`serialization` 属于协议或 Provider 服务配置，并不是 `<dubbo:consumer>`、`<dubbo:reference>` 的标准属性。Provider URL 会携带该参数，Consumer 为对应 Provider 创建 `DubboInvoker` 时使用这个 URL 完成协议调用。因此要调整序列化方式，应统一修改 Provider 侧协议或服务配置，并确认所有 Consumer 都具备相同实现，而不是给 Reference 添加一个实际版本不支持的属性。

“不用手动配置”不等于“可以忽略序列化”：

- Provider 与 Consumer 必须使用彼此兼容的序列化实现。
- 如果从 Hessian2 切换到 Kryo、FST 等实现，两端都要具备相应依赖和配置。
- DTO 应保持字段类型兼容，新增字段通常比改变字段类型安全。
- 不要直接传输数据库实体、巨大对象、文件或层级过深的对象图。
- Dubbo 协议适合小数据量、高并发 RPC，不适合直接传输大文件或超大字符串。

本文基于 2.6.x，因此不引入 Triple、Protobuf、Fastjson2 自动协商或 `prefer-serialization` 等 Dubbo 3 能力。

## 五、从配置错误走进 No Provider 故障

当调用链找不到候选地址时，最有效的学习方式不是继续背配置，而是保持一个可调用的基线环境，每次只改变一个变量，然后对照 Consumer 日志、Provider 日志和 ZooKeeper 数据。

### 先制造 version 不一致

Provider：

```xml
<dubbo:service interface="com.example.api.GreetingService"
               ref="greetingService"
               version="1.0"/>
```

Consumer：

```xml
<dubbo:reference id="greetingService"
                 interface="com.example.api.GreetingService"
                 version="2.0"/>
```

预期现象：

- Provider 正常监听并注册 `1.0` 服务。
- Consumer 订阅的是 `2.0`，匹配后的 Provider 列表为空。
- `check="true"` 时，Consumer 可能在创建 Reference 阶段报 `No provider available` 并启动失败。

此时应从异常中提取接口名、`group`、`version` 和注册中心地址，再到 ZooKeeper 或 Dubbo Admin 核对真实 Provider URL。这个实验说明：**Provider 已注册，不等于它与当前 Consumer 的服务键匹配。**

### 再制造 group 不一致

```xml
<!-- Provider -->
<dubbo:service interface="com.example.api.GreetingService"
               ref="greetingService"
               group="dev"/>

<!-- Consumer -->
<dubbo:reference id="greetingService"
                 interface="com.example.api.GreetingService"
                 group="test"/>
```

它和版本不一致的本质相同：接口存在，但 Consumer 订阅了另一个服务键。排查时不能只搜索 `GreetingService`，而要核对完整的：

```text
group/interface:version
```

### 停掉 Provider，观察 check 的边界

Provider 完全未启动时，先使用默认的启动检查：

```xml
<dubbo:reference id="greetingService"
                 interface="com.example.api.GreetingService"
                 check="true"/>
```

当地址列表为空，Consumer 会在初始化服务引用时失败。对于必须依赖的下游，这种方式能尽早暴露部署顺序或服务缺失问题。

再改成：

```xml
<dubbo:reference id="greetingService"
                 interface="com.example.api.GreetingService"
                 check="false"/>
```

Consumer 可以完成启动并创建代理，但在 Provider 上线并推送地址之前，真正调用方法仍然会失败。

必须明确：

> `check=false` 只表示启动阶段不因为当前没有 Provider 而失败，不代表调用时一定存在 Provider。

#### 三种 check=false 不是同一件事

| 配置 | 影响范围 | 启动时允许什么 | 不能保证什么 |
| --- | --- | --- | --- |
| `<dubbo:reference check="false">` | 单个服务引用 | 该引用暂时没有 Provider 时仍可启动 | 调用时能找到 Provider |
| `<dubbo:consumer check="false">` | Consumer 的全局默认值 | 未单独声明的 Reference 跳过地址检查 | 覆盖显式 `check="true"` 的 Reference |
| `<dubbo:registry check="false">` | 注册中心连接与注册订阅 | Registry 暂时不可用时应用仍可启动 | 已成功注册、订阅或拿到最新地址 |

`registry check=false` 关闭的是注册中心可用性检查。注册或订阅失败后，Dubbo 通常会在后台继续重试，待连接恢复后再完成相应动作。

旧版项目还可能通过系统属性统一覆盖：

```bash
-Ddubbo.reference.check=false
-Ddubbo.consumer.check=false
-Ddubbo.registry.check=false
```

全局强制设置与 XML 某个 Bean 上的默认配置不属于同一粒度。排查时必须同时检查启动参数、`dubbo.properties` 和 Spring XML，不能只看注解。

### 最后把注册中心地址改错

```xml
<dubbo:registry address="zookeeper://127.0.0.1:12181"/>
```

需要区分两类日志：

| 现象 | 日志线索 | 本质 |
| --- | --- | --- |
| 注册中心不可达 | 连接拒绝、超时、会话失败、注册或订阅重试 | Consumer 没有成功连接目标 Registry |
| Provider 列表为空 | 已连接 Registry，但出现 `No provider available` | 已完成订阅流程，但没有匹配服务地址 |

还有一种更隐蔽的情况：地址可以连接，但 Consumer 连到了另一套 ZooKeeper 集群或错误环境。此时没有连接异常，表现却像 Provider 列表为空，所以必须对比两端完整的 Registry 地址和环境配置。

### 把实验归纳成一张排障卡

```text
No provider available
        ↓
检查接口全限定名
        ↓
检查 group / version
        ↓
检查 Provider 是否成功暴露
        ↓
检查 Provider 是否注册
        ↓
检查 Consumer 是否订阅成功
        ↓
检查 Provider 是否 disabled
        ↓
检查路由规则是否过滤全部 Provider
```

每一步都需要对应证据：

| 检查项 | 到哪里检查 | 能排除的问题 |
| --- | --- | --- |
| 接口全限定名 | Consumer 异常、两端 API 依赖与 XML | 包名、类名或 API 依赖错误 |
| `group` / `version` | 两端配置、异常中的 service key、Provider URL | 服务键不一致 |
| Provider 是否暴露 | Provider 启动日志、监听端口 | Bean 未加载、注解未扫描、端口冲突、暴露失败 |
| Provider 是否注册 | ZooKeeper `/providers` 节点、Provider 注册日志 | Registry 配错、会话失败、Provider 连错环境 |
| Consumer 是否订阅 | Consumer 启动日志、ZooKeeper `/consumers` 节点、本地 Directory | 订阅失败、连错环境、未收到地址通知 |
| Provider 是否 disabled | Provider URL、Dubbo Admin 覆盖配置 | 地址存在，但节点被治理规则禁用 |
| Router 是否推空 | Consumer 日志、路由规则、断点中的路由前后列表 | 原始列表非空，但候选地址被全部过滤 |

如果日志类似：

```text
No provider available for the service
test/com.example.api.GreetingService:2.0
from the url zookeeper://127.0.0.1:2181/...
```

应立即提取：

```text
注册中心：127.0.0.1:2181
接口：com.example.api.GreetingService
group：test
version：2.0
```

然后使用完整服务键查询，而不是只问“Provider 启动了吗”。真正掌握这部分的标准，是能够说明每个检查项去哪里看、能排除什么，并判断地址是在“暴露 → 注册 → 订阅 → 路由”的哪一环消失。

## 六、地址列表不再神秘之后，再进入调用链

当 Provider 地址存在却仍然调用失败，就需要从“有没有地址”继续深入到“这次调用如何选择、发送和等待”。这里不追求读完所有 SPI 和传输细节，只保留一条足以支撑排障的主干。

### Consumer 侧的主链路

```text
业务接口代理
  ↓
ClusterInvoker
  ↓
Directory 获取 Provider 列表
  ↓
Router 过滤
  ↓
LoadBalance 选择一个 Provider
  ↓
DubboInvoker
  ↓
发送请求
  ↓
DefaultFuture 关联并等待结果
```

| 节点 | 核心职责 | 排障价值 |
| --- | --- | --- |
| 业务接口代理 | 把 Java 方法调用转换成 Dubbo `Invocation` | 确认接口、方法和参数 |
| `ClusterInvoker` | 把多个 Provider Invoker 组织成一个集群调用入口 | 确认失败后采用哪种容错策略 |
| `Directory` | 维护动态变化的 Provider Invoker 集合 | 看到 Consumer 当前真正持有的地址 |
| `Router` | 按条件或脚本路由规则过滤候选节点 | 判断地址是否在路由阶段消失 |
| `LoadBalance` | 从路由后的候选集中选一个 Invoker | 确定本次最终选中谁 |
| `DubboInvoker` | 代表某个具体 Dubbo 协议 Provider | 从 URL 查看目标 IP、端口和参数 |
| `DefaultFuture` | 用请求 ID 关联请求与响应，处理返回和超时 | 判断请求已发出后是否等到响应 |

一次 Failover 调用可以简化为：

```text
Directory 给出 A、B、C
  → Router 过滤后剩下 A、C
  → LoadBalance 选中 A
  → 调用 A 失败
  → FailoverClusterInvoker 进入下一次尝试
  → 再次列举并选择 C
  → 调用 C 成功
```

这也解释了为什么重试发生时，日志里可能出现多个 Provider 地址：Cluster 层不是机械地对同一条连接重复发送，而是可以重新选择候选节点。

### Provider 侧保留一条够用的链路

```text
Netty 收到请求
  ↓
Dispatcher 分发
  ↓
Dubbo 业务线程池
  ↓
Filter 调用链
  ↓
实际 Service 方法
```

- **Netty** 负责连接、字节读写和网络事件。
- **Dispatcher** 决定哪些事件在 IO 线程处理，哪些派发给业务线程池。
- **Dubbo 线程池** 避免可能阻塞的业务逻辑长期占用 IO 线程。
- **Filter** 在服务调用前后承载上下文、监控、异常处理等通用逻辑。
- **Service 方法** 是最终业务实现。

这是面向排障的简化图，不代表省略的 Codec、ExchangeHandler、ChannelHandler 和代理层不存在。只有当证据指向某一层时，再沿该节点继续深入。

### 用 IDEA 跟踪一次真实调用

先确认项目解析出的 Dubbo Jar 版本，并让 IDEA 下载同版本 Sources。Dubbo 2.6.x 的核心包名前缀是 `com.alibaba.dubbo`，不能拿 Dubbo 3 的 `org.apache.dubbo` 源码直接对照。

以 2.6.12 为例，可以从这些类开始：

| 类 | 包名 | 主要观察内容 |
| --- | --- | --- |
| `ReferenceConfig` | `com.alibaba.dubbo.config.ReferenceConfig` | 服务引用如何初始化并创建接口代理 |
| `RegistryDirectory` | `com.alibaba.dubbo.registry.integration.RegistryDirectory` | Provider URL 如何转换为 Invoker 集合 |
| `AbstractClusterInvoker` | `com.alibaba.dubbo.rpc.cluster.support.AbstractClusterInvoker` | 如何列出候选节点并完成选择 |
| `FailoverClusterInvoker` | `com.alibaba.dubbo.rpc.cluster.support.FailoverClusterInvoker` | 重试循环、已调用节点和最终异常 |
| `DubboInvoker` | `com.alibaba.dubbo.rpc.protocol.dubbo.DubboInvoker` | 目标 URL、连接选择与请求发送 |
| `DefaultFuture` | `com.alibaba.dubbo.remoting.exchange.support.DefaultFuture` | 请求 ID、响应回填与等待超时 |

建议准备两个使用不同端口的 Provider，让返回值带上实例标识，然后按下面的顺序观察：

1. 启动 Consumer，确认 `RegistryDirectory` 已经持有两个 Provider Invoker。
2. 发起一次同步调用，从 `AbstractClusterInvoker` 跟进选址。
3. 在 IDEA Evaluate Expression 中查看候选 Invoker 的 `getUrl()`。
4. 进入 `DubboInvoker`，记录最终目标 host 和 port。
5. 让首次选中的 Provider 抛出异常或停止，观察 `FailoverClusterInvoker` 的下一次尝试。
6. 观察请求 ID 何时进入 `DefaultFuture` 映射，响应回来后何时完成。

`ReferenceConfig` 主要用于初始化 Reference，并不会在每次业务调用时都重新创建代理。代理建立后，运行时排查应把重点放在 Directory、Cluster、具体 Invoker 和 Future。

#### 用四个问题约束源码阅读范围

**Provider 地址列表在哪里获取？**

注册中心推送的 URL 会被 `RegistryDirectory` 转换并维护为 Invoker 集合。调用时，ClusterInvoker 通过 `Directory.list(invocation)` 获得当前候选集，读取的是 Consumer 内存视图，不是每次远程查询 ZooKeeper。

**最终调用哪台 Provider？**

查看 LoadBalance 返回的 Invoker，或者进入 `DubboInvoker` 查看 `getUrl()` 的 host 和 port。注册中心列表只是原始来源，路由、禁用状态和负载均衡都会影响最终结果。

**失败重试发生在哪里？**

使用 Failover 时，尝试循环和重新选址发生在 `FailoverClusterInvoker`。`DubboInvoker` 只负责对一个具体 Provider 发起协议调用，它不决定整个集群是否重试。

**Consumer 在哪里等待响应？**

`DefaultFuture` 使用请求 ID 关联请求与响应。同步请求发出后，Consumer 等待对应 Future 完成；响应到达时，框架按请求 ID 找到它并写入结果。选址阶段就失败时不会进入正常的响应等待，已经发出却迟迟无响应时则可能在 Future 等待阶段超时。

## 七、注册中心有地址，还要验证监听与网络

“注册成功”只证明 Registry 中存在一条地址数据，不证明该地址仍在监听，更不证明 Consumer 能访问。把注册地址、实际监听和 Consumer 网络视角串起来，才能定位“注册了但无法连接”。

> 以下故障实验只应在本地或隔离测试环境执行，不要向生产注册中心写入故意错误的地址。

### 制造一个错误注册地址

Dubbo 2.6.x 可以分别设置绑定地址和注册地址。比如让 Provider 实际监听 `20880`，却向 Registry 上报 `20881`：

```bash
export DUBBO_PORT_TO_BIND=20880
export DUBBO_PORT_TO_REGISTRY=20881
```

也可以通过以下变量上报一个 Consumer 无法访问的测试 IP：

```bash
export DUBBO_IP_TO_REGISTRY=10.0.99.99
```

四个关键变量是：

- `DUBBO_IP_TO_BIND`：Provider 实际绑定的 IP。
- `DUBBO_PORT_TO_BIND`：Provider 实际绑定的端口。
- `DUBBO_IP_TO_REGISTRY`：写入注册中心的 IP。
- `DUBBO_PORT_TO_REGISTRY`：写入注册中心的端口。

注册地址可以与绑定地址不同，这对 NAT、容器和多网卡部署有用，但配置错误也会造成“Registry 看起来正常，Consumer 就是连不上”。

### 先在 Provider 检查监听

```bash
ss -lntp | grep 20880
```

关注：

- 是否真的存在 `LISTEN`。
- 监听的是 `127.0.0.1`、某个网卡 IP，还是 `0.0.0.0`。
- 占用端口的 PID 是否就是预期 Provider。

如果系统没有 `ss`，可以根据环境使用 `netstat` 或 `lsof -iTCP:20880 -sTCP:LISTEN`。

### 再从 Consumer 所在位置测试连通性

```bash
nc -vz provider-ip 20880
```

这条命令必须从真实 Consumer 所在机器、容器或 Pod 执行。Provider 本机能连接自己，只能证明本地回环或本机网卡可用，无法证明跨主机网络可达。

| `nc` 结果 | 常见含义 | 下一步 |
| --- | --- | --- |
| `succeeded` | TCP 握手成功，端口可达 | 继续查协议、序列化、线程池、Filter 和业务日志 |
| `Connection refused` | 主机可达，但目标端口未监听或被立即拒绝 | 对比 `ss`、Provider 日志和注册端口 |
| `timed out` | 数据包可能被防火墙、ACL 或网络策略丢弃 | 检查路由、防火墙、安全组和 NetworkPolicy |
| `No route to host` | Consumer 到目标网段没有可用路由 | 检查注册 IP、网关、VPC/子网和容器网络 |

### 用同一条证据链区分五种情况

| 情况 | 注册中心 | Provider 的 `ss` | Consumer 的 `nc` | 结论 |
| --- | --- | --- | --- | --- |
| 服务没有注册 | 找不到目标 Provider URL | 可能监听，也可能未监听 | 没有可靠目标可测 | 先查暴露、注册和 Registry 环境 |
| 已注册但没有监听 | 存在 IP:端口 | 目标端口没有 `LISTEN` | 常见为拒绝连接 | 注册数据过期，或协议服务器启动失败/已退出 |
| 已监听但网络不通 | 存在 IP:端口 | Provider 本机正常监听 | 超时或无路由 | 检查 ACL、防火墙、安全组和网段路由 |
| 注册了错误 IP | URL 中 IP 不可达或属于错误网卡 | 可能在另一地址监听 | 超时、无路由或连到错误主机 | 检查网卡选择和 `DUBBO_IP_TO_REGISTRY` |
| 监听端口与注册端口不一致 | 例如注册 `20881` | 实际监听 `20880` | 连接 `20881` 失败 | 对比 Bind、Registry 变量和协议配置 |

排查顺序应固定为：

```text
读取注册中心中的 Provider IP:端口
  ↓
与 Provider 实际监听对比
ss -lntp
  ↓
从 Consumer 网络视角验证
nc -vz IP 端口
  ↓
TCP 可达后再继续检查
协议 / 序列化 / 线程池 / Filter / 业务方法
```

把注册、监听和连通性分开后，就不会因为 ZooKeeper 中存在节点而过早得出“网络没有问题”的结论。

## 八、把整篇内容收束成一张调用与排障图

```text
Provider 启动
  → Spring 创建 Service Bean
  → Dubbo 协议服务器绑定 IP:20880
  → 生成 Provider URL
  → 注册到 ZooKeeper

Consumer 启动
  → ReferenceConfig 创建接口代理
  → 向 ZooKeeper 订阅 interface + group + version
  → RegistryDirectory 维护 Provider Invoker 列表

业务代码调用接口代理
  → ClusterInvoker
      → Directory：列出当前 Invoker
      → Router：过滤候选节点
      → LoadBalance：选中一台 Provider
      → Failover：失败时重新选址
  → DubboInvoker：确定目标 IP:端口
  → Client / Channel：直接发送请求
  → DefaultFuture：按 requestId 等待响应

                         TCP / Dubbo Protocol

Provider
  → Netty 收到请求
  → Dispatcher 分发
  → Dubbo 业务线程池
  → Filter Chain
  → 实际 Service 方法
  → 返回响应
```

这张图刻意不展开所有 SPI、Codec 和 Netty Pipeline。它的作用是为现象找到层次：

- 没有匹配 URL，查服务键、注册和订阅。
- Directory 有地址，Router 后为空，查路由与禁用规则。
- 已选中 Invoker，但 TCP 不通，查注册地址、监听与网络。
- 请求已发出但等待超时，查 Provider 线程池、Filter、业务耗时和响应链路。
- 一次失败后调用了另一台，查 Failover 与 `retries`。

## 九、几个容易混淆的边界

### check=false 不是容错策略

`check=false` 只影响启动检查；真正调用失败后怎么办，由 `cluster`、`retries`、mock 等调用配置决定。它也不能把空地址列表变成可用 Provider。

### 注册成功不等于暴露、监听和可达都正常

Provider URL 可能是过期数据，也可能上报了错误网卡或端口。验证时必须形成“Provider 暴露日志 → Registry URL → 本机监听 → Consumer 连通性”的证据闭环。

### 负载均衡不能解决 No Provider

LoadBalance 的前提是路由后至少存在一个候选 Invoker。列表为空时，把 `random` 改成 `roundrobin` 不会产生任何地址。

### Dubbo 与 Spring Cloud 并不天然互斥

Spring Cloud 更像一套微服务开发生态，Dubbo 更专注于 RPC 和服务治理。是否组合使用取决于旧系统现状、跨语言需求、治理体系和团队维护成本。

### Dubbo 调用与 HTTP 调用各有边界

Dubbo 2.6.x 的 Java 接口模型提供强类型、接近本地方法的体验和内建治理能力；HTTP/REST 则语言中立、调试直观、生态广泛。不能只用“性能高低”做选择，还要考虑接口开放范围、跨语言和升级兼容。

### 共享 API 包会带来版本耦合

强类型接口提高了编译期安全性，也要求 Provider 与 Consumer 管理 API 依赖。API 模块应尽量精简，不放服务实现、数据库实体和无关依赖；不兼容变更应通过版本管理和 `version` 做清晰隔离。

## 十、形成可重复使用的排障顺序

遇到“找不到服务”或“调用超时”时，可以依次确认：

1. Provider 的 Service Bean 是否创建，服务是否成功暴露。
2. Dubbo 协议端口是否由预期进程监听。
3. Provider、Consumer 是否连接同一 ZooKeeper 集群和环境。
4. 接口全限定名、`group`、`version` 是否一致。
5. Registry 中是否存在未禁用的 Provider URL。
6. Consumer 是否订阅成功，Directory 和路由后是否还有候选 Invoker。
7. 注册 IP、端口是否与 Provider 实际监听一致。
8. 从 Consumer 网络视角能否连接目标地址。
9. 最终选中了哪台 Provider，Failover 是否发生重试。
10. 超时发生在连接、Future 等待、Provider 线程池，还是业务与下游调用。

排障时不要只读 Consumer 的最后一行异常。日志、ZooKeeper 数据、Provider 监听、Consumer 连通性和源码断点共同组成完整证据。

## 十一、继续深入的方向

- [ ] 分别用纯 XML 与 2.6.x 注解跑通 Provider、Consumer、ZooKeeper 示例。
- [ ] 在 ZooKeeper 中观察 `/providers`、`/consumers`、`/routers`、`/configurators` 节点变化。
- [ ] 逐一复现 version、group、Provider 未启动和 Registry 地址错误。
- [ ] 验证 Reference、Consumer、Registry 三种 `check=false` 的差异。
- [ ] 用两个 Provider 观察 Random、RoundRobin 和 Failover 重试。
- [ ] 从 `ReferenceConfig` 跟踪到 `DefaultFuture`，回答四个源码问题。
- [ ] 制造错误注册 IP 或端口，用 `ss` 与 `nc` 完成网络证据链。
- [ ] 继续阅读 Dubbo SPI、Filter、线程模型、连接复用和优雅停机。
- [ ] 为旧项目制定从 2.6.x 向受维护版本迁移的依赖、包名和协议计划。

## 参考资料

- [Dubbo 2.6.12 官方源码归档](https://archive.apache.org/dist/dubbo/2.6.12/)
- [Dubbo 版本说明](https://dubbo.apache.org/zh-cn/overview/mannual/java-sdk/versions/)
- [从 Dubbo 2 迁移到 Dubbo 3](https://dubbo.apache.org/zh-cn/overview/mannual/java-sdk/reference-manual/upgrades-and-compatibility/migration/)
- [Dubbo 2.x：使用 XML 配置](https://dubbo.apache.org/zh-cn/docsv2.7/user/configuration/xml/)
- [Dubbo 2.x：启动时检查](https://cn.dubbo.apache.org/zh-cn/docsv2.7/user/examples/preflight-check/)
- [Dubbo 2.x：Dubbo 协议](https://dubbo.apache.org/zh-cn/docsv2.7/user/references/protocol/dubbo/)
- [Dubbo 2.x：主机与注册地址配置](https://cn.dubbo.apache.org/zh-cn/docsv2.7/user/examples/set-host/)
- [Dubbo 2.x：负载均衡](https://dubbo.apache.org/zh-cn/docsv2.7/user/examples/loadbalance/)
- [Dubbo 2.x：集群容错](https://dubbo.apache.org/zh-cn/docs/advanced/fault-tolerent-strategy/)
- [No Provider 问题排查](https://dubbo.apache.org/zh-cn/overview/mannual/java-sdk/tasks/troubleshoot/no-provider/)
