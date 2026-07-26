---
title: Dubbo 故障排查
published: 2026-07-26
description: 结合 Dubbo Demo 的真实日志，记录三个调用故障的排查过程。
tags: [Java, Dubbo, RPC, 故障排查]
category: 学习笔记
draft: true
---

为了观察不同故障在日志里是什么样子，我写了三个可以稳定复现问题的 Dubbo Demo。每个 Demo 只设置一个故障条件，再同时查看 Provider 和 Consumer 的输出，把一次调用经过的过程还原出来。

下面只分析日志中直接出现的信息，不展开 Dubbo 的底层实现。日志均来自 Demo 的实际运行，删除的是与当前问题无关的完整行，保留内容没有改写，只移除了行首时间。

## 1. Provider 已注册，为什么还是没有服务可用？

第一个 Demo 从 `No provider available` 开始。为了稳定复现这个错误，Provider 暴露默认分组，Consumer 则请求 `missing-provider` 分组。两端使用同一个 `GreetingService` 接口，只让 `group` 保持不一致。这样 Provider 可以正常注册到 ZooKeeper，Consumer 调用时却找不到符合条件的服务。

运行时先启动 Provider，再启动 Consumer。Provider 端首先出现服务注册日志，其中有 `GreetingService` 的接口名和 `192.168.0.183:20880` 地址：

```text
INFO 99018 --- [           main] c.a.d.r.zookeeper.ZookeeperRegistry      :  [DUBBO] Register: dubbo://192.168.0.183:20880/top.minjer.dubbodemo.service.GreetingService?anyhost=true&application=demo-01-no-provider-provider&bean.name=ServiceBean:top.minjer.dubbodemo.service.GreetingService&client=netty3&dubbo=2.0.2&generic=false&interface=top.minjer.dubbodemo.service.GreetingService&methods=sayHello&pid=99018&server=netty3&side=provider&timestamp=1785072583922, dubbo version: 2.6.12, current host: 192.168.0.183
```

这条 URL 中没有 `group` 参数，说明 Provider 使用的是默认分组。Consumer 调用 `sayHello()` 时打印了下面这条异常：

```text
com.alibaba.dubbo.rpc.RpcException: No provider available from registry 127.0.0.1:2181 for service missing-provider/top.minjer.dubbodemo.service.GreetingService on consumer 192.168.0.183 use dubbo version 2.6.12, please check status of providers(disabled, not registered or in blacklist).
```

异常中的服务名是 `missing-provider/top.minjer.dubbodemo.service.GreetingService`，而 Provider 的注册 URL 中没有 `group`。两端日志对照后可以确认，这个 Demo 复现的是 Provider 与 Consumer 分组不一致，最终导致 `No provider available`。

遇到同类错误时，可以先确认 Provider 是否打印了注册日志，再比较 Provider 注册 URL 和 Consumer 异常中的接口名、`group`。这里最容易误判的是“Provider 已经注册，所以 Consumer 一定能调用”。注册成功只说明服务写入了注册中心，Consumer 的订阅条件仍然可能匹配不到它。

## 2. 已经订阅到 Provider 地址，为什么调用还是失败？

第二个 Demo 复现 `Failed to start NettyClient`。这次先排除分组不一致的影响，让两端都使用 `unreachable` 分组；Provider 正常监听 `20880` 端口，同时故意对外发布无法访问的 `192.0.2.1:20880`。Consumer 能获得 Provider 地址，但连接这个地址时会发生 `client-side timeout`。

先看 Provider 的启动日志，确认它监听的地址和对外发布的地址：

```text
INFO 99075 --- [           main] c.a.d.remoting.transport.AbstractServer  :  [DUBBO] Start NettyServer bind /0.0.0.0:20880, export /192.0.2.1:20880, dubbo version: 2.6.12, current host: 192.168.0.183
```

从这行可以直接看到，服务监听在 `0.0.0.0:20880`，对外发布的是 `192.0.2.1:20880`。

再看 Consumer，它连接的也是 `192.0.2.1:20880`：

```text
WARN 99090 --- [           main] c.a.d.remoting.transport.AbstractClient  :  [DUBBO] Failed to start NettyClient /192.168.0.183 connect to the server /192.0.2.1:20880 (check == false, ignore and retry later!), cause: client(url: dubbo://192.0.2.1:20880/top.minjer.dubbodemo.service.GreetingService?anyhost=true&application=demo-02-unreachable-consumer&bean.name=ServiceBean:top.minjer.dubbodemo.service.GreetingService:unreachable&check=false&client=netty3&codec=dubbo&dubbo=2.0.2&generic=false&group=unreachable&heartbeat=60000&interface=top.minjer.dubbodemo.service.GreetingService&methods=sayHello&pid=99090&qos.enable=false&register.ip=192.168.0.183&remote.timestamp=1785072598137&retries=0&server=netty3&side=consumer&timeout=1000&timestamp=1785072609262) failed to connect to server /192.0.2.1:20880 client-side timeout 3000ms (elapsed: 3009ms) from netty client 192.168.0.183 using dubbo version 2.6.12, dubbo version: 2.6.12, current host: 192.168.0.183
```

`connect to the server /192.0.2.1:20880` 和 Provider 日志中的 `export /192.0.2.1:20880` 对得上。Consumer 等了 `3009ms`，最后得到 `client-side timeout`。

Provider 先发布 `192.0.2.1:20880`，Consumer 随后连接同一个地址，两端日志能够对应起来。这个 Demo 复现的是 Provider 发布了 Consumer 无法访问的地址，最终导致 `Failed to start NettyClient` 和 `client-side timeout`。

排查这类问题时，需要对照 Provider 日志中的 `export` 地址和 Consumer 日志中的 `connect to the server` 地址。如果两边地址一致，但 Consumer 仍然连接超时，就应该继续检查这个地址是否可达。还要注意，这里的 `client-side timeout 3000ms` 发生在连接阶段，请求尚未进入 `sayHello()`，不能把它当成业务方法执行超时。

## 3. 请求已经到达 Provider，为什么 Consumer 还是超时了？

最后一个 Demo 复现 `Waiting server-side response timeout`。两端的服务配置和地址保持正常，只把 Consumer 的超时时间设为 `1000ms`，Provider 收到请求后固定等待 `4000ms`。这样请求可以到达 Provider，但 Consumer 无法在超时时间内拿到响应。

调用发出后，Provider 先打印开始处理请求的日志：

```text
INFO 18645 --- [:20880-thread-2] t.m.d.t.provider.SlowGreetingService     : Provider 开始处理请求，固定阻塞 4000 ms。
```

这条日志说明服务发现和连接都已经完成，请求确实进入了 `SlowGreetingService`。随后 Consumer 打印了超时异常的根因：

```text
Caused by: com.alibaba.dubbo.remoting.TimeoutException: Waiting server-side response timeout. start time: 2026-07-26 22:25:19.159, end time: 2026-07-26 22:25:20.173, client elapsed: 8 ms, server elapsed: 1006 ms, timeout: 1000 ms, request: Request [id=0, version=2.0.2, twoway=true, event=false, broken=false, data=RpcInvocation [methodName=sayHello, parameterTypes=[class java.lang.String, long], arguments=[timeout, 0], attachments={path=top.minjer.dubbodemo.service.GreetingService, interface=top.minjer.dubbodemo.service.GreetingService, version=0.0.0, timeout=1000, group=timeout}, attributes={serialization_id=2}]], channel: /192.168.0.183:59719 -> /192.168.0.183:20880
```

日志中的 `client elapsed` 是 `8ms`，`server elapsed` 是 `1006ms`。当服务端耗时超过 `timeout: 1000 ms` 时，Consumer 将这次调用判定为超时。

Consumer 报错以后，Provider 又打印了处理完成日志：

```text
INFO 18645 --- [:20880-thread-2] t.m.d.t.provider.SlowGreetingService     : Provider 处理完成；但 Consumer 已经在 1000 ms 时超时。
```

随后 Consumer 收到了一条迟到响应警告：

```text
WARN 18732 --- [:20880-thread-1] c.a.d.r.exchange.support.DefaultFuture   :  [DUBBO] The timeout response finally returned at 2026-07-26 22:25:23.201, response Response [id=0, version=null, status=20, event=false, error=null, result=RpcResult [result=Hello, timeout, exception=null]], channel: /192.168.0.183:59719 -> /192.168.0.183:20880, dubbo version: 2.6.12, current host: 192.168.0.183
```

把日志按顺序连起来，Provider 先收到请求，Consumer 等待约一秒后超时，Provider 又在四秒后处理完成。返回的 `Hello, timeout` 最终以迟到响应的形式出现在 Consumer 日志里。这个 Demo 复现的是 Provider 处理时间超过 Consumer 超时时间，最终导致 `Waiting server-side response timeout`。

排查调用超时时，不能只看 Consumer 的异常。还要对照 Provider 的开始和完成日志，再查看 Consumer 是否出现迟到响应。这个场景最需要注意的是：Consumer 超时只表示它没有按时收到结果，不代表 Provider 没有执行。
