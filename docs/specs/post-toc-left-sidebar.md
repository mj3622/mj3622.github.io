# Spec: 文章详情页大纲左侧化布局优化

## Objective

将文章详情页当前显示在正文右侧外扩区域的文章大纲（TOC）移动到现有文章左侧信息栏的位置，使用户进入文章详情后能在左侧直接看到目录导航。

目标用户是博客读者，尤其是阅读长文时需要快速定位章节的用户。成功效果是：文章详情页左侧栏优先展示大纲，正文阅读区域保持稳定，非文章页面的侧边栏体验不被破坏。

## Assumptions

1. 只调整文章详情页（`src/pages/posts/[...slug].astro` 进入的页面），首页、归档页、分类页等列表页仍保留当前左侧个人信息 / 分类 / 标签侧边栏。
2. “现在文章左侧信息栏的位置”指 `MainGridLayout.astro` 中 `SideBar` 占用的左侧 17.5rem 网格列。
3. 文章详情页左侧栏改为显示 TOC 后，不再显示 Profile / Categories / Tags；如果文章没有标题大纲，则左侧栏可以为空或隐藏，不强行显示原侧边栏。
4. 当前右侧外扩 TOC 区域应在文章详情页移除，避免同一篇文章出现两个大纲。
5. 移动端和平板端维持现有行为：左侧栏不强行占据窄屏空间，正文优先；TOC 可按现有断点在大屏显示。

## Tech Stack

- Astro 4.x
- TypeScript / Astro Components
- Tailwind CSS utility classes
- Existing content system: `astro:content`
- Existing TOC component: `src/components/widget/TOC.astro`

## Commands

```bash
# 本地开发
npm run dev -- --host 127.0.0.1

# 生产构建验证
npm run build

# 类型检查（如需要）
npm run type-check

# 代码格式化（如需要）
npm run format
```

## Project Structure

```text
src/pages/posts/[...slug].astro
  → 文章详情页入口，负责把 entry.render() 得到的 headings 传入布局。

src/layouts/MainGridLayout.astro
  → 主布局网格，目前负责渲染 SideBar、正文、右侧 TOC。

src/components/widget/SideBar.astro
  → 当前左侧信息栏，包含 Profile、Categories、Tags。

src/components/widget/TOC.astro
  → 目录组件，应复用，不重新实现目录渲染逻辑。

src/base.css
  → TOC hide/scrollbar 等全局样式，如布局移动后需要调整选择器，在这里做最小改动。
```

## Code Style

保持当前 Astro 组件风格：在 frontmatter 中计算状态，模板中用 `class:list` 控制布局，不引入新的状态管理或依赖。

示例风格：

```astro
---
const isPostPage = Astro.props.layout === 'post'
const shouldShowLeftToc = isPostPage && siteConfig.toc.enable && headings.length > 0
---

{shouldShowLeftToc && (
  <aside class="hidden lg:block lg:max-w-[17.5rem] onload-animation">
    <TOC headings={headings} />
  </aside>
)}
```

约定：

- 优先复用 `TOC.astro`，不复制目录生成逻辑。
- 优先通过显式 prop 区分文章详情布局，例如 `sidebarMode="toc"` 或 `showSidebarToc={true}`。
- 避免用 URL 字符串判断页面类型。
- 避免影响 `SideBar.astro` 在非文章页面的现有表现。

## Testing Strategy

验证分三层：

1. 构建验证：
   ```bash
   npm run build
   ```
2. 本地视觉验证：
   ```bash
   npm run dev -- --host 127.0.0.1
   ```
   手动打开任意长文章详情页，确认：
   - 大纲显示在左侧原信息栏位置。
   - 右侧不再显示重复大纲。
   - 点击大纲项可以跳转到对应标题。
   - 首页、归档页等非文章页面仍显示原侧边栏。
3. 响应式验证：
   - 大屏（lg 及以上）：左侧显示大纲，正文右侧无外扩 TOC。
   - 小屏：不出现挤压正文、横向滚动或重复大纲。

## Boundaries

- Always:
  - 保持 `TOC.astro` 单一职责，不重写目录算法。
  - 修改后运行 `npm run build`。
  - 保持非文章页面侧边栏不回退。
  - 使用最小改动完成布局迁移。

- Ask first:
  - 如果需要改变整体 `--page-width`、全站网格宽度或断点策略。
  - 如果需要新增第三方依赖。
  - 如果要在移动端新增可展开悬浮目录。
  - 如果要永久移除 Profile / Categories / Tags 组件。

- Never:
  - 不提交构建产物 `dist/`，除非仓库原流程明确要求。
  - 不修改博客内容文件来适配布局。
  - 不破坏文章标题 slug / heading anchor。
  - 不引入硬编码文章路径判断。

## Success Criteria

- [x] 文章详情页大纲出现在左侧原信息栏位置。
- [x] 文章详情页右侧外扩 TOC 不再显示。
- [x] 非文章页面仍显示 Profile / Categories / Tags。
- [x] TOC 点击跳转正常。
- [x] `npm run build` 成功。
- [x] 在 127.0.0.1 本地服务中可手动预览效果。

## Open Questions

1. 文章详情页左侧移动为 TOC 后，是否完全隐藏 Profile / Categories / Tags？当前规格默认隐藏。
2. 文章没有二级标题或没有 headings 时，左侧栏是隐藏，还是回退显示原信息栏？当前规格默认可隐藏或为空，实施时优先避免空白过大。
3. 小屏下是否需要一个“目录”折叠按钮？当前规格不做，保持正文优先。

## Decisions

- 文章详情页左侧栏完全替换为 TOC，不再显示 Profile / Categories / Tags。
- 文章详情页右侧外扩 TOC 完全移除。
- 无 headings 的文章详情页左侧不显示原信息栏，避免与“完全替换”要求冲突。

## Implementation Plan

1. 为 `MainGridLayout.astro` 增加显式布局控制 prop。
   - 新增类似 `sidebarMode?: 'default' | 'toc'` 的 prop。
   - 默认值为 `default`，保证非文章页面保持现状。

2. 在主网格左侧栏位置按模式渲染内容。
   - `sidebarMode === 'default'`：继续渲染现有 `SideBar`。
   - `sidebarMode === 'toc'`：在原 `SideBar` 网格位置渲染 `TOC`。
   - TOC 左侧容器复用当前 17.5rem 宽度与 sticky 行为。

3. 移除文章详情页右侧外扩 TOC。
   - 当 `sidebarMode === 'toc'` 时，不渲染当前 `#toc-wrapper`。
   - 保留空 `#toc` fallback，避免 Swup 依赖的 DOM 节点缺失。

4. 在文章详情页入口传入布局模式。
   - 在 `src/pages/posts/[...slug].astro` 的 `MainGridLayout` 上设置 `sidebarMode="toc"`。

5. 验证。
   - 运行 `npm run build`。
   - 启动 `npm run dev -- --host 127.0.0.1`。
   - 手动检查文章详情页与非文章页面。

## Implementation Tasks

- [x] Task: 扩展 `MainGridLayout.astro` 的布局 prop
  - Acceptance: 支持默认侧边栏与文章 TOC 侧边栏两种模式，默认行为不变。
  - Verify: 非文章页面仍渲染 `SideBar`。
  - Files: `src/layouts/MainGridLayout.astro`

- [x] Task: 在左侧栏位置渲染文章 TOC
  - Acceptance: `sidebarMode="toc"` 时左侧显示大纲，原 Profile / Categories / Tags 不显示。
  - Verify: 打开文章详情页查看左侧栏。
  - Files: `src/layouts/MainGridLayout.astro`

- [x] Task: 禁用文章详情页右侧外扩 TOC
  - Acceptance: `sidebarMode="toc"` 时右侧不再出现 `#toc-wrapper` 大纲。
  - Verify: 文章详情页 DOM 和视觉上均无右侧重复 TOC。
  - Files: `src/layouts/MainGridLayout.astro`

- [x] Task: 文章详情页传入 TOC 侧边栏模式
  - Acceptance: 所有文章详情页使用左侧 TOC 布局。
  - Verify: `src/pages/posts/[...slug].astro` 构建通过，文章页大纲位置正确。
  - Files: `src/pages/posts/[...slug].astro`

- [x] Task: 构建与本地预览
  - Acceptance: `npm run build` 成功，本地服务可访问。
  - Verify: 浏览器打开文章页与首页检查布局。
  - Files: 无或仅运行命令
