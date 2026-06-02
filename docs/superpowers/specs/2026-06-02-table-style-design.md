# 表格样式优化设计文档

日期：2026-06-02

## 背景

博客当前表格样式存在以下问题：
- `table` 使用 `display: block`，丧失原生表格列宽分配能力
- 窄内容表格无法填满展示区域，右侧留空白
- 所有 `td` 和 `th` 都设置 `white-space: nowrap`，长文本单元格无法换行
- 宽表格滚动行为正常，但窄表格体验差

## 方案选择

经过对比，选择 **方案 A：Wrapper 模式**：
- 给 `<table>` 外面包一个 `<div class="table-wrapper">`
- 滚动行为从 `<table>` 移到 `<div>`
- `<table>` 恢复 `display: table`，原生列宽自动分配
- 窄表格自然填满，宽表格外层 div 滚动

放弃的方案：
- 方案 B（CSS-only）：纯 CSS 改动 `min-width: 100%`，但列宽分配受限
- 方案 C（智能混合）：效果最佳但实现过于复杂

## 实现设计

### 1. 新增 rehype 插件

文件：`src/plugins/rehype-wrap-tables.mjs`

- 使用 `unist-util-visit` 遍历 hast 树
- 找到所有 `<table>` 元素
- 检查父元素是否已经是 `div.table-wrapper`，避免重复包裹
- 创建 `div.table-wrapper` 包裹 `<table>`
- 用 wrapper 替换原 `<table>` 节点

### 2. 注册插件

文件：`astro.config.mjs`

在 `rehypePlugins` 数组中，放在 `rehypeSlug` 之后、`rehypeComponents` 之前：

```js
import { rehypeWrapTables } from './src/plugins/rehype-wrap-tables.mjs'

rehypePlugins: [
  rehypeKatex,
  rehypeSlug,
  rehypeWrapTables(),    // ← 新增
  [rehypeComponents, { ... }],
  [rehypeAutolinkHeadings, { ... }],
]
```

### 3. 修改 CSS

文件：`src/components/misc/Markdown.astro`（第176-204行 Stylus 部分）

变更：
- `table` 的 `display: block`、`overflow-x: auto`、`-webkit-overflow-scrolling: touch` 移到 `.table-wrapper`
- `table` 恢复 `display: table`，保留 `width: 100%`、`border-collapse: collapse`、`border-spacing: 0`
- `.table-wrapper` 继承原 `table` 的 `border-radius`、`box-shadow`、`margin`、`background`
- `td` 的 `white-space` 从 `nowrap` 改为 `normal`
- `td` 的 `overflow-wrap` 从 `normal` 改为 `break-word`
- `td` 移除 `word-break: normal`（已通过 `overflow-wrap: break-word` 处理）
- `th` 保留 `white-space: nowrap`（表头不应换行）
- `th` 添加背景色、`font-weight: 600`、`letter-spacing: 0.01em`

### 变更对比

| 方面 | 变更前 | 变更后 |
|------|--------|--------|
| 滚动容器 | `<table>` 自身 | `<div class="table-wrapper">` |
| `table` display | `block` | `table`（原生） |
| `td` white-space | `nowrap` | `normal` |
| `td` overflow-wrap | `normal` | `break-word` |
| `th` white-space | `nowrap` | `nowrap`（保留） |
| 窄表格宽度 | 不填满 | 自动填满 |

## 验证要点

- 窄表格（如算法对比的3列表）应填满内容区域宽度
- 宽表格（如 Z 算法的10行6列表）应有水平滚动条
- 表格圆角、边框、背景、斑马纹、悬停效果不变
- 深色模式下样式正常
- 代码块、KaTeX 公式等其他 Markdown 元素不受影响