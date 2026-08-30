---
title: Z 算法原理与 Java 实现
published: 2026-01-30
description: 介绍 Z 算法的原理、计算流程与字符串匹配场景
tags: [算法, 字符串匹配, Java]
category: 编程实践
draft: false
---

# 什么是 Z 算法？

Z 算法（Z-Algorithm）是一种线性时间字符串匹配算法，用来计算字符串 `S` 的每个后缀与 `S` 本身的最长公共前缀（Longest Common Prefix，LCP）长度。

算法生成数组 `Z`，其中 `Z[i]` 表示后缀 `S[i...]` 与原字符串 `S` 的最长公共前缀长度。

以字符串 `S = "aabcaabxaa"` 为例，长度为 10，`Z` 数组如下：

| i   | S[i] | S[i...]    | 与 S 的 LCP                | z[i]                 |
| --- | ---- | ---------- | -------------------------- | -------------------- |
| 0   | a    | aabcaabxaa | (自身)                     | 10 (通常记为 0 或 n) |
| 1   | a    | abcaabxaa  | "a" vs "aab..." -> "a"     | 1                    |
| 2   | b    | bcaabxaa   | "b" vs "aab..." -> ""      | 0                    |
| 3   | c    | caabxaa    | "c" vs "aab..." -> ""      | 0                    |
| 4   | a    | aabxaa     | "aab" vs "aab..." -> "aab" | 3                    |
| 5   | a    | abxaa      | "ab" vs "aab..." -> "a"    | 1                    |
| 6   | b    | bxaa       | "b" vs "aab..." -> ""      | 0                    |
| 7   | x    | xaa        | "x" vs "aab..." -> ""      | 0                    |
| 8   | a    | aa         | "aa" vs "aab..." -> "aa"   | 2                    |
| 9   | a    | a          | "a" vs "aab..." -> "a"     | 1                    |

# 核心概念：Z-Box (匹配区间)

Z 算法通过复用已有匹配结果达到 `O(n)` 时间复杂度。计算过程中维护区间 `[l, r]`，称为 **Z-box**。

- `[l, r]` 是当前最靠右、且与 `S` 前缀相同的子串区间。
- `S[l...r]` 等于 `S[0...r-l]`。
- 计算 `Z[i]` 时，根据 `i` 是否落在 `[l, r]` 内决定能否复用已有结果。

# 算法流程详解

从 `i = 1` 遍历到 `n - 1`。`Z[0]` 通常记为 `0` 或 `n`，其余位置在计算 `Z[i]` 后按需更新 `[l, r]`。

分两种情况讨论：

**情况 1：当前位置 在 Z-box 之外 ()**

这意味着我们没有任何历史信息可以利用。

- **操作**：直接从 和 开始朴素比较（暴力匹配），直到字符不相等为止。
- **更新**：计算出 后，如果 ，我们将 更新为 。此时 。

**情况 2：当前位置 在 Z-box 之内 ()**

这意味着 被包含在之前匹配过的段中。因为 与 相同，所以 对应的前缀位置是 。
我们可以利用已经计算过的 来加速。此时又细分为两种子情况：

- **子情况 2a：**
- 含义：对应位置 的 LCP 长度没有超出当前 Z-box 的剩余长度。
- **操作**：直接令 。因为已知 Z-box 边界 之后是不匹配的，或者内部结构限制了长度，所以不需要再往后看。
- **更新**： 保持不变。
- **子情况 2b：**
- 含义：对应位置 的匹配长度触碰到了或超过了 。
- **操作**：我们至少知道从 到 这一段是匹配的。但是 之后的部分我们不知道。所以，我们需要从 位置开始，继续与前缀进行朴素比较，尝试扩展匹配。
- **更新**：根据新扩展的匹配长度更新 ，并更新 和 。

# 代码实现 (Java)

```Java
import java.util.Arrays;

public class ZAlgorithm {

    /**
     * 计算字符串的 Z 数组
     *
     * @param s 输入字符串
     * @return z 数组，z[i] 表示后缀 s[i...] 与 s 的最长公共前缀长度
     */
    public static int[] zFunction(String s) {
        int n = s.length();
        int[] z = new int[n];

        // l 和 r 维护当前的 Z-box，即区间 [l, r]
        // 初始时 l = r = 0
        for (int i = 1, l = 0, r = 0; i < n; ++i) {
            // 情况 2：当前位置 i 在 Z-box 内 (i <= r)
            // 我们可以利用已知的 z[i - l] 来初始化 z[i]
            // min 的作用是防止访问越过当前的 Z-box (即不超过 r - i + 1)
            if (i <= r) {
                z[i] = Math.min(r - i + 1, z[i - l]);
            }

            // 尝试向后扩展匹配 (朴素比较)
            // 无论是由情况 1 (i > r) 进入，还是情况 2 中初始化后继续尝试，都通过此循环处理
            while (i + z[i] < n && s.charAt(z[i]) == s.charAt(i + z[i])) {
                z[i]++;
            }

            // 如果匹配延伸超过了当前的 r，更新 Z-box 的边界
            if (i + z[i] - 1 > r) {
                l = i;
                r = i + z[i] - 1;
            }
        }
        return z;
    }

    public static void main(String[] args) {
        String s = "aabcaabxaa";
        int[] z = zFunction(s);

        System.out.println("String: " + s);
        System.out.println("Z-array: " + Arrays.toString(z));

        // 简单测试模式匹配应用
        // 查找 pattern "aab" 在 text "baabaa" 中的位置
        // 构造 S = P + "$" + T -> "aab$baabaa"
        String pattern = "aab";
        String text = "baabaa";
        String concat = pattern + "$" + text;
        int[] zConcat = zFunction(concat);

        System.out.println("\nPattern Matching Example:");
        System.out.println("Combined String: " + concat);
        for (int i = 0; i < zConcat.length; i++) {
            // 如果某位置的 Z 值等于模式串长度，说明匹配成功
            if (zConcat[i] == pattern.length()) {
                // 计算在原文本中的索引
                // i - (pattern.length() + 1)
                System.out.println("Pattern found at index: " + (i - pattern.length() - 1));
            }
        }
    }
}
```

# Z 算法的应用

Z 算法最经典的应用是**模式串匹配**，完全可以替代 KMP 算法。

假设要在文本串 中查找模式串 ：

1. 构造新字符串 。其中 是一个既不在 也不在 中出现的特殊分隔符。
2. 对 计算 Z 数组。
3. 遍历 Z 数组中对应 的部分（即下标从 开始）。
4. 如果某处的 等于 ，说明从该位置开始匹配到了完整的模式串 。

**其他应用：**

- **查找字符串的周期**：利用 且 的性质。
- **前缀作为子串出现的次数**。
- **最长回文子串**（结合 Manacher 算法思想）。

# 总结

Z 算法是一种代码极其简短（核心逻辑仅约 10 行），但功能强大的字符串算法。它的 复杂度和直观的“匹配区间”逻辑，使其在处理前缀匹配、重复结构等问题时非常高效。理解了 Z-box 的维护过程，就掌握了 Z 算法的精髓。
