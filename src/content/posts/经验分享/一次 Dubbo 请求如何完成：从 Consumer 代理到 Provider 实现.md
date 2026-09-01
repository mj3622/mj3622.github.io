---
title: "一次 Dubbo 请求如何完成：从 Consumer 代理到 Provider 实现"
published: 2026-09-01
description: "以 Dubbo 2.6.12 的同步调用为主线，梳理 Consumer 代理、路由与负载均衡、网络传输、Provider 执行以及超时重试机制"
tags: [Java, Dubbo, RPC, 微服务]
category: 经验分享
draft: false
---

本文以 Dubbo 2.6.12 的一次普通同步调用为主线，观察请求如何从 Consumer 代理出发，跨过网络到达 Provider 实现，再把结果带回业务代码。

## 1. 整体认识

Dubbo 的调用方向是 Consumer → Provider。Consumer 发起请求，Provider 执行业务方法，再把结果返回 Consumer

跟踪一次普通的同步调用：

```java
String hello = helloService.sayHello("world");
```

最终执行的是 Provider 中的：

```java
HelloServiceImpl.sayHello("world")
```

中间流程可以先压缩成一张图：

```mermaid
flowchart LR
    A["Consumer 业务代码"] --> B["接口代理"]
    B --> C["创建 Invocation"]
    C --> D["取得候选 Provider"]
    D --> E["路由与负载均衡"]
    E --> F["发起远程请求"]
    F --> G["Provider 接收请求"]
    G --> H["找到本地服务"]
    H --> I["执行 HelloServiceImpl"]
    I --> J["响应返回 Consumer"]
```

> **注册中心会参与每次请求吗？**
>
> 不会。注册中心负责告诉 Consumer“Provider 在哪里”，业务请求会从 Consumer 直接发往 Provider。
>
> 可以把注册中心看成通讯录，而不是请求中转站

## 2. 请求开始前，两端已经准备好了什么

Consumer 执行 `sayHello()` 时，Provider 已经暴露服务，Consumer 也已经拿到代理和 Provider 地址。一次调用不会临时去注册中心查询，也不会重新创建整套引用关系

### 2.1 Provider 把本地 Bean 暴露成服务

Provider 配置声明了 `HelloServiceImpl`，并把它作为 `HelloService` 暴露：

```xml
<dubbo:protocol name="dubbo" port="20880"/>

<bean id="helloService"
      class="com.alibaba.dubbo.demo.provider.HelloServiceImpl"/>

<dubbo:service
    interface="com.alibaba.dubbo.demo.HelloService"
    ref="helloService"/>
```

Provider 启动时主要完成三件事：

```text
HelloServiceImpl
→ 包装成 Dubbo 可以统一调用的 Invoker
→ 保存到本地服务表
→ 启动端口并向注册中心登记地址
```

`Invoker` 可以理解成 Dubbo 内部统一的“可调用对象”。Provider 收到远程请求后，不会直接操作 Spring Bean，而是先找到对应 Invoker，再由 Invoker 调用 `HelloServiceImpl`

本地服务表保存的是“服务标识 → 本地 Invoker”的关系。同一个端口可以暴露多个服务，Dubbo 会根据接口、分组和版本找到正确的那一个

### 2.2 Consumer 创建接口代理和 Provider 目录

Consumer 配置如下：

```xml
<dubbo:reference
    id="helloService"
    check="false"
    interface="com.alibaba.dubbo.demo.HelloService"/>
```

服务引用完成后，Spring 中的对象关系可以简化为：

```text
HelloService 接口代理
└── ClusterInvoker
    └── RegistryDirectory
        ├── Provider A 的 Invoker
        ├── Provider B 的 Invoker
        └── Provider C 的 Invoker
```

接口代理负责接住业务方法，ClusterInvoker 负责容错，RegistryDirectory 负责维护 Provider 列表，每个 Provider Invoker 负责调用一台具体机器

Provider 上下线时，注册中心通知 `RegistryDirectory` 更新列表。上层代理一直持有同一个 Directory，所以 Spring 不需要重新注入 `HelloService`

> **Consumer 会拿到 Provider 的实现类吗？**
>
> 不会。Consumer 只有公共接口、接口代理和 Provider 地址，`HelloServiceImpl` 始终留在 Provider 进程中。

## 3. Consumer 把本地方法变成远程调用

### 3.1 接口代理创建 Invocation

业务代码调用：

```java
helloService.sayHello("world")
```

`helloService` 是 Javassist 生成的接口代理。代理最终进入 `InvokerInvocationHandler`：

```java
return invoker.invoke(
        new RpcInvocation(method, args)
).recreate();
```

前半段把 Java 的 `Method` 和参数放进 `RpcInvocation`：

```text
methodName      = sayHello
parameterTypes  = [java.lang.String]
arguments       = ["world"]
attachments     = {...}
```

`RpcInvocation` 是这次调用的说明书。它记录方法名、参数类型、实参和调用上下文，不包含 Provider 的实现对象

attachments 用于携带服务版本、分组、超时和 `RpcContext` 中的上下文。它与业务参数分开，所以这些 RPC 信息不会污染 `sayHello(String name)` 的方法签名

代理末尾的 `recreate()` 此时还没有真正执行。它要等远程结果回来后，才把 Dubbo 结果还原成普通返回值或业务异常

`recreate()` 不是重新创建或重新调用，它只是拆开 `RpcResult`：

```java
if (exception != null) {
    throw exception;
}
return result;
```

Provider 正常返回时，`recreate()` 取出返回值；Provider 返回业务异常时，它在 Consumer 当前线程重新抛出异常。这样远程调用对业务代码来说仍然像普通 Java 方法一样，要么返回结果，要么抛出异常

### 3.2 Directory 给出候选 Provider

Invocation 进入 ClusterInvoker 后，Cluster 会向 Directory 查询：

```java
List<Invoker<T>> invokers = directory.list(invocation);
```

`RegistryDirectory` 读取自己内存中的 Provider 列表，不会在每次调用时重新请求注册中心

假设当前有三台 Provider：

```text
sayHello
├── Provider A
├── Provider B
└── Provider C
```

Directory 解决的是“当前有哪些 Provider 可以调用”，还不会决定这次最终调用哪一个

### 3.3 Router 过滤，LoadBalance 选择

Directory 取出列表后，Router 先应用路由规则。例如只允许某个机房或标签时，不符合条件的 Provider 会被排除

```text
原始 Provider 列表
→ Router 过滤
→ 本次允许调用的候选列表
```

随后 LoadBalance 从候选列表中选出一台 Provider。Dubbo 2.6.12 默认使用随机负载均衡；只有一个 Provider 时就直接使用它

```text
候选 Provider A、B、C
→ LoadBalance
→ 选中 Provider B
```

> **Router 和 LoadBalance 为什么要分开？**
>
> Router 处理“能不能调用”，LoadBalance 处理“这次调用谁”
>
> 先过滤再选择，负载均衡就不会选中路由规则已经排除的节点

### 3.4 Cluster 决定失败后怎么办

Dubbo 2.6.12 默认使用 Failover。它先调用选中的 Provider；网络失败或等待超时后，再重新读取 Directory 并选择下一次调用目标

默认 `retries=2`，表示第一次调用之外再重试两次，所以最多尝试三次：

```text
第 1 次  调用 Provider B
第 2 次  重新取得候选列表并选择
第 3 次  再次选择
```

Cluster 负责一次业务调用的容错策略，LoadBalance 只负责某一次尝试选谁。发生重试时，Dubbo 可能重新做一次负载均衡

Provider 返回的业务异常不会触发 Failover 重试；网络异常和 Consumer 等待超时等非业务异常才会进入下一轮

### 3.5 选中的 Provider Invoker 发起调用

负载均衡选出具体 Provider 后，请求先经过 Consumer Filter。Filter 处理上下文、监控、限流等公共逻辑，然后把 Invocation 交给 `DubboInvoker`

`DubboInvoker` 补充服务定位信息，取得已经建立的客户端连接，再发起同步请求：

```java
return (Result) currentClient
        .request(invocation, timeout)
        .get();
```

这里的“同步”表示 Consumer 业务线程会等待结果。底层网络收发仍然由异步 I/O 完成

## 4. 请求怎样跨进程到达 Provider

### 4.1 Request 为调用分配请求 ID

Dubbo 不会直接发送 Invocation，而是先把它放进 Request：

```text
Request
├── id       请求 ID
├── twoWay   是否需要响应
└── data     RpcInvocation
```

Invocation 说明“要调用什么”，Request 说明“这是哪一次请求、是否需要返回结果”

同步调用需要响应，Dubbo 会同时创建一个 Future，并保存下面的对应关系：

```text
request id → Future
```

一条长连接可以同时发送多个请求，响应顺序不一定与发送顺序相同。请求 ID 让 Consumer 能把响应交给正确的等待线程

### 4.2 TCP 长连接在什么时候建立

Consumer 从注册中心收到 Provider 地址后，会为该地址创建 Provider Invoker。创建 Invoker 的过程中，Dubbo 同时创建或复用 `ExchangeClient`，再由 Netty 连接 Provider 的服务端口

```text
注册中心通知 Provider 地址
→ RegistryDirectory 创建 Provider Invoker
→ DubboInvoker 创建或取得 ExchangeClient
→ Netty 建立到 Provider 的 TCP 连接
→ DubboInvoker 保存并复用这条连接
```

TCP 连接的对象关系可以理解为：

```text
Consumer
└── HelloService 代理
    └── Provider Invoker
        └── ExchangeClient
            └── TCP 长连接
                └── Provider:20880
```

没有配置 `connections` 时，同一 Provider 地址默认共享连接。后面的 `sayHello()` 不再重复进行 TCP 建连，而是把新的 Request 写入已有连接

```text
建立 TCP 连接
→ 发送 Request 101，接收 Response 101
→ 发送 Request 102，接收 Response 102
→ 连接继续保留
```

如果启用了延迟连接，真正建连会推迟到第一次调用；如果 Provider 尚未上线，则会在 Consumer 收到可用地址后再创建连接。连接意外断开时，Dubbo 的客户端重连机制会尝试重新建立连接

同一条连接可以承载多个并发请求，Request ID 负责把响应交给各自的 Future。这里的“复用连接”是复用 TCP 通道，不是复用 Request 或调用结果

### 4.3 调用对象被序列化并发送

Request 发送前，Dubbo 会把服务信息、方法名、参数和 attachments 编码为协议报文，再交给 Netty

这里先记住三层职责即可：

```text
序列化     把 Java 对象转换成字节
Dubbo 协议 组织请求信息和请求 ID
Netty      管理连接并发送字节
```

这些字节通过 Consumer 与 Provider 已经建立的连接直接发往 Provider。注册中心不会出现在这段传输中

## 5. Provider 怎样找到并执行本地服务

### 5.1 收到请求后切换到业务线程

Provider 收到字节后，先把它还原成 Request 和 RpcInvocation。此时方法名、参数类型、`"world"` 和调用上下文都重新出现

网络线程不会直接执行 `HelloServiceImpl`。Dubbo 会把请求交给业务线程池，避免耗时业务占住网络 I/O 线程

```text
Provider 网络线程
→ 解码请求
→ 提交到 Dubbo 业务线程池
→ 继续处理 Invocation
```

线程切换之后，后续处理才进入真正的 RPC 调用阶段

> **为什么切换到业务线程后还能通过原连接返回？**
>
> 线程切换只改变“谁来执行请求”，不会改变“响应应该写入哪条连接”
>
> Provider 收到请求时会保留对应的 Channel，并把它和 Request 一起交给业务线程。业务执行完成后，处理器仍然调用这个 Channel 发送 Response，因此响应会沿原 TCP 连接返回 Consumer

这里的 Channel 可以理解为 Provider 对当前 TCP 连接的引用。网络线程负责接收请求，业务线程负责执行方法，执行结果仍然通过同一个 Channel 写回

### 5.2 根据服务信息查找本地 Invoker

Provider 从 Invocation 中取出接口、分组和版本等信息，组装成服务标识，再查询启动时准备好的本地服务表：

```text
RpcInvocation
→ 服务标识
→ 本地服务表
→ Provider Invoker
→ HelloServiceImpl
```

这一步解决的是“请求已经到达 Provider，但应该交给哪个本地服务”

同一个端口可以暴露多个接口，因为 Dubbo 不只按端口区分服务。接口、分组和版本共同决定最终进入哪个 Provider Invoker

### 5.3 Provider Filter 处理上下文，再调用实现类

找到 Provider Invoker 后，请求会经过 Provider Filter。它们负责准备 `RpcContext`、记录监控信息、处理异常等公共逻辑

Filter 链最里面的代理 Invoker 根据方法名和参数调用本地实现：

```java
HelloServiceImpl.sayHello("world")
```

`HelloServiceImpl` 可以通过 `RpcContext` 读取 Consumer 地址和 Provider 本地地址，因为这些信息已经在进入业务方法前准备完成

到这里，远程请求才真正落到业务代码

## 6. 返回结果怎样回到 Consumer

### 6.1 返回值先包装成 RpcResult

`HelloServiceImpl.sayHello()` 返回字符串后，Provider 把它包装成 `RpcResult`

```text
成功：RpcResult(value="Hello world, ...")
失败：RpcResult(exception=业务异常)
```

`RpcResult` 同时表达返回值和业务异常。Provider Filter 可以用同一条返回链处理监控、异常转换和响应上下文

Provider 方法抛出的业务异常通常不会直接打断网络处理流程，而是作为一次明确的业务结果返回 Consumer

### 6.2 RpcResult 放进 Response 返回

Dubbo 把 RpcResult 放进 Response，Response 沿用原 Request ID：

```text
Request  id = 123
Response id = 123
```

随后 Response 被编码并通过原连接返回 Consumer。Consumer 收到后，再根据 ID 找到对应 Future

```text
Response id
→ 找到 Future
→ 保存调用结果
→ 唤醒等待线程
```

之前阻塞在 `future.get()` 的 Consumer 业务线程从这里恢复。Request ID 和 Future 负责把异步到达的响应交回最初的同步调用线程

### 6.3 接口代理还原返回值或异常

结果沿 Consumer 调用链返回接口代理后，`InvokerInvocationHandler` 执行最开始留下的 `recreate()`：

```java
if (exception != null) {
    throw exception;
}
return result;
```

RpcResult 中是 value，业务代码就得到字符串；其中是业务异常，代理就在 Consumer 线程重新抛出异常

远程调用到这里重新表现为普通 Java 方法：要么返回，要么抛异常

## 7. 超时和重试需要单独理解

### 7.1 Consumer 超时不等于 Provider 停止

同步调用等待发生在 Consumer 的 Future 上。Dubbo 2.6.12 默认 timeout 为 1000 ms

如果 1000 ms 内没有收到 Response，Consumer 抛出超时异常，但 Provider 线程不会因此自动停止。它可能仍在执行，甚至已经完成业务操作

```text
Consumer 发送请求
→ Provider 开始执行
→ Consumer 等待超时
→ Failover 发起下一次调用
→ 第一次调用稍后完成
```

Consumer 看到的是“没有按时收到结果”，不是“Provider 一定没有执行成功”。这正是写接口需要幂等的原因

### 7.2 重试是新的远程调用

Failover 重试时会重新选择 Provider，并创建新的 Request。它复用的是同一次业务调用信息，网络层面却是一次新的调用

```text
同一个业务 Invocation
├── 第一次请求 → Provider A
├── 第二次请求 → Provider B
└── 第三次请求 → Provider C
```

### 7.3 业务异常为什么不重试

Provider 业务异常通过 RpcResult 正常返回，说明 Consumer 已经得到一次明确的业务执行结果。Failover 不应该再换一台机器重复执行业务

网络异常和超时没有给出明确业务结果，所以默认 Failover 会继续尝试：

| 结果 | 表示什么 | 默认是否重试 |
| --- | --- | --- |
| 业务异常 | Provider 已执行并返回业务结果 | 否 |
| 网络异常 | 请求没有正常完成 | 是 |
| 等待超时 | Consumer 没有按时收到结果 | 是 |

## 8. 再走一遍完整过程

### 8.1 对象转换过程

一次同步调用经历了下面几次转换：

```text
Java 方法和参数
→ RpcInvocation
→ Request
→ 网络字节
→ Provider RpcInvocation
→ HelloServiceImpl 返回值
→ RpcResult
→ Response
→ 网络字节
→ Consumer RpcResult
→ Java 返回值或业务异常
```

每次转换都有自己的目的：Invocation 描述调用，Request 和 Response 负责请求配对，网络层负责跨进程传输，Result 负责表达返回值和业务异常

### 8.2 按执行顺序回顾

```text
Consumer 调用 helloService.sayHello("world")
→ 接口代理创建 RpcInvocation
→ Directory 给出候选 Provider
→ Router 过滤，LoadBalance 选择
→ Cluster 按容错策略执行
→ Consumer 发出带请求 ID 的 Request
→ 请求通过现有连接到达 Provider
→ Provider 切换到业务线程
→ 根据服务信息找到本地 Invoker
→ Provider Filter 准备调用上下文
→ Invoker 调用 HelloServiceImpl.sayHello()
→ 返回值包装成 RpcResult 和 Response
→ Consumer 根据请求 ID 找到 Future
→ 等待线程被唤醒
→ 接口代理返回字符串或抛出业务异常
```

整条链路里，注册中心负责地址发现，Directory 保存候选节点，Cluster 处理选择与容错，Request ID 和 Future 负责响应配对，Provider 的本地服务表负责从远程请求回到本地 Bean

业务代码只写了一次 `sayHello()`，Dubbo 做的工作就是把这次本地调用拆开、传到另一台机器执行，再把结果完整地拼回来
