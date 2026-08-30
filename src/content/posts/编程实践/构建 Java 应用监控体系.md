---
title: 使用 Micrometer 与 Prometheus 构建 Java 应用监控体系
published: 2026-02-01
description: 介绍在 Spring Boot 3.x 中接入 Micrometer 和 Prometheus，采集 JVM 与业务指标并对外暴露
tags: [Java, 监控, Micrometer, Prometheus]
category: 编程实践
draft: false
---
# Java 应用为什么需要指标监控

服务拆分到微服务或 Kubernetes 后，实例数量、调用关系和资源竞争都会增加。只在故障发生后查日志，往往很难及时发现响应变慢、错误率上升或内存持续增长。

可观测性通常包括日志、链路追踪和指标监控。Metrics 关注聚合后的数值与趋势，适合用来发现延迟、错误率和资源占用的异常变化。

Java 应用常用 Micrometer 采集指标，再由 Prometheus 定期抓取和保存。

## 1. 工具定位：解耦与存储

要理解这两者的配合关系，首先需要明确它们各自在监控体系中的角色：

**Micrometer：统一指标采集接口**

正如 SLF4J 统一了 Log4j、Logback 等日志框架的接口一样，Micrometer 旨在为 Java 平台上的监控指标采集提供一个统一的门面（Facade）。

它提供了一套与监控后端解耦的接口，例如 `Counter`、`Timer` 和 `Gauge`。应用只需要针对 Micrometer API 埋点；切换 Prometheus、Datadog、InfluxDB 或 Elastic 等后端时，通常调整依赖和配置即可，不必重写业务埋点。

**Prometheus：指标存储与查询**

Prometheus 是一个开源的系统监控和报警工具包，它本质上是一个**时序数据库（TSDB）**。与传统监控系统的主动推送（Push）模式不同，Prometheus 采用 **拉取（Pull）** 模式。这意味着我们的 Java 应用只需要暴露一个 HTTP 端点（Endpoint），Prometheus 服务端会按照配置的时间间隔，定期来“抓取”当前的指标数据。

Prometheus 提供 PromQL、时序数据存储和 Kubernetes 服务发现能力，适合保存和查询 Micrometer 暴露的指标。

## 2. 搭建目标

下面以 **Spring Boot 3.x** 为例，演示 Micrometer 的接入和以下几类指标：

1. **基础接入**：引入依赖并开启 Actuator 端点，将 JVM 标准指标暴露给 Prometheus。
2. **业务埋点**：使用 Micrometer 的核心 API 实现自定义业务监控（如 API 请求计数、关键逻辑耗时统计）。
3. **数据验证**：确保 Prometheus 能够正确采集数据，并验证数据格式的正确性。

通过掌握这套组合拳，你将能够为应用构建起一套可视化、可量化的健康监测体系。

# 核心概念解析

在使用 Micrometer 进行埋点之前，我们需要深入理解其核心抽象。Micrometer 的设计哲学与 SLF4J 类似，它不直接产生数据，而是定义了一套标准化的 API 来“记录”数据。

## 1. Meter Registry（指标注册表）

`MeterRegistry` 是 Micrometer 的入口和核心容器。你可以把它想象成应用中的“记账本”或“仪表盘控制器”。

- **功能**：它负责创建、维护所有的监控指标（Meters），并将这些指标格式化为底层监控系统（如 Prometheus）能够识别的数据格式。
- **在 Spring Boot 中**：Spring Boot Actuator 会自动配置一个 `PrometheusMeterRegistry` 并注入到 Spring 容器中。我们只需要在业务代码中通过依赖注入获取 `MeterRegistry` 实例，即可开始埋点。

```java
// Spring 自动注入示例
@Service
public class OrderService {
    private final MeterRegistry registry;

    public OrderService(MeterRegistry registry) {
        this.registry = registry;
    }
}

```

## 2. Meter 类型详解

Micrometer 提供了多种类型的 Meter（指标）来应对不同的监控场景。选择正确的 Meter 类型是获取准确数据的关键。

### 2.1 Counter（计数器）

- **定义**：一种**只增不减**的计数器。
- **行为**：它从 0 开始，每次事件发生时调用 `increment()`。它类似于汽车的**里程表**。
- **适用场景**：

  - API 请求总量（`http_requests_total`）
  - 任务完成总数
  - 异常/错误发生的总次数
- **Prometheus 特性**：Prometheus 会存储 Counter 的累加值。在查询时，我们可以使用 PromQL 的 `rate()` 或 `increase()` 函数来计算其**增长速率**（例如：每秒请求数 QPS）。

### 2.2 Gauge（仪表盘）

- **定义**：反映应用程序当前**瞬时状态**的数值。
- **行为**：数值可以自由升高或降低。它类似于汽车的**速度表**或**转速表**。
- **关键区别**：与 Counter 不同，你通常不是手动“设置” Gauge 的值，而是告诉 Micrometer 去“观察”某个对象的属性。Micrometer 会在 Prometheus 抓取数据时，实时读取该属性的值。
- **适用场景**：
  - 当前 CPU 使用率
  - 内存使用量
  - 线程池中活跃线程数
  - 队列（Queue）中的待处理消息堆积量

### 2.3 Timer（计时器）

- **定义**：用于测量短时间事件的**耗时**以及**发生频率**。
- **行为**：Timer 是最复杂的指标类型之一。当你记录一个事件的耗时时，Micrometer 实际上在后台为你记录了至少两个值：

  1. **Count**：事件发生的总次数（类似于 Counter）。
  2. **Sum**：事件消耗的总时间。
  3. **Max**：该时间窗口内的最大耗时（可选）。
- **高级特性**：Timer 支持客户端百分位数（Percentiles，如 P99、P95）和直方图（Histogram），可用于分析长尾延迟。
- **适用场景**：

  - HTTP 接口响应时间
  - 数据库 SQL 查询耗时
  - 关键业务逻辑的处理时长

### 2.4 DistributionSummary（分布摘要）

- **定义**：用于跟踪**非时间**数据的分布情况。
- **行为**：它的机制与 Timer 几乎一致（记录 Count, Sum, Max），但记录的单位不是“时间”，而是“大小”或“数量”。
- **适用场景**：
  - HTTP 响应体的大小（Response Size in Bytes）
  - 批处理任务中每次处理的记录数
  - I/O 操作的吞吐量

## 3. Tags（标签）：指标维度

传统监控系统（如 Graphite）常用层级命名，例如 `server.us-east.db.error`。如果要跨地区查询 DB 错误，这种命名需要额外的通配符匹配。

Micrometer 使用 Tags（标签或维度）为同一指标补充查询条件。

- **定义**：Tag 是一个 Key-Value 对，用于为指标添加额外的上下文信息。
- **示例**：
  不要创建一个名为 `http_requests_error_500` 的指标。
  **应该**创建一个名为 `http_requests_total` 的指标，并赋予其标签 `status=500`, `method=POST`, `uri=/api/users`。
- **优势**：

  1. **聚合能力**：可以查询 `http_requests_total` 获得总流量，也可以按 `status` 分组查看错误分布。
  2. **基数控制**：不要将 `userId`、`orderId`、`timestamp` 等取值近乎无限的变量作为 Tag。每组唯一的 Tag 组合都会生成新的时间序列，数量过多会明显增加 Prometheus 的内存占用。

> 只有确实需要按某个维度聚合，并且取值范围有限时，才适合将它设为 Tag，例如错误码、地区或实例 ID。

# 环境准备与依赖集成

在开始编写监控代码之前，我们需要搭建好基础的运行环境。Spring Boot 对 Micrometer 的支持非常完善，通过简单的依赖引入和配置，即可实现“零代码”的基础指标暴露。

## 1. 技术栈说明

为了保证实战内容的普适性与时效性，本教程基于以下主流版本进行演示：

- **Java**: JDK 17+ (Spring Boot 3.x 的最低要求)
- **Framework**: Spring Boot 3.x
- **Monitoring System**: Prometheus 2.x

## 2. Maven 依赖引入

在你的 `pom.xml` 中，我们需要引入两个核心组件。请注意，如果你的项目继承自 `spring-boot-starter-parent`，通常不需要手动指定版本号。

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>

    <dependency>
        <groupId>io.micrometer</groupId>
        <artifactId>micrometer-registry-prometheus</artifactId>
    </dependency>
  
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
</dependencies>

```

**依赖解析：**

- **`spring-boot-starter-actuator`**：这是 Spring Boot 提供的生产级特性模块，它自动配置了大量的内置指标（如 JVM 内存、GC、线程池、HTTP 请求统计等），并提供了 HTTP 端点来暴露这些信息。
- **`micrometer-registry-prometheus`**：Actuator 本身收集的数据是通用的，而这个库充当了“翻译官”的角色。它会在 Actuator 中添加一个 `/prometheus` 端点，并将所有指标格式化为 Prometheus 要求的文本格式。

## 3. 配置文件设置 (application.yml)

引入依赖后，我们需要通过配置文件（`application.yml`）来启用 Prometheus 端点，并添加一些全局标识。

```yaml
spring:
  application:
    name: order-service  # 1. 定义应用名称，后续会作为核心 Tag

management:
  endpoints:
    web:
      exposure:
        include: 'prometheus,health,info' # 2. 显式暴露 prometheus 端点
  
  endpoint:
    prometheus:
      enabled: true # 确保插件开启（默认通常为 true）

  metrics:
    tags:
      application: ${spring.application.name} # 3. 配置公共 Tag

```

**关键配置详解：**

1. **端点暴露 (`management.endpoints.web.exposure.include`)**：

   - 出于安全考虑，Spring Boot 默认只暴露 `/health` 和 `/info` 端点。
   - 我们需要显式添加 `prometheus`，这样外部系统才能通过 HTTP 访问到监控数据。
2. **公共标签 (`management.metrics.tags.application`)**：

- **这是微服务监控中最重要的一步配置。**
  - 当你有几十个微服务（Order, User, Payment）同时向 Prometheus 发送数据时，如果没有这个标签，你将无法区分“CPU 使用率 90%”的数据到底来自哪个服务。
  - 配置后，所有从该应用发出的指标都会自动带上 `application=order-service` 的标签，方便后续在 Grafana 中进行过滤和聚合。

## 4. 验证安装

配置完成后，启动 Spring Boot 应用，并在浏览器或通过 `curl` 访问以下地址：

`http://localhost:8080/actuator/prometheus`

如果一切正常，你应该能看到大量如下格式的纯文本数据：

```text
# HELP jvm_memory_used_bytes The amount of used memory
# TYPE jvm_memory_used_bytes gauge
jvm_memory_used_bytes{application="order-service",area="heap",id="G1 Survivor Space",} 1572864.0
jvm_memory_used_bytes{application="order-service",area="heap",id="G1 Old Gen",} 3407872.0
...

```

看到这些数据，说明 Prometheus 已经可以抓取应用指标。下面继续添加与业务相关的自定义指标。

# 实战：自定义业务指标埋点

在完成了基础的 JVM 和系统指标接入后，监控体系的真正价值在于**业务指标**。我们需要知道“有多少订单下单失败了”、“核心算法执行花了多长时间”以及“当前待处理的消息积压了多少”。

本节将通过三个经典场景，演示如何在 Service 层或 Controller 层注入 `MeterRegistry` 并实现自定义埋点。

## 场景一：统计 API 访问次数 (Counter)

这是最基础的监控需求。虽然 Actuator 默认提供了 HTTP 请求的统计，但在某些业务逻辑分支（如“支付失败”或“库存不足”）中，我们需要更细粒度的计数。

**目标**：统计订单创建接口的调用次数，并区分“成功”与“失败”。

```java
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Service;

@Service
public class OrderService {

    private final MeterRegistry registry;

    // 1. 构造器注入 MeterRegistry
    public OrderService(MeterRegistry registry) {
        this.registry = registry;
    }

    public void createOrder(Order order) {
        try {
            // ... 执行核心下单逻辑 ...
      
            // 2. 埋点：记录成功
            // 使用 builder 模式构建，方便添加 Tag
            Counter.builder("business.order.created")
                    .tag("status", "success")
                    .description("Total number of successful orders")
                    .register(registry)
                    .increment(); 
              
        } catch (Exception e) {
            // 3. 埋点：记录失败
            Counter.builder("business.order.created")
                    .tag("status", "failure")
                    .tag("reason", e.getClass().getSimpleName()) // 注意：确保 exception 类名数量有限
                    .description("Total number of failed orders")
                    .register(registry)
                    .increment();
            throw e;
        }
    }
}

```

> 不要分别创建 `order_success_total` 和 `order_failure_total`。可以使用同一个 `business_order_created` 指标，再用 `status=success/failure` 区分结果，方便在 Grafana 中计算总数和成功率。

## 场景二：监控关键业务方法耗时 (Timer)

对于核心业务链路（如结算、推荐算法计算），仅知道平均耗时是不够的，我们需要关注长尾延迟（如 P99，即 99% 的请求都在多少毫秒内完成）。

**目标**：监控 `calculatePrice` 方法的执行耗时及分布。

### 方式 A：编程式埋点（最灵活）

```java
import io.micrometer.core.instrument.Timer;

public void calculatePrice() {
    // 1. 构建 Timer
    Timer timer = Timer.builder("business.price.calculation")
            .publishPercentiles(0.5, 0.95, 0.99) // 重点：开启 P50, P95, P99 直方图统计
            .publishPercentileHistogram()        // 开启 Prometheus 直方图 buckets
            .register(registry);

    // 2. 包装业务逻辑
    timer.record(() -> {
        // 这里放置原本的复杂计算逻辑
        simulateSlowTask();
    });
}

```

### 方式 B：注解式埋点（最简洁）

如果你不想侵入业务代码，可以使用 Spring 的 AOP 切面。

首先在配置类中注册 `TimedAspect` Bean：

```java
@Bean
public TimedAspect timedAspect(MeterRegistry registry) {
    return new TimedAspect(registry);
}

```

然后在方法上添加 `@Timed` 注解：

```java
@Timed(value = "business.price.calculation", histogram = true, percentiles = {0.95, 0.99})
public void calculatePrice() {
    // 业务逻辑...
}

```

## 场景三：监控实时库存或队列深度 (Gauge)

`Gauge` 的逻辑与前两者完全不同。你不需要在数据变化时去“通知” Micrometer，而是要定义“如何获取数据”。Micrometer 会在 Prometheus 来抓取数据的那一刻，去调用你提供的函数。

**目标**：监控内部任务队列的当前积压数量。

```java
import io.micrometer.core.instrument.Gauge;
import org.springframework.stereotype.Component;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

@Component
public class TaskManager {

    // 假设这是一个承载待处理任务的队列
    private final BlockingQueue<Runnable> taskQueue = new LinkedBlockingQueue<>();
  
    public TaskManager(MeterRegistry registry) {
        // 1. 绑定 Gauge
        // 关键点：直接传入被监控的对象 (taskQueue) 和 获取数值的函数 (Queue::size)
        Gauge.builder("business.task.queue.size", taskQueue, BlockingQueue::size)
             .description("Current number of tasks waiting in queue")
             .register(registry);
       
        // 注意：这里不需要调用 .increment() 或 .set()
        // Micrometer 会持有 taskQueue 的弱引用，定期轮询 size() 方法
    }

    public void submitTask(Runnable task) {
        taskQueue.offer(task);
    }
}

```

**⚠️ 避坑指南**：

- 不要对 `Gauge` 使用 `increment()` 操作。如果你发现自己在手动加减一个数字来维护状态，请检查是否应该使用 `Counter`（如果是累加）或者仅仅是让 `Gauge` 观察一个已存在的变量。
- 确保提供给 `Gauge` 的获取数值函数（Supplier）是**非阻塞且高效**的。因为每次 Prometheus 抓取都会触发该函数，如果 `size()` 计算很慢（例如 `Select count(*) from big_table`），会拖慢整个应用。

## 场景四：Metrics Registry 手动设置指标值

Metrics Registry 是 Micrometer 提供的一个管理指标的工具类，可以手动设置指标值。

适用场景：你已经有一个**可随时读取的运行时对象**（例如线程池、连接池、缓存等），希望直接把它的实时属性“绑定”为 Gauge，而不是手动维护数值。这种方式不需要你在业务代码里维护计数，只要指标被抓取时去调用对象的 getter 即可。

比如线程池运行时信息的采集就很典型：`ThreadPoolRuntimeInfo` 持有当前线程池的 `corePoolSize`，可以用 `Metrics.gauge(...)` 直接注册并关联 getter。

`gauge(...)` 的核心行为是：**把对象 + 取值函数注册到注册表**，Micrometer 在采集时调用函数得到实时值。它不会帮你保存状态，也不会“推送”更新；你只需要保证对象是当前的、getter 是快速的即可。方法返回 `Gauge` 实例，通常只需注册一次，后续不必重复调用。

```java
Metrics.gauge(
    "thread_pool.core_pool_size",           // 指标名称
    tags,                                   // 标签
    registerRuntimeInfo,                    // 可长期存活的对象引用
    ThreadPoolRuntimeInfo::getCorePoolSize  // 获取数值的函数
);
```

**注意**：这里的 `registerRuntimeInfo` 必须是可长期存活的对象引用，否则 Gauge 会因为弱引用被回收导致指标“消失”。如果你只是临时创建了对象并立即注册，后续抓取时可能拿不到数据。

# Prometheus 服务端配置与采集

应用已经通过 `/actuator/prometheus` 暴露指标，下一步是在 Prometheus 中配置定时抓取。

## 1. 架构核心：Pull 模式的工作原理

理解 Prometheus 的核心在于理解它的 **Pull（拉取）模式**。

与传统的 Push（推送）模式（应用主动发数据给监控中心）不同，Prometheus 更加主动：

1. **Retrieval（检索）**：Prometheus Server 根据配置文件中的列表，定期（如每 15 秒）去连接应用暴露的 HTTP 端点。
2. **Storage（存储）**：获取到文本格式的指标后，打上时间戳，存储到本地的时间序列数据库中。
3. **Discovery（发现）**：在动态环境中（如 Kubernetes），Prometheus 还可以通过服务发现机制自动找到新的服务实例，而无需手动配置静态 IP。

这种模式的优点在于：**应用与监控系统完全解耦**。如果 Prometheus 挂了，你的业务服务不会受到任何影响（不会因为发送监控数据失败而阻塞）。

## 2. 配置 prometheus.yml

找到 Prometheus 的主配置文件 `prometheus.yml`，我们需要在 `scrape_configs` 节点下增加一个新的任务（Job）。

请重点关注 `metrics_path` 的配置，这是 Spring Boot 与标准 Prometheus 默认行为不同的地方。

```yaml
global:
  scrape_interval: 15s # 全局抓取频率，默认15秒

scrape_configs:
  # ... 其他 job 配置 ...

  # 新增 Spring Boot 应用的抓取任务
  - job_name: 'spring-boot-order-service'
  
    # 【关键】Spring Boot Actuator 暴露的默认路径是 /actuator/prometheus
    # 而 Prometheus 默认找的是 /metrics，所以必须显式覆盖
    metrics_path: '/actuator/prometheus'
  
    # 设置抓取超时时间，防止应用响应慢导致数据丢失
    scrape_timeout: 10s
  
    static_configs:
      # 这里填写你 Java 应用的 IP 和端口
      # 如果 Prometheus 运行在 Docker 中，宿主机 IP 通常是host.docker.internal
      - targets: ['host.docker.internal:8080'] 
        labels:
          env: 'prod' # 可以附加额外的标签，方便后续筛选

```

**配置项解析：**

- **`job_name`**：逻辑分组名称。所有从这里抓取到的数据都会自动带上 `job="spring-boot-order-service"` 的标签。
- **`metrics_path`**：**必填**。Micrometer 默认适配的路径。如果不改，Prometheus 会报 404 错误。
- **`targets`**：目标实例列表。生产环境中通常配合 Consul 或 K8s 进行动态服务发现，但在测试或简单部署中，`static_configs` 足矣。

## 3. 验证采集

配置修改并重启 Prometheus 服务后，我们需要验证数据链路是否打通。

### 第一步：检查 Target 状态

打开 Prometheus 的 Web UI（默认端口 9090），导航至菜单栏的 **Status -> Targets**。

- **State 为 UP (绿色)**：恭喜！配置成功，Prometheus 已经成功连接到你的 Java 应用并抓取到了数据。
- **State 为 DOWN (红色)**：检查 Error 列的信息。常见原因包括网络不通、`metrics_path` 填错（404）、或者应用未启动。

### 第二步：查询 UP 指标

点击导航栏的 **Graph**，在查询框中输入：

```promql
up{job="spring-boot-order-service"}

```

点击 "Execute"。

- 如果返回值为 **1**：代表服务健康在线。
- 如果返回值为 **0**：代表服务无法连接。

这个简单的 `up` 指标是监控中最基础的“心跳”，通常也是我们将要配置的第一条告警规则（如果 `up == 0` 持续 1 分钟，则发送 P0 级告警）。

# 数据可视化：Grafana 集成

如果说 Prometheus 是监控数据的“仓库”，那么 Grafana 就是装修精美的“陈列室”。虽然 Prometheus 自带 Web UI，但它更适合用于调试和临时查询。要实现炫酷的、可聚合多数据源的实时大屏，Grafana 才是最佳拍档。

## 1. 数据源配置

首先，我们需要告诉 Grafana 去哪里读取数据。

1. 登录 Grafana（默认端口 3000）。
2. 点击左侧齿轮图标 **Configuration** -> **Data Sources**。
3. 点击 **Add data source**，选择 **Prometheus**。
4. 在 **HTTP -> URL** 栏中填入 Prometheus 的地址（例如 `http://localhost:9090` 或 Docker 容器名）。
5. 点击底部的 **Save & Test**。如果不出现绿色的 "Data source is working" 提示，请检查网络连通性。

## 2. 使用社区 Dashboard

Grafana 社区已经提供不少 Java 应用 Dashboard，可以先导入现有面板，再按业务需要调整。

### 引入官方 JVM 面板 (ID: 4701)

Micrometer 官方提供了一个非常经典且全面的 Dashboard，能覆盖 90% 的基础监控需求。

- **导入步骤**：点击左侧 **Dashboards** (四方块图标) -> **Import**。
- **输入 ID**：在 "Import via grafana.com" 输入框中填入 **4701**，点击 Load。
- **选择数据源**：在底部下拉框选择刚才配置的 Prometheus 数据源，点击 **Import**。

导入成功后，你将立即看到一个包含以下核心指标的监控大屏：

- **JVM 内存**：Heap/Non-Heap 使用详情，直观发现内存泄漏风险。
- **GC 分析**：GC 次数和暂停时间（Stop The World），可用于排查由 GC 引起的卡顿。
- **线程监控**：当前活跃线程数、Daemon 线程数。
- **CPU 使用率**：JVM 进程占用的系统资源。

### 创建自定义业务面板

导入 JVM 面板后，还可以为前面埋点的业务指标创建单独面板。

1. 新建一个 Dashboard，点击 **Add a new panel**。
2. 在 **Metrics browser** 中输入 PromQL 查询语句。
3. **实战案例**：

- **下单量趋势图**：选择 Time Series 图表，查询 `increase(business_order_created_total[1m])`，展示每分钟新增的订单数。
- **接口耗时热力图**：利用 Timer 指标，展示接口响应时间的分布。

## 3. PromQL 基础查询

要在 Grafana 中画出有意义的图表，掌握基础的 PromQL (Prometheus Query Language) 是必修课。以下是三个最常用的核心函数：

### 3.1 `rate()`：计算速率（QPS）

**适用场景**：Counter 类型指标（如请求总数）。
由于 Counter 是只增不减的，直接画图是一条斜向上的直线，没有意义。我们需要看的是“每秒增长了多少”。

```promql
# 计算过去 5 分钟内，每秒的平均请求数
rate(http_server_requests_seconds_count[5m])

```

*注意：`irate()` 也可以计算速率，它对瞬时变化更敏感，适合查看尖峰；`rate()` 更加平滑，适合做告警和趋势分析。*

### 3.2 `increase()`：计算增量

**适用场景**：业务统计（如过去一小时卖了多少单）。
它计算的是时间区间内数值的**增长量**。

```promql
# 统计过去 1 小时内新增的订单总数
increase(business_order_created_total[1h])

```

### 3.3 Histogram 百分位：计算 P99 延迟

**适用场景**：Timer/DistributionSummary 类型。
这是 PromQL 中最复杂但也最强大的功能。它可以根据 Bucket（桶）数据计算出近似的百分位数。

```promql
# 计算 http 请求的 P99 响应时间（99% 的请求都小于该时间）
histogram_quantile(0.99, sum(rate(http_server_requests_seconds_bucket[5m])) by (le))

```

*解释：先计算每个 bucket 的增长速率，然后聚合，最后利用 `histogram_quantile` 函数估算出 P99 的值。这是评估系统 SLA 的黄金指标。*

# 使用注意事项

使用 Micrometer 和 Prometheus 时，需要重点控制指标基数、统一命名，并为异常状态配置告警。

## 1. 性能隐患：警惕“基数爆炸” (Cardinality Explosion)

高基数是指标系统中常见且代价较高的问题。

在 Prometheus 的设计中，每一个独特的 **Metric Name + Tags 组合** 都会生成一个新的时间序列（Time Series）。这意味着 Tags 的取值空间（即“基数”）必须是**有限且可控的**。

- **不合适的 Tag**：
  将取值无限或极高的变量作为 Tag。
  - `userId="10086"`
  - `orderId="ORDER_20240101_X"`
  - `email="test@example.com"`
  - `timestamp="1698765432"`

如果系统有 100 万用户，并将 `userId` 作为 Tag，单个指标就可能产生 100 万条时间序列，进而消耗大量内存，严重时会导致 Prometheus OOM。

- **适合的 Tag**：
  仅使用有限枚举值的变量作为 Tag。
  - `method="GET"`
  - `status="500"`
  - `region="cn-north-1"`
  - `error_type="NullPointerException"`

> 如果无法枚举一个 Tag 的可能值，或取值可能达到数百种以上，应先评估它带来的时间序列数量。OrderId 等高基数数据更适合写入日志或链路追踪。

## 2. 指标命名

Java 开发者习惯使用 `CamelCase`（驼峰命名）或 `dot.notation`（点号分隔），而 Prometheus 社区的标准规范是 `snake_case`（下划线分隔）。

Micrometer 会自动完成常见的名称转换。

- **建议**：在 Java 代码中，坚持使用点号分隔法，这符合 Java 的语义习惯。

  - 代码中写：`Counter.builder("business.order.created")`
- **结果**：Micrometer 的 Prometheus Registry 会自动将其渲染为：

  - Prometheus 中见：`business_order_created_total`

Prometheus 适配器通常还会为指标添加后缀，用来明确指标类型：

- Counter 类型会自动加上 `_total`。
- Timer/Summary 的 Sum 值会加上 `_sum`，Count 值会加上 `_count`。
- **注意**：在 Grafana 编写 PromQL 时，记得要使用转换后的下划线名称。

## 3. 告警与运行管理

Dashboard 适合查看状态，但不能依赖人工持续观察。对需要及时处理的异常，应配置 Prometheus 告警规则和 Alertmanager 通知。

后续可以继续配置：

1. **配置 Alertmanager**：这是 Prometheus 生态中的告警处理组件。
2. **定义告警规则 (Alert Rules)**：

   * **基础设施层**：`InstanceDown` (up == 0)，`HighCpuUsage` (CPU > 80% for 5m)。

   - **业务层**：`HighErrorRate` (错误率 > 5%)，`SlowResponse` (P99 > 2s)。
3. **集成通知渠道**：将 Alertmanager 对接至钉钉、飞书、Slack 或 PagerDuty。

通过这一套组合拳（Micrometer 埋点 -> Prometheus 采集 -> Grafana 展示 -> Alertmanager 告警），你的 Java 应用将不再是一个黑盒，而是一个透明、可控、健壮的现代化服务。
