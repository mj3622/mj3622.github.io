---
title: Java在ACM模式中的注意事项
published: 2024-12-18
description: 本文将介绍Java在ACM模式中的一些注意事项，为习惯于使用LeetCode或本地IDE的朋友提供一些帮助
tags: [面试]
category: 经验分享
draft: false
---

# 0. 基本结构

在核心模式中都是基于函数编写的，但是在ACM模式下需要按照以下这种格式：

```java
// 手动导包
import java.util.*;

public class Main{
    public static void main(String[] args){
       	// 处理输入
        
       	// 核心逻辑
        
        // 处理输出
    }
}
```



# 1. 基本的包

## 1.1 `java.lang`

`java.lang` 是 Java 核心包，包含了 Java 中最基础的类和接口，默认自动导入，无需显式引入。

- **核心类**
  - `Object`：所有类的父类。
  - `String`：不可变的字符串类。
  - `StringBuilder` 和 `StringBuffer`：可变字符串。
  - `Math`：提供数学运算方法。
  - `System`：提供系统级操作，例如输入输出、环境变量、内存管理等。
  - `Runtime`：与 JVM 交互。
  - `Thread` 和 `Runnable`：用于创建和管理线程。
  - `Class`：表示类的运行时信息。
- **基本类型包装类**
  - 如：`Integer`、`Double`、`Boolean` 等，用于将基本数据类型转换为对象。
- **异常类**
  - `Exception` 和 `Error`：异常处理的核心类。



## 1.2 `java.util`

### **1. 集合框架**

- **Collection**：所有集合接口的根接口。
- **List**：有序集合，允许重复元素。实现类有：
- **Set**：不允许重复元素的集合。实现类有：
- **Queue**：支持队列操作的集合接口。实现类有：
- **Map**：键值对集合。实现类有：



### **2. 工具类**

- **Arrays**：操作数组的工具类，提供排序、搜索、复制等方法。
- **Objects**：操作对象的工具类，提供对空值的安全处理。
- **Collections**：提供集合操作的静态方法，例如排序、查找、同步化等。



### **3. 其他**

- **Scanner**：用于从输入流读取数据。
- **Formatter**：格式化字符串的工具。



## 1.3 `java.math`

提供精确的数学运算，特别是高精度需求。

- **BigDecimal**：高精度的浮点运算。
- **BigInteger**：支持任意大小的整数运算。
- **Math**：基本数学运算。



# 2. 输入与输出

## 2.1 输入

由于输入都是系统的输入流中读取，通常需要创建一个`Scanner sc = new Scanner(System.in)`来读取数据

#### **基本类型输入**

- `nextInt()`：读取整数（`int`）。
- `nextLong()`：读取长整数（`long`）。
- `nextDouble()`：读取双精度浮点数（`double`）。
- `nextFloat()`：读取单精度浮点数（`float`）。
- `nextBoolean()`：读取布尔值（`true` 或 `false`）。



#### **字符串输入**

- `next()`：读取下一个单词（以空白字符为分隔符）。
- `nextLine()`：读取整行输入（包括空格）。



#### **判断是否有下一个输入**

- `hasNextInt()`：检查是否有下一个整数。
- `hasNextDouble()`：检查是否有下一个双精度浮点数。
- `hasNextLine()`：检查是否有下一行。
- `hasNext()`：检查是否有下一个标记（Token）。



## 2.2 输出

#### 基本的输出方法

`System.out` 是标准输出流（`PrintStream` 类的实例），用于将内容输出到控制台。

- 常用方法：
  - `System.out.print(String s)`：输出字符串，不换行。
  - `System.out.println(String s)`：输出字符串，并换行。
  - `System.out.printf(String format, Object... args)`：格式化输出。

示例：

```java
public class Main {
    public static void main(String[] args) {
        System.out.print("Hello"); // 不换行
        System.out.println(" World!"); // 输出后换行
        System.out.printf("I have %d apples and %.2f dollars.%n", 5, 10.50); // 格式化输出
    }
}
```

输出：

```
Hello World!
I have 5 apples and 10.50 dollars.
```



