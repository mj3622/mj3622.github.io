---
title: 深入理解 Sentinel 限流底层原理：从 Entry 到 FlowSlot 的完整执行链路
published: 2026-03-23
description: 从一次请求进入 Sentinel 开始，系统梳理 Entry、Slot 链、StatisticSlot、FlowSlot 与 RT 统计的底层执行机制，理解 Sentinel 如何完成高性能限流。
tags: [Java, Sentinel, 限流, 微服务]
category: 经验分享
draft: false
---

在微服务系统里，限流的本质不是“简单拦截请求”，而是**在系统还能承受的时候尽量放行，在压力过高时及时保护服务**。Sentinel 之所以被广泛使用，核心就在于它把“统计”和“决策”拆开做，并通过一条可扩展的处理链把整个过程串起来。

很多文章介绍 Sentinel 时，都会直接讲规则配置，但如果你没搞清楚一次请求在 Sentinel 内部究竟经历了什么，就很难真正理解它为什么能做到快速、稳定、可扩展。本文就沿着一次请求的真实执行路径，从 `SphU.entry()` 一路讲到 `entry.exit()`，把 Sentinel 的限流底层原理串起来。

## Sentinel 执行主线

### 先建立整体认识：一次请求在 Sentinel 中如何流转

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

如果只记一句话，可以记成：

> Sentinel 的限流核心流程就是：先进入执行上下文，再做统计，再按规则判断，最后在退出时完成结算。

这里最关键的几个角色分别是：

- `Entry`：一次资源访问的生命周期载体。
- `ProcessorSlotChain`：责任链式处理流水线。
- `StatisticSlot`：负责实时统计。
- `FlowSlot`：负责依据流控规则做限流判断。
- `exit()`：负责在请求结束时补全统计闭环。

### 从 `SphU.entry()` 开始：为什么 Sentinel 一定要有 Entry

业务中最常见的 Sentinel 接入方式通常长这样：

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

很多人第一次看会以为 `Entry` 只是一个“标记对象”，其实远不止如此。它至少承担了四件事：

- 表示一次对资源的访问。
- 关联当前调用上下文 `Context`。
- 驱动整条 Slot 链执行。
- 在 `exit()` 时补齐线程数、RT、异常等统计信息。

换句话说，`Entry` 不是 Sentinel 的附属品，而是 Sentinel 所有能力得以运转的执行载体。没有 `Entry`，后续的统计、限流、熔断、系统保护都无从谈起。

#### `entry()` 阶段发生了什么

当你调用 `SphU.entry("getUser")` 时，Sentinel 不只是“登记一下资源名”，而是会做一系列动作：

1. 获取或创建当前线程对应的 `Context`。
2. 根据资源名生成对应的资源包装对象。
3. 创建 `Entry`，并把它挂到当前调用链上。
4. 让请求进入 `ProcessorSlotChain`，开始执行各个 Slot。

所以 `entry()` 的真正含义不是“进入一个方法”，而是“将当前请求正式纳入 Sentinel 的治理体系”。

#### `exit()` 阶段为什么同样重要

很多线上问题不是出在 `entry()`，而是出在忘记 `exit()`。  
如果没有在 `finally` 里调用 `entry.exit()`，至少会带来三类问题：

- 当前线程数可能无法正确回收。
- RT 统计不完整，导致后续规则判断失真。
- 调用链状态没有正常闭环，影响后续统计和分析。

因此，`entry()` 是开始，`exit()` 才是结算。两者必须成对出现。

## 核心组件与处理机制

### Slot 链：Sentinel 为什么既快又容易扩展

Sentinel 的内部处理模型并不是把所有逻辑堆在一个大方法里，而是使用了一条 `ProcessorSlotChain`。这是一种典型的责任链模式，每个 Slot 只关心自己的一件事。

一条典型的处理链中，可能会出现这些能力节点：

- `NodeSelectorSlot`：构建资源调用路径。
- `ClusterBuilderSlot`：构建统计节点。
- `StatisticSlot`：记录通过数、线程数、异常数、RT 等指标。
- `FlowSlot`：做流量控制判断。
- `AuthoritySlot`：做黑白名单判断。
- `DegradeSlot`：做熔断降级判断。
- `SystemSlot`：做系统负载保护。

这篇文章聚焦“限流”主线，所以重点看两个最核心的环节：`StatisticSlot` 和 `FlowSlot`。

这种设计的好处很明显：

- 每个模块职责单一，便于理解和维护。
- 新能力可以通过新增 Slot 扩展，而不是改一堆旧逻辑。
- 执行顺序明确，统计和规则判断天然分层。

### `StatisticSlot`：Sentinel 如何感知当前流量

限流判断之前，系统必须先知道“现在到底来了多少请求”。这件事就是 `StatisticSlot` 负责的。

#### 为什么 Sentinel 使用滑动窗口

如果只用一个“当前秒计数器”来算 QPS，会有一个典型问题：**边界抖动**。  
例如某一秒的最后 100ms 和下一秒的前 100ms 同时涌入大量请求，简单按整秒统计就可能出现误差，无法真实反映瞬时流量压力。

Sentinel 为了解决这个问题，使用了滑动时间窗口。它会把统计周期拆成多个小时间片（bucket），然后在窗口内聚合这些 bucket 的数据。

在默认的秒级统计场景下，常见配置可以理解为：

- 统计窗口：1 秒
- 样本桶：通常拆成多个 bucket
- 每个 bucket：记录该时间片内的流量指标

相比“单个整秒计数器”，滑动窗口更平滑，也更接近真实流量。

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

如果说 `StatisticSlot` 负责“看清楚现场”，那么 `FlowSlot` 负责“做决定”。

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

很多人以为 Sentinel 限流只有“超过阈值直接拒绝”这一种，其实它背后还可以选择不同的控制器，例如：

- 直接拒绝：超过阈值立即抛出 `BlockException`。
- 预热模式：让系统从较低阈值逐渐升到目标阈值，避免冷启动时被瞬时流量打爆。
- 匀速排队：不直接失败，而是让请求按稳定速率排队通过。

也就是说，`FlowSlot` 不只是“if 超了就拦”，而是会根据规则配置选择不同的流量整形策略。

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
这也是 Sentinel 的关键价值之一：**在系统被压垮之前，先保护系统本身**。

## 关键指标与理解误区

### RT 到底统计的是什么

RT 是很多人理解 Sentinel 时最容易混淆的指标之一。

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

所以理解 RT 时，一定要记住一句话：

> RT 的统计范围，取决于你把 `Entry` 包在了哪里。

这也是为什么不同团队接入 Sentinel 后，看到的 RT 数据可能差异很大。统计口径不一致，不代表 Sentinel 算错了，而是包裹范围不同。

### 为什么说 `Entry` 是 Sentinel 所有能力的基础

现在回头看，你会发现 `Entry` 几乎贯穿了整个流程。如果没有它，至少以下能力都会失效或失真：

- 无法准确统计 RT，因为系统不知道一段受保护代码从哪里开始、在哪里结束。
- 无法维护实时线程数，因为没有统一的进入和退出时机。
- 无法串起调用链，因为上下文和资源访问关系缺少载体。
- 无法驱动 Slot 链，因为所有规则判断都需要一个统一入口。

因此，Sentinel 真正的设计不是“围绕规则表做判断”，而是“围绕一次受控访问建立完整生命周期”。

### 理解 Sentinel 限流时最容易踩的几个误区

#### 误区一：限流就是一个计数器加判断

这只说对了一小部分。Sentinel 真正的关键在于：

- 用滑动窗口解决统计精度问题。
- 用责任链拆分不同治理能力。
- 用不同控制器支持快速失败、预热、匀速排队等模式。

所以它不是一个“高级版 if 判断”，而是一套完整的流量治理执行框架。

#### 误区二：被限流的请求也会进入业务逻辑

在正常情况下不会。  
`FlowSlot` 是在业务逻辑执行前完成判断的，一旦触发规则，会直接抛出 `BlockException`，请求不会继续向后执行核心业务代码。

#### 误区三：`exit()` 可有可无

这是很危险的误解。  
如果你漏掉 `exit()`，统计数据会失真，线程数和 RT 都可能不准确，进而影响后续流控判断。最稳妥的写法始终是把它放进 `finally`。

#### 误区四：RT 就是接口总耗时

也不完全对。  
Sentinel 看到的是 `Entry` 包裹范围内的耗时，不是整个链路上所有环节的端到端耗时。它更像“受保护资源执行耗时”，而不是完整的前后端体验耗时。

## 总结

### 面试或复盘时可以这样总结

如果你需要用一段话快速讲清楚 Sentinel 的限流底层逻辑，可以直接用下面这段：

> 在 Sentinel 中，请求进入时会通过 `SphU.entry()` 创建 `Entry` 并绑定调用上下文，然后进入 `ProcessorSlotChain`。`StatisticSlot` 基于滑动窗口记录通过数、线程数、异常数和 RT 等实时指标，`FlowSlot` 再结合流控规则和当前统计结果判断请求是否应该被放行。如果通过，请求继续执行业务；执行结束后通过 `entry.exit()` 回写线程数和 RT，从而形成完整的统计闭环。

### 一句话收尾

Sentinel 的限流本质上不是“超过阈值就拒绝”这么简单，而是通过 `Entry` 管理一次访问生命周期，借助 Slot 链拆分治理职责，再基于滑动窗口统计和 `FlowSlot` 规则判断，在业务执行前完成精细化的流量控制。

### 主要参考

- [Sentinel 官方文档](https://sentinelguard.io/zh-cn/docs/introduction.html)
- [Sentinel GitHub 仓库](https://github.com/alibaba/Sentinel)
