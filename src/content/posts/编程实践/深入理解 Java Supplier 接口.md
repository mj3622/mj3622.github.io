---
title: 深入理解 Java Supplier 接口：函数式编程的懒加载利器
date: 2025-12-15
description: 本文深入探讨 Java 中的 Supplier 接口，解析其定义、用法及在函数式编程中的重要作用，特别是懒加载（Lazy Evaluation）的实现。
tags: ["Java", "Supplier"]
category: 编程实践
draft: false
---

# 什么是 Supplier？

`Supplier<T>` 是一个泛型接口，它包含一个抽象方法 `get()`。从字面意思理解，它就像一个供应商，当我们需要数据时，调用它的 `get()` 方法，它就会提供一个类型为 `T` 的对象。

**接口定义如下：**

```java
@FunctionalInterface
public interface Supplier<T> {
    /**
     * 获取一个结果
     * @return 结果对象
     */
    T get();
}

```

**特点：**

- **无参数：** `get()` 方法不接受任何输入。
- **有返回值：** 返回一个指定类型 `T` 的数据。
- **工厂属性：** 它可以被看作是一个无需参数的工厂模式。每次调用 `get()`，它可以返回一个新的对象，也可以返回同一个对象（取决于具体实现）。

# 基础语法与实例化

由于 `Supplier` 是函数式接口，我们可以通过 Lambda 表达式或方法引用来快速实例化。

### 1. 使用 Lambda 表达式

这是最常见的写法，逻辑清晰简洁。

```java
// 创建一个 Supplier，用于提供一个随机数
Supplier<Double> randomSupplier = () -> Math.random();

// 调用 get() 获取数据
System.out.println(randomSupplier.get());

```

### 2. 使用方法引用

如果 Lambda 体中只是简单地调用构造函数或静态方法，可以使用方法引用。

```java
// 使用构造函数引用
Supplier<StringBuilder> sbSupplier = StringBuilder::new;

// 相当于 () -> new StringBuilder()
StringBuilder sb = sbSupplier.get();
sb.append("Hello Supplier");
System.out.println(sb.toString());

```

# Supplier 的核心价值：懒加载（Lazy Evaluation）

如果你只是单纯用 `Supplier` 来封装一个对象的创建，可能感觉不到它的强大。`Supplier` 真正的威力在于**延迟执行**。

在传统的 Java 编程中，方法参数在传递之前通常会被立即计算（Eager Evaluation）。而使用 `Supplier` 作为参数时，**只有当真正需要这个数据时，代码才会被执行**。

### 场景一：性能优化与日志记录

假设我们有一个日志记录方法，只有当日志级别为 DEBUG 时才记录日志。

**传统写法（存在性能浪费）：**

```java
public void log(String message) {
    if (isDebugEnabled()) {
        System.out.println(message);
    }
}

// 调用
// 即使 isDebugEnabled() 为 false，generateExpensiveLogMsg() 依然会被执行！
// 这浪费了 CPU 资源去拼接字符串或查询数据库。
log(generateExpensiveLogMsg());

```

**使用 Supplier 优化（懒加载）：**

```java
public void logLazy(Supplier<String> messageSupplier) {
    if (isDebugEnabled()) {
        // 只有进入这里，messageSupplier.get() 才会被调用
        System.out.println(messageSupplier.get());
    }
}

// 调用
// generateExpensiveLogMsg() 被封装在 Lambda 中，暂时不会执行。
// 只有当日志级别满足要求时，才会真正执行该方法。
logLazy(() -> generateExpensiveLogMsg());

```

### 场景二：结合 Optional 使用

`Optional` 类提供了两个类似的方法：`orElse` 和 `orElseGet`。理解它们的区别是掌握 `Supplier` 的关键。

- `orElse(T other)`: 无论 Optional 是否为空，参数 `other` **都会被计算**。
- `orElseGet(Supplier<? extends T> other)`: 只有当 Optional 为空时，**才会调用** `Supplier` 的 `get()` 方法。

**示例代码：**

```java
public User getUser(String id) {
    // 模拟从数据库查询
    return null;
}

public User createDefaultUser() {
    System.out.println("正在创建默认用户..."); // 模拟耗时操作
    return new User("Default");
}

// 演示
User user = getUser("123");

// ❌ 低效做法：
// 即使 user 不为 null，createDefaultUser() 也会被执行
Optional.ofNullable(user).orElse(createDefaultUser());

// ✅ 高效做法：
// 只有当 user 为 null 时，Supplier 才会被触发，createDefaultUser() 才执行
Optional.ofNullable(user).orElseGet(() -> createDefaultUser());

```

# 进阶应用场景

### 1. Stream.generate

Java Stream API 中的 `generate` 方法接受一个 `Supplier`，用于生成无限流。

```java
// 生成 5 个随机数
Stream.generate(() -> Math.random())
      .limit(5)
      .forEach(System.out::println);

```

### 2. 简单的工厂模式

我们可以利用 `Map<String, Supplier<T>>` 来构建一个轻量级的工厂，替代复杂的 `if-else` 或 `switch` 结构。

```java
Map<String, Supplier<Shape>> factory = new HashMap<>();
factory.put("CIRCLE", Circle::new);
factory.put("SQUARE", Square::new);

// 获取实例
Supplier<Shape> shapeSupplier = factory.get("CIRCLE");
Shape circle = shapeSupplier.get();

```

# 特化类型的 Supplier

为了避免基本数据类型（int, double, long, boolean）在装箱和拆箱过程中的性能损耗，Java 提供了对应的特化版本：

| 接口名            | 返回值类型 | 方法名           |
| ----------------- | ---------- | ---------------- |
| `IntSupplier`     | `int`      | `getAsInt()`     |
| `DoubleSupplier`  | `double`   | `getAsDouble()`  |
| `LongSupplier`    | `long`     | `getAsLong()`    |
| `BooleanSupplier` | `boolean`  | `getAsBoolean()` |

**示例：**

```java
IntSupplier intSup = () -> 42;
int result = intSup.getAsInt(); // 无需拆箱，性能更好

```

# 总结

`Supplier` 接口虽然结构简单，但在 Java 函数式编程中扮演着至关重要的角色。

1. **定义**：它不接受参数，返回一个结果。
2. **核心优势**：它是实现**懒加载**（Lazy Evaluation）的标准方式，能够推迟高开销操作的执行，直到真正需要结果的那一刻。
3. **最佳实践**：在设计工具类、配置类或需要性能优化的条件判断逻辑时，优先考虑使用 `Supplier` 来替代直接的对象传递。
