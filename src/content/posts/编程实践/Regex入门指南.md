---
title: Regex 入门指南：如何在 Java 中优雅地处理字符串
published: 2025-08-25
description: 本文介绍了正则表达式（Regex）的基本概念和语法，重点讲解了如何在 Java 中使用 Regex 进行字符串匹配、提取和替换操作。
tags: [编程实战, Java, 正则表达式]
category: 编程实战
draft: false
---

在编程的世界里，处理字符串是家常便饭。无论是校验用户输入的邮箱格式，还是从杂乱的日志中提取关键信息，字符串操作都无处不在。

如果你还在用一堆复杂的 `indexOf`、`substring` 和 `if-else` 嵌套来处理文本，那么是时候掌握**正则表达式 (Regular Expressions)** 这个强大的武器了。

## 什么是正则表达式？

正则表达式（简称 Regex）是一种用于匹配字符串中字符组合的模式（Pattern）。你可以把它想象成一种**“超级查找与替换”**的规则语言。

虽然它的语法看起来像乱码（比如 `^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$`），但一旦掌握了它，你就能用一行代码解决几十行逻辑才能完成的任务。

---

## 核心语法速查表

在深入 Java 代码之前，我们需要先了解 Regex 的通用符号。

**1. 元字符 (Metacharacters)**

- `.` ：匹配除换行符以外的任意字符。
- `^` ：匹配字符串的**开始**。
- `$` ：匹配字符串的**结束**。

**2. 字符类 (Character Classes)**

- `\d` ：匹配数字 (0-9)。
- `\w` ：匹配字母、数字或下划线 (Word character)。
- `\s` ：匹配空白字符（空格、Tab、换行）。
- `[abc]` ：匹配方括号内的任意一个字符（a 或 b 或 c）。
- `[^abc]` ：匹配**除了**方括号内字符以外的任意字符。

**3. 量词 (Quantifiers)**

- `*` ：出现 0 次或多次。
- `+` ：出现 1 次或多次。
- `?` ：出现 0 次或 1 次。
- `{n}` ：精确出现 n 次。
- `{n,m}` ：出现 n 到 m 次。

> **⚠️ Java 中的特殊注意事项**
> 在 Java 字符串中，反斜杠 `\` 是转义字符。因此，当你要表示 Regex 中的 `\d` 时，必须写成 **`"\\d"`**。

---

## Java 中的 Regex 实战

Java 在 `java.util.regex` 包中提供了两个核心类来处理正则：

1. **`Pattern`**：正则表达式的编译表示（规则）。
2. **`Matcher`**：对输入字符串进行解释和匹配操作的引擎（执行者）。

### 场景一：数据校验 (Validation)

这是最常见的场景，例如检查手机号是否合法。

```java
import java.util.regex.Pattern;
import java.util.regex.Matcher;

public class RegexDemo {
    public static void main(String[] args) {
        // 规则：以1开头，第二位是3-9，后面接9位数字
        String regex = "^1[3-9]\\d{9}$";
        String phoneNumber = "13800138000";

        // 方法1：直接使用 String 类的 helper 方法（适合简单的一次性检查）
        boolean isValidSimple = phoneNumber.matches(regex);
        System.out.println("Simple Check: " + isValidSimple);

        // 方法2：使用 Pattern 和 Matcher（适合高性能或复杂逻辑）
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(phoneNumber);

        // matches() 要求整个字符串完全匹配
        if (matcher.matches()) {
            System.out.println("这是一个有效的手机号");
        } else {
            System.out.println("手机号格式错误");
        }
    }
}

```

### 场景二：信息提取 (Extraction)

假设我们有一段日志，需要从中提取订单号。

**文本：** `[INFO] User created order: ORD-20230521-X99 in system.`
**目标：** 提取 `ORD-20230521-X99`

```java
import java.util.regex.Pattern;
import java.util.regex.Matcher;

public class ExtractionDemo {
    public static void main(String[] args) {
        String logEntry = "[INFO] User created order: ORD-20230521-X99 in system.";

        // 使用圆括号 () 创建捕获组
        // 规则：匹配 "ORD-" 开头，后面跟任意非空字符
        String regex = "(ORD-[\\w-]+)";

        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(logEntry);

        // find() 用于查找子串，不同于 matches()
        if (matcher.find()) {
            // group(0) 是整个匹配到的串
            // group(1) 是第一个括号内匹配到的内容
            String orderId = matcher.group(1);
            System.out.println("提取到的订单号: " + orderId);
        }
    }
}

```

### 场景三：文本替换与脱敏 (Replacement)

在保护隐私时，我们经常需要把敏感信息（如身份证、银行卡）中间部分替换为星号。

```java
public class ReplaceDemo {
    public static void main(String[] args) {
        String input = "My credit card is 4555-1234-5678-9012, please charge it.";

        // 规则：匹配四组数字，中间可能有连字符
        // 我们想保留前4位和后4位，中间替换为 ****
        // 使用分组：$1 代表第一组，$2 代表第二组...
        String regex = "(\\d{4})-\\d{4}-\\d{4}-(\\d{4})";

        // 替换逻辑：保留第一组和最后一组，中间硬编码为 ****-****
        String result = input.replaceAll(regex, "$1-****-****-$2");

        System.out.println(result);
        // 输出: My credit card is 4555-****-****-9012, please charge it.
    }
}

```

---

## 性能优化建议

在 Java 中使用 Regex 时，有一个常见的性能陷阱。

如果你在一个**循环**中频繁调用 `String.matches(...)` 或 `Pattern.compile(...)`，性能会非常差，因为每次调用都会重新编译正则表达式。

**最佳实践：**
将 `Pattern` 定义为 `static final` 常量，只编译一次，重复使用。

```java
public class UserValidator {
    // 预编译 Pattern，提升性能
    private static final Pattern EMAIL_PATTERN =
        Pattern.compile("^[\\w.-]+@[\\w.-]+\\.[a-z]{2,}$");

    public boolean validateEmail(String email) {
        if (email == null) return false;
        return EMAIL_PATTERN.matcher(email).matches();
    }
}

```

## 结语

正则表达式虽然入门时有些晦涩，但它是程序员工具箱里不可或缺的神器。从简单的表单验证到复杂的爬虫解析，Regex 都能助你一臂之力。

建议使用在线工具（如 [Regex101](https://regex101.com/)）来编写和测试你的正则，然后再将其放入 Java 代码中。
