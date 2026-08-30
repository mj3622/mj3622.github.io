---
title: Sentinel 限流原理：从 Entry 到 FlowSlot
published: 2026-03-23
description: 沿一次请求的执行路径理解 Entry、Slot 链、StatisticSlot、FlowSlot 与 RT 统计
tags: [Java, Sentinel, 限流, 微服务]
category: 经验分享
draft: false
---

Sentinel 把实时统计和规则判断分开处理，再通过 Slot 链组织调用过程。理解这条执行路径后，规则配置、RT 口径和 `exit()` 的作用就容易对应到源码。

下面从 `SphU.entry()` 跟到 `entry.exit()`，观察一次受保护的请求如何完成统计和限流判断。

## Sentinel 执行主线

### 一次请求的执行路径

先看一条简化后的执行链路：

```text
业务请求
  -> SphU.entry("resourceName")
  -> 创建 Entry，绑定 Context
  -> 进入 ProcessorSlotChain
  -> StatisticSlot 记录统计数据
  -> FlowSlot 根据规则判断是否放行
  -> 放行后执行业务逻辑
  -> entry.exit() 回写 RT、线程数等指标
```

这条链路先建立执行上下文，再更新统计、检查规则，最后在退出时补全本次调用的数据。

这里最关键的几个角色分别是：

- `Entry`：一次资源访问的生命周期载体。
- `ProcessorSlotChain`：责任链式处理流水线。
- `StatisticSlot`：负责实时统计。
- `FlowSlot`：负责依据流控规则做限流判断。
- `exit()`：负责在请求结束时补全统计闭环。

### `Entry` 负责什么

常见的 Sentinel 接入方式如下：

```java
Entry entry = null;
try {
    entry = SphU.entry("getUser");
    return userService.getUser();
} catch (BlockException ex) {
    return fallbackUser();
} finally {
    if (entry != null) {
        entry.exit();
    }
}
```

`Entry` 不只是资源标记，它还承担以下职责：

- 表示一次对资源的访问。
- 关联当前调用上下文 `Context`。
- 驱动整条 Slot 链执行。
- 在 `exit()` 时补齐线程数、RT、异常等统计信息。

`Entry` 记录一次资源访问的起点、上下文和调用关系，后续统计与规则判断都依赖这些信息。

#### `entry()` 阶段发生了什么

调用 `SphU.entry("getUser")` 时，Sentinel 会执行以下操作：

1. 获取或创建当前线程对应的 `Context`。
2. 根据资源名生成对应的资源包装对象。
3. 创建 `Entry`，并把它挂到当前调用链上。
4. 让请求进入 `ProcessorSlotChain`，开始执行各个 Slot。

完成这些步骤后，当前请求就进入 Sentinel 的统计和规则处理链。

#### `exit()` 阶段为什么同样重要

忘记调用 `exit()` 会让统计状态无法正常收尾。没有在 `finally` 中执行 `entry.exit()` 时，常见影响包括：

- 当前线程数可能无法正确回收。
- RT 统计不完整，导致后续规则判断失真。
- 调用链状态没有正常闭环，影响后续统计和分析。

因此，`entry()` 和 `exit()` 必须成对出现。

## 核心组件与处理机制

### Slot 链的分工

Sentinel 使用 `ProcessorSlotChain` 组织内部处理逻辑。每个 Slot 负责一类统计或规则检查，并按固定顺序传递请求。

一条典型的处理链中，可能会出现这些能力节点：

- `NodeSelectorSlot`：构建资源调用路径。
- `ClusterBuilderSlot`：构建统计节点。
- `StatisticSlot`：记录通过数、线程数、异常数、RT 等指标。
- `FlowSlot`：做流量控制判断。
- `AuthoritySlot`：做黑白名单判断。
- `DegradeSlot`：做熔断降级判断。
- `SystemSlot`：做系统负载保护。

这里重点看与限流直接相关的 `StatisticSlot` 和 `FlowSlot`。

这种拆分带来几个直接结果：

- 每个模块职责单一，便于理解和维护。
- 新能力可以通过新增 Slot 扩展，而不是改一堆旧逻辑。
- 执行顺序明确，统计和规则判断天然分层。

### `StatisticSlot`：Sentinel 如何感知当前流量

`StatisticSlot` 负责提供限流判断所需的实时请求数据。

#### 为什么 Sentinel 使用滑动窗口

只用“当前秒计数器”计算 QPS 会受到整秒边界影响。例如流量集中在前一秒的最后 100ms 和后一秒的最初 100ms 时，两个计数区间都可能低估短时间内的压力。

Sentinel 使用滑动时间窗口，把统计周期拆成多个时间片（bucket），再聚合窗口内的数据。

在默认的秒级统计场景下，常见配置可以理解为：

- 统计窗口：1 秒
- 样本桶：通常拆成多个 bucket
- 每个 bucket：记录该时间片内的流量指标

相比单个整秒计数器，滑动窗口对边界流量的反映更连续。

#### `StatisticSlot` 背后的核心数据结构

可以把它理解成下面这层关系：

```text
Node
  -> LeapArray
      -> MetricBucket
```

其中：

- `Node`：某个资源或调用维度的统计节点。
- `LeapArray`：管理整个滑动窗口。
- `MetricBucket`：窗口中的一个时间片。

每个 `MetricBucket` 中通常会维护这些指标：

- `pass`：通过数。
- `block`：拦截数。
- `exception`：异常数。
- `threadNum`：当前并发线程数。
- `rt`：累计响应时间。

#### 请求进入和退出时分别统计什么

请求刚进入时，`StatisticSlot` 主要会做“入场登记”：

```text
pass++
threadNum++
```

请求结束时，再做“离场结算”：

```text
threadNum--
rt += 本次执行耗时
```

如果请求期间抛出业务异常，异常指标也会被记录。  
正因为有了这套统计，后面的 `FlowSlot` 才能基于实时数据做出决策。

### `FlowSlot`：真正决定是否限流的地方

`FlowSlot` 读取 `StatisticSlot` 提供的数据，并按流控规则决定放行或拦截。

它的工作逻辑可以概括为四步：

1. 找出当前资源对应的流控规则。
2. 读取实时统计结果。
3. 按规则类型选择具体控制器。
4. 判断当前请求是放行还是拦截。

#### 第一步：读取资源对应的流控规则

Sentinel 会先根据资源名找到对应规则，概念上类似：

```java
List<FlowRule> rules = FlowRuleManager.getRules(resourceName);
```

如果当前资源没有配置流控规则，那么 `FlowSlot` 直接放行，不做限流。

#### 第二步：基于统计结果计算当前压力

有了 `StatisticSlot` 提供的实时数据后，`FlowSlot` 才能判断当前资源是否超阈值。  
以最常见的 QPS 模式为例，它的核心判断可以粗略理解为：

```text
currentQps = 窗口内所有 bucket 的 pass 总和
```

然后再拿 `currentQps` 和规则阈值作比较。

#### 第三步：根据控制效果选择不同的流控策略

Sentinel 可以按配置选择不同的流控策略：

- 直接拒绝：超过阈值立即抛出 `BlockException`。
- 预热模式：让系统从较低阈值逐渐升到目标阈值，避免冷启动时被瞬时流量打爆。
- 匀速排队：不直接失败，而是让请求按稳定速率排队通过。

`FlowSlot` 会根据规则选择直接拒绝、预热或匀速排队等处理方式。

#### 第四步：放行还是拦截

在默认配置下，最常见的是：

- 限流维度：QPS
- 流控模式：直接
- 控制效果：快速失败

这时可以把它抽象理解为：

```java
if (currentQps > threshold) {
    throw new BlockException();
}
```

一旦触发限流，请求会在真正执行业务逻辑之前被拦截。  
这样可以在业务逻辑运行前拒绝超限请求，避免负载继续放大。

## 关键指标与理解误区

### RT 到底统计的是什么

RT 的统计范围由 `Entry` 包裹的位置决定。

#### RT 的准确含义

在 Sentinel 里，RT 指的是：

> 从 `entry()` 成功返回到 `exit()` 调用之间，这段代码实际执行所消耗的时间。

它统计的是你包裹在 `Entry` 里面那部分业务逻辑，而不是一个 HTTP 请求从客户端发起到浏览器收到响应的完整耗时。

#### 一个最直观的例子

```java
Entry entry = SphU.entry("getUser");
try {
    userService.getUser();
} finally {
    entry.exit();
}
```

在这段代码里，RT 统计的是：

```text
userService.getUser() 这段受 Entry 包裹代码的执行时间
```

通常不包含以下内容：

- 网络传输耗时。
- Web 容器在 `entry()` 之前做的解析与路由。
- `exit()` 之后的额外处理逻辑。
- 没有被 `Entry` 包裹的其他代码。

不同接入位置会得到不同的 RT 数据。出现差异时，应先核对 `Entry` 的包裹范围，而不是直接比较数值。

### 为什么说 `Entry` 是 Sentinel 所有能力的基础

`Entry` 贯穿整个处理流程，缺少它会直接影响以下能力：

- 无法准确统计 RT，因为系统不知道一段受保护代码从哪里开始、在哪里结束。
- 无法维护实时线程数，因为没有统一的进入和退出时机。
- 无法串起调用链，因为上下文和资源访问关系缺少载体。
- 无法驱动 Slot 链，因为所有规则判断都需要一个统一入口。

Sentinel 以一次资源访问的生命周期组织上下文、统计和规则判断。

### 理解 Sentinel 限流时最容易踩的几个误区

#### 误区一：限流就是一个计数器加判断

这只说对了一小部分。Sentinel 真正的关键在于：

- 用滑动窗口解决统计精度问题。
- 用责任链拆分不同治理能力。
- 用不同控制器支持快速失败、预热、匀速排队等模式。

这些组件共同完成实时统计、规则选择和请求拦截。

#### 误区二：被限流的请求也会进入业务逻辑

在正常情况下不会。  
`FlowSlot` 是在业务逻辑执行前完成判断的，一旦触发规则，会直接抛出 `BlockException`，请求不会继续向后执行核心业务代码。

#### 误区三：`exit()` 可有可无

漏掉 `exit()` 会使线程数和 RT 等统计失真，进而影响后续流控判断。应始终在 `finally` 中调用它。

#### 误区四：RT 就是接口总耗时

Sentinel 统计的是 `Entry` 包裹范围内的耗时，不是整个链路的端到端耗时。

## 调用链总结

请求进入时，`SphU.entry()` 创建 `Entry` 并绑定调用上下文，随后进入 `ProcessorSlotChain`。`StatisticSlot` 基于滑动窗口维护通过数、线程数、异常数和 RT，`FlowSlot` 再结合规则与实时数据决定是否放行。业务执行结束后，`entry.exit()` 回写线程数和 RT，完成本次调用的统计。

### 主要参考

- [Sentinel 官方文档](https://sentinelguard.io/zh-cn/docs/introduction.html)
- [Sentinel GitHub 仓库](https://github.com/alibaba/Sentinel)
