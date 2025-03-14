---
title: Java在刷题过程中的经验总结
published: 2024-12-11
description: 本文总结了在使用Java刷题过程中的一些经验，包括ACM模式下的输入输出，常用的辅助工具类等内容
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



#### 格式说明符

| **说明符** | **数据类型**         | **功能描述**                      | **示例**                               | **输出**             |
| ---------- | -------------------- | --------------------------------- | -------------------------------------- | -------------------- |
| `%d`       | 整数（十进制）       | 按十进制输出整数                  | `System.out.printf("%d", 42);`         | `42`                 |
| `%x`       | 整数（十六进制）     | 按十六进制输出整数，字母小写      | `System.out.printf("%x", 42);`         | `2a`                 |
| `%X`       | 整数（十六进制）     | 按十六进制输出整数，字母大写      | `System.out.printf("%X", 42);`         | `2A`                 |
| `%o`       | 整数（八进制）       | 按八进制输出整数                  | `System.out.printf("%o", 42);`         | `52`                 |
| `%f`       | 浮点数               | 按十进制输出浮点数，默认 6 位小数 | `System.out.printf("%.2f", 3.14159);`  | `3.14`               |
| `%e`       | 浮点数（科学计数法） | 按科学计数法输出浮点数，小写 e    | `System.out.printf("%e", 12345.678);`  | `1.234568e+04`       |
| `%E`       | 浮点数（科学计数法） | 按科学计数法输出浮点数，大写 E    | `System.out.printf("%E", 12345.678);`  | `1.234568E+04`       |
| `%g`       | 浮点数（通用格式）   | 自动选择 `%f` 或 `%e` 格式        | `System.out.printf("%g", 0.0001234);`  | `1.23400e-04`        |
| `%G`       | 浮点数（通用格式）   | 同 `%g`，但指数为大写 E           | `System.out.printf("%G", 0.0001234);`  | `1.23400E-04`        |
| `%c`       | 单个字符             | 输出对应的单个字符                | `System.out.printf("%c", 'A');`        | `A`                  |
| `%s`       | 字符串               | 输出字符串                        | `System.out.printf("%s", "Hello");`    | `Hello`              |
| `%b`       | 布尔值               | 输出布尔值的字符串形式            | `System.out.printf("%b", true);`       | `true`               |
| `%n`       | 平台无关的换行符     | 输出一个平台相关的换行符          | `System.out.printf("Line 1%nLine 2");` | `Line 1`<br>`Line 2` |
| `%%`       | 百分号               | 输出一个百分号                    | `System.out.printf("%%");`             | `%`                  |



#### 格式修饰符

| **修饰符** | **功能描述**                            | **示例**                              | **输出**    |
| ---------- | --------------------------------------- | ------------------------------------- | ----------- |
| `%.nf`     | 指定小数点后保留 `n` 位小数             | `System.out.printf("%.2f", 3.14159);` | `3.14`      |
| `%m.nf`    | 指定宽度 `m`，小数点后保留 `n` 位       | `System.out.printf("%8.2f", 3.14);`   | `    3.14`  |
| `%-m.nf`   | 左对齐，宽度为 `m`，小数点后保留 `n` 位 | `System.out.printf("%-8.2f", 3.14);`  | `3.14    `  |
| `%0mf`     | 宽度为 `m`，不足用 0 补齐               | `System.out.printf("%08.2f", 3.14);`  | `00003.14`  |
| `%,d`      | 对整数添加千位分隔符                    | `System.out.printf("%,d", 1000000);`  | `1,000,000` |
| `%(d`      | 对负数括起来显示                        | `System.out.printf("%(d", -42);`      | `(42)`      |
| `%+#d`     | 显示整数的正负号                        | `System.out.printf("%+d", 42);`       | `+42`       |
| `% .nf`    | 浮点数前加空格（正数），负数直接显示    | `System.out.printf("% .2f", 3.14);`   | ` 3.14`     |



# 3. 常用类方法

## 3.1 字符串处理

### **1. String 类**

`String` 是 Java 中用于表示字符序列的不可变类。一旦 `String` 对象被创建，其内容无法被更改。



**常用方法**

- `length()`：获取字符串长度。
- `charAt(int index)`：获取指定索引处的字符。
- `substring(int beginIndex, int endIndex)`：截取子字符串。
- `indexOf(String str)`：查找子字符串的索引。
- `toUpperCase()` 和 `toLowerCase()`：转换大小写。
- `trim()`：去除字符串两端的空格。
- `replace(CharSequence target, CharSequence replacement)`：替换子字符串。
- `split(String regex)`：根据正则表达式分割字符串。



### 2. StringBuilder 类

`StringBuilder` 是一个可变类，用于高效地操作字符串内容。



**常用方法**

- `append(String str)`：在末尾追加字符串。
- `insert(int offset, String str)`：在指定位置插入字符串。
- `delete(int start, int end)`：删除指定范围内的字符。
- `replace(int start, int end, String str)`：替换指定范围内的字符。
- `reverse()`：反转字符串。
- `toString()`：将 `StringBuilder` 对象转换为 `String`。



### 3. 正则表达式

#### 元字符

| 元字符  | 描述                                                |
| ------- | --------------------------------------------------- |
| `.`     | 匹配任意单个字符（除了换行符）。                    |
| `^`     | 匹配行的开头。                                      |
| `$`     | 匹配行的结尾。                                      |
| `*`     | 匹配前面的字符 0 次或多次。                         |
| `+`     | 匹配前面的字符 1 次或多次。                         |
| `?`     | 匹配前面的字符 0 次或 1 次。                        |
| `[]`    | 匹配括号内的任意一个字符（字符类）。                |
| `{n}`   | 匹配前面的字符刚好 n 次。                           |
| `{n,}`  | 匹配前面的字符至少 n 次。                           |
| `{n,m}` | 匹配前面的字符至少 n 次，至多 m 次。                |
| `|`     | 表示“或”操作。                                      |
| `()`    | 分组，用于提取子模式或限定范围。                    |
| `\\`    | 转义字符，用于匹配元字符本身（如 `\\.` 匹配点号）。 |



#### 字符类

| 字符类   | 描述                                         |
| -------- | -------------------------------------------- |
| `\\d`    | 匹配任意数字（0-9）。                        |
| `\\D`    | 匹配非数字。                                 |
| `\\w`    | 匹配任意字母、数字或下划线（[a-zA-Z0-9_]）。 |
| `\\W`    | 匹配非字母、数字或下划线。                   |
| `\\s`    | 匹配任意空白字符（空格、制表符等）。         |
| `\\S`    | 匹配非空白字符。                             |
| `[abc]`  | 匹配括号内的任意一个字符 a、b 或 c。         |
| `[^abc]` | 匹配除 a、b、c 之外的任意字符。              |
| `[a-z]`  | 匹配小写字母 a 到 z。                        |
| `[A-Z]`  | 匹配大写字母 A 到 Z。                        |
| `[0-9]`  | 匹配数字 0 到 9。                            |



#### 量词

| 量词    | 描述                                 |
| ------- | ------------------------------------ |
| `*`     | 匹配前面的字符 0 次或多次。          |
| `+`     | 匹配前面的字符 1 次或多次。          |
| `?`     | 匹配前面的字符 0 次或 1 次。         |
| `{n}`   | 匹配前面的字符刚好 n 次。            |
| `{n,}`  | 匹配前面的字符至少 n 次。            |
| `{n,m}` | 匹配前面的字符至少 n 次，至多 m 次。 |



#### 边界条件

| 边界符 | 描述                             |
| ------ | -------------------------------- |
| `^`    | 匹配字符串的开头。               |
| `$`    | 匹配字符串的结尾。               |
| `\\b`  | 匹配单词边界（单词开头或结尾）。 |
| `\\B`  | 匹配非单词边界。                 |



#### 在Java中使用

**使用 String 类**

- `split(String regex)`：按正则表达式分割字符串。
- `matches(String regex)`：检查字符串是否完全匹配正则表达式。
- `replaceAll(String regex, String replacement)`：替换所有匹配的部分。
- `replaceFirst(String regex, String replacement)`：替换第一个匹配的部分。





## 3.2 队列

### 1. 优先队列

在 Java 中，`PriorityQueue` 是一个基于优先级的队列，位于 `java.util` 包中。它实现了 Queue 接口，是一个最小堆（min-heap）的实现，用于按优先级顺序存储元素。

- 元素的优先顺序由其自然顺序（`Comparable` 实现）或自定义比较器（`Comparator`）决定。
- 队列的头部是按优先级排序的最小元素。



**常用方法**

| 方法                         | 说明                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `boolean add(E e)`           | 添加元素到队列中，若容量不足会扩容。                         |
| `boolean offer(E e)`         | 与 `add` 类似，但更适合在容量受限时使用，提供失败时返回 `false`。 |
| `E poll()`                   | 获取并移除队列头部元素，若队列为空，返回 `null`。            |
| `E peek()`                   | 获取但不移除队列头部元素，若队列为空，返回 `null`。          |
| `boolean remove(Object o)`   | 移除队列中指定的元素，若存在返回 `true`，否则返回 `false`。  |
| `boolean contains(Object o)` | 检查队列中是否包含指定元素。                                 |
| `int size()`                 | 返回队列中的元素数量。                                       |
| `void clear()`               | 清空队列。                                                   |



**自定义排序**

```java
// lambda表达式
PriorityQueue<Integer> pq = new PriorityQueue<>(
    (a, b) -> a - b)
);
```

返回值含义：

1. **负值**（`< 0`）：表示 `a` 的优先级 **小于** `b`，即 `a` 排在 `b` 前面。
2. **零**（`== 0`）：表示 `a` 和 `b` 的优先级 **相等**，它们的相对顺序可以视为相同。
3. **正值**（`> 0`）：表示 `a` 的优先级 **大于** `b`，即 `a` 排在 `b` 后面。



## 3.3 流处理

### 1. 将集合转化成数组

```java
ArrayList<Integer> list = new ArrayList<>();
int[] array = list.stream().mapToInt(Integer::intValue).toArray();
```

