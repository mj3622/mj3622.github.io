---
title: KMP算法
published: 2025-01-01
description: 本文将介绍介绍字符串匹配领域中KMP算法的流程，并使用Java进行实现。
tags: [算法]
category: 编程实践
draft: false

---

# 1. 暴力搜索

暴力搜索是最直观的字符串匹配算法。它的基本思想是从主串（文本）的每一个位置开始，逐个字符与模式串进行比较，直到找到完全匹配的子串或遍历完整个主串。

其实现步骤如下：

1. 从主串的第一个字符开始，与模式串的第一个字符进行比较。
2. 如果匹配成功，继续比较主串和模式串的下一个字符。
3. 如果匹配失败，主串的起始位置向后移动一位，重新开始比较。
4. 重复上述过程，直到找到匹配的子串或主串遍历完毕。

```java
// 暴力搜索实现代码
public static int bruteForce(String text, String pattern) {
    int n = text.length(); 
    int m = pattern.length();

    for (int i = 0; i <= n - m; i++) {
        int j;
        for (j = 0; j < m; j++) {
            if (text.charAt(i + j) != pattern.charAt(j)) {
                break; 
            }
        }
        if (j == m) {
            return i;
        }
    }
    return -1;
}
```

这种方法非常的简单直观，但是在最坏的情况下，它的时间复杂度为 $O(m×n)$，其中 m 是主串的长度，n 是模式串的长度。为了解决时间复杂度过高的问题，我们需要一种新的方法来实现。



# 2. KMP算法

**KMP算法（Knuth-Morris-Pratt算法）** 是一种用于字符串匹配的高效算法。它的核心思想是通过预处理模式串（pattern），构建一个部分匹配表（也称为 失败函数 或 next数组 ），从而在匹配过程中避免不必要的回溯，提高匹配效率。

其实现步骤如下所示：

1. 预处理模式串，构建部分匹配表（next数组）。next数组记录了模式串中每个位置之前的最长相同前缀和后缀的长度。
2. 从主串的第一个字符开始，与模式串的第一个字符进行比较。
3. 如果匹配成功，继续比较主串和模式串的下一个字符。
4. 如果匹配失败，根据next数组跳过模式串中已经匹配的部分，继续比较。
5. 重复上述过程，直到找到匹配的子串或主串遍历完毕。



## 2.1 构建部分匹配表

```java
private static int[] computeNextArray(String pattern) {
    int[] next = new int[pattern.length()];
    next[0] = -1;
    int i = 0, j = -1;

    while (i < pattern.length() - 1) {
        if (j == -1 || pattern.charAt(i) == pattern.charAt(j)) {
            i++;
            j++;
            next[i] = j;
        } else {
            // 匹配失败，将j回退到上一个可能匹配的位置
            j = next[j];
        }
    }

    return next;
}
```

1. **初始化**：
   - `next[0] = -1`：表示模式串的第一个字符没有前缀，值为-1。
   - `i = 0`：用于遍历模式串。
   - `j = -1`：表示当前最长相同前缀和后缀的长度。
2. **循环构建Next数组**：
   - 如果 `j == -1` 或者 `pattern.charAt(i) == pattern.charAt(j)`：
     - 说明当前字符匹配，`i` 和 `j` 都向后移动一位。
     - `next[i] = j`：记录当前位置的最长相同前缀和后缀的长度。
   - 如果字符不匹配：
     - `j = next[j]`：利用已经计算好的Next数组，将 `j` 回退到上一个可能匹配的位置。

> [!TIP]
>
> **为什么首位要设置为-1**
>
> `next[0] = -1` 表示模式串的第一个字符（`P[0]`）没有真前缀（即空字符串）。同时作为一个特殊标记，用于在匹配过程中指示模式串的第一个字符匹配失败时，主串的指针应该向后移动一位，而不是模式串的指针移动。

下面，将以模式串`ABABCABAB`为例，介绍构建的整体流程：

| 索引 `i` | 字符 `P[i]` | `j`  | 条件判断                  | 操作               | Next数组更新                                 |
| :------- | :---------- | :--- | :------------------------ | :----------------- | :------------------------------------------- |
| 0        | A           | -1   | `j == -1`                 | `i++`, `j++`       | `next[1] = 0`                                |
| 1        | B           | 0    | `P[i] != P[j]` (`B != A`) | `j = next[j] = -1` | -                                            |
| 1        | B           | -1   | `j == -1`                 | `i++`, `j++`       | `next[2] = 0`                                |
| 2        | A           | 0    | `P[i] == P[j]` (`A == A`) | `i++`, `j++`       | `next[3] = 1`（前缀 `"A"` 和后缀 `"A"`）     |
| 3        | B           | 1    | `P[i] == P[j]` (`B == B`) | `i++`, `j++`       | `next[4] = 2`（前缀 `"AB"` 和后缀 `"AB"`）   |
| 4        | C           | 2    | `P[i] != P[j]` (`C != A`) | `j = next[j] = 0`  | -                                            |
| 4        | C           | 0    | `P[i] != P[j]` (`C != A`) | `j = next[j] = -1` | -                                            |
| 4        | C           | -1   | `j == -1`                 | `i++`, `j++`       | `next[5] = 0`                                |
| 5        | A           | 0    | `P[i] == P[j]` (`A == A`) | `i++`, `j++`       | `next[6] = 1`（前缀 `"A"` 和后缀 `"A"`）     |
| 6        | B           | 1    | `P[i] == P[j]` (`B == B`) | `i++`, `j++`       | `next[7] = 2`（前缀 `"AB"` 和后缀 `"AB"`）   |
| 7        | A           | 2    | `P[i] == P[j]` (`A == A`) | `i++`, `j++`       | `next[8] = 3`（前缀 `"ABA"` 和后缀 `"ABA"`） |



## 2.2 匹配过程

```java
public static int kmpSearch(String text, String pattern) {
    int[] next = computeNextArray(pattern);
    int i = 0, j = 0;

    while (i < text.length() && j < pattern.length()) {
        if (j == -1 || text.charAt(i) == pattern.charAt(j)) {
            i++;
            j++;
        } else {
            j = next[j];
        }
    }

    if (j == pattern.length()) {
        // 返回匹配的起始位置
        return i - j; 
    } else {
        // 未找到匹配
        return -1; 
    }
}
```

1. **初始化**：
   - `i = 0`：用于遍历主串。
   - `j = 0`：用于遍历模式串。
2. **循环匹配**：
   - 如果 `j == -1`：表示 `text.charAt(i)` 与模式串首位不匹配，主串向后移动一位重新开始匹配。
   - 如果 `text.charAt(i) == pattern.charAt(j)`：说明当前字符匹配，`i` 和 `j` 都向后移动一位，继续匹配。
   - 如果字符不匹配：`j = next[j]`：根据Next数组，将模式串向右移动，跳过不必要的比较。
3. **匹配成功**：
   - 如果 `j == pattern.length()`，说明模式串完全匹配，返回匹配的起始位置 `i - j`。
4. **匹配失败**：
   - 如果主串遍历完毕仍未找到匹配，返回 `-1`。

---

至此，KMP算法的内容就全部介绍完成。如果您想验证自己实现的KMP算法是否正确，可以前往[LeetCode - 找出字符串中第一个匹配项的下标](https://leetcode.cn/problems/find-the-index-of-the-first-occurrence-in-a-string/)进行验证。