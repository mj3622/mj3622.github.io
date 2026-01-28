---
title: Java虚拟线程简介
published: 2026-01-28
description: 本文介绍了Java虚拟线程的概念、工作原理、使用方法以及其适用的场景。
tags: [Java, 虚拟线程]
category: 编程实践
draft: false
---

# 引言：Project Loom 的里程碑

在 Java 21 正式发布之前，Java 的并发编程模型长期依赖于操作系统级别的线程（Platform Threads）。虽然这种模型稳定且强大，但在面对高并发、高吞吐量的 IO 密集型场景时，往往会遇到资源瓶颈。

为了解决这个问题，OpenJDK 推出了 **Project Loom**，并在 JDK 19 和 JDK 20 中作为预览特性引入，最终在 **JDK 21** 中正式成为标准特性（JEP 444）。虚拟线程（Virtual Threads）的出现，被认为是 Java 历史上最重要的更新之一，它彻底改变了我们在 JVM 上构建高并发应用的方式。

本文将详细介绍虚拟线程的概念、工作原理、使用方法以及其最适用的具体场景。

# 什么是虚拟线程？

传统的 Java 线程（`java.lang.Thread`）直接包装了操作系统线程（OS Thread）。这意味着 Java 线程与 OS 线程通常是 **1:1** 的关系。

* **昂贵**：创建和销毁 OS 线程需要系统调用，消耗大量内存（通常栈空间为 MB 级别）和 CPU 资源。
* **数量受限**：受限于操作系统资源，单机通常只能支撑几千个活跃线程。

**虚拟线程** 则是 **JDK 管理的轻量级线程**。

* **轻量**：它不直接绑定特定的 OS 线程。
* **M:N 模型**：大量虚拟线程可以复用少量的 OS 线程（称为 Carrier Threads）。
* **低开销**：创建成本极低，栈空间可以随着使用自动伸缩，单机可以轻松创建数百万个虚拟线程。

# 典型应用场景详解

虚拟线程并不是为了取代所有线程，它的优势主要体现在 **IO 密集型（I/O Bound）** 任务中。以下是三个最典型的使用场景：

**1. 高并发 Web 服务器（High-Throughput Servers）**

这是虚拟线程最直接的受益场景。传统的 Web 容器（如 Tomcat）通常使用一个包含 200-500 个线程的线程池来处理请求。当请求通过 JDBC 查询数据库或调用外部 API 时，线程会阻塞。一旦并发请求数超过线程池大小，新的请求就必须排队，导致吞吐量上不去。

* **传统模式**：依赖线程池大小，每个请求占用一个 OS 线程。
* **虚拟线程模式**：Spring Boot 3.2+ 已经内置支持。只需开启配置 `spring.threads.virtual.enabled=true`，容器就会为**每一个 HTTP 请求**创建一个新的虚拟线程。
* **效果**：即使是单机，也能轻松处理数万甚至数十万的并发连接，因为在等待数据库响应时，虚拟线程被挂起，不占用 OS 资源。

**2. 微服务聚合（Scatter-Gather Pattern）**

在微服务架构中，一个聚合层服务（BFF）往往需要同时调用多个下游服务（如用户服务、订单服务、库存服务），然后组装结果返回给前端。

* **场景**：你需要并行调用 5 个外部 API，每个 API 耗时 200ms。
* **优势**：使用虚拟线程，你可以廉价地为这 5 个调用分别启动 5 个虚拟线程。代码写起来就像同步代码一样直观（不需要 `CompletableFuture` 的复杂链式调用），但底层却是完全非阻塞的。

```java
// 伪代码示例：结构化并发（Structured Concurrency）
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Future<User> user = scope.fork(() -> userService.findUser(id));
    Future<Order> order = scope.fork(() -> orderService.findOrder(id));
    
    scope.join(); // 等待所有子任务完成
    scope.throwIfFailed(); // 如果有异常则抛出
    
    return new Response(user.result(), order.result());
}

```

**3. 大规模数据抓取与批处理**

如果你在编写一个网络爬虫或需要处理大量的 S3 文件下载任务：

* **场景**：需要同时下载 10,000 张图片或抓取 10,000 个网页。
* **痛点**：传统线程池开不了 10,000 个线程，只能分批次慢慢跑。
* **虚拟线程解法**：可以直接通过 `Executors.newVirtualThreadPerTaskExecutor()` 提交 10,000 个任务。JVM 会自动调度，在网络 IO 等待时切换任务，极大缩短整体执行时间。

# 如何使用虚拟线程

JDK 提供了几种新的 API 来创建和使用虚拟线程：

**1. 直接启动虚拟线程**

```java
// 使用静态构建器方法
Thread.startVirtualThread(() -> {
    System.out.println("Running in a virtual thread: " + Thread.currentThread());
});

// 使用 Builder 模式
Thread vThread = Thread.ofVirtual()
    .name("my-virtual-thread")
    .start(() -> {
        System.out.println("Hello from Builder!");
    });

```

**2. 使用 ExecutorService**

这是迁移旧代码最常用的方式。`Executors` 新增了 `newVirtualThreadPerTaskExecutor()`。注意，这个执行器并不像传统线程池那样“池化”线程，而是**为每个任务创建一个新的虚拟线程**。

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    IntStream.range(0, 10_000).forEach(i -> {
        executor.submit(() -> {
            Thread.sleep(Duration.ofSeconds(1));
            return i;
        });
    });
} // try-with-resources 会自动等待所有任务完成

```

# 工作原理：Mounting 与 Unmounting

虚拟线程的核心机制在于它如何由 JVM 调度。

1. **载体线程（Carrier Thread）**：JVM 维护了一个 `ForkJoinPool`（通常是全局的），其中的工作线程充当“载体线程”。虚拟线程必须要被“挂载”（Mount）到载体线程上才能执行。
2. **非阻塞挂起**：当虚拟线程执行阻塞操作（例如 IO 操作、`Thread.sleep`、`Lock` 等待）时，JVM 会检测到这一行为。
3. **卸载（Unmount）**：JVM 会将该虚拟线程从载体线程上“卸载”，将其堆栈状态保存到堆内存中。
4. **释放资源**：此时，载体线程被释放，可以去执行其他的虚拟线程。
5. **恢复执行**：当阻塞操作完成（如数据到达），JVM 会恢复该虚拟线程，重新将其“挂载”到一个可用的载体线程上继续执行。

# 注意事项与“陷阱”

虽然虚拟线程很强大，但它不是银弹，使用时需注意以下几点：

**1. 不要池化虚拟线程**
传统线程池（FixedThreadPool）的目的是为了复用昂贵的线程资源。但虚拟线程非常廉价，**永远不需要池化**。每次需要并发任务时，直接创建新的虚拟线程即可。

**2. 避免长时间的 CPU 密集型计算**
虚拟线程主要优势在于 IO 等待时释放资源。如果是纯 CPU 计算任务（如视频转码、复杂数学运算），虚拟线程并不会比传统线程更快，反而可能因为调度开销略慢。

**3. Pinning（线程钉住）问题**
在某些情况下，虚拟线程会被“钉住”（Pinned）在载体线程上，导致无法卸载。即使发生阻塞，载体线程也会被阻塞。主要场景包括：

* 在 `synchronized` 块或方法内部执行阻塞操作。
* 执行 Native 方法（JNI）时。

**解决方案**：如果代码中有大量 `synchronized` 导致的 Pinning 问题，建议将其替换为 `ReentrantLock`。

# 总结

Java 虚拟线程的引入是革命性的。它让开发者回归到简单、直观的**同步编程模型**（Thread-per-request），同时享受到了**异步编程的高并发性能**。

* **最适合**：Spring Boot Web 服务、微服务调用聚合、爬虫、大量数据库操作。
* **不适合**：CPU 密集型计算。

随着 JDK 21 的普及，由于其极低的迁移成本，虚拟线程将成为未来 Java 后端开发的默认并发模型。