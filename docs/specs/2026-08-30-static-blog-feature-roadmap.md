# 静态博客功能升级路线图

日期：2026-08-30

## 目标

在保持 Astro 静态导出和 GitHub Pages 部署方式不变的前提下，加入自动化回归、系列文章、相关推荐、最近更新、搜索筛选、响应式图片、原生路由、PWA 离线阅读和可选访问统计

本路线图明确排除评论功能，并禁止引入需要额外自建、部署或维护的后端服务

## 架构约束

- 保持 `output: static`，不增加 Astro API Route、SSR Adapter、数据库或 Serverless Function
- 内容关系、相关推荐、系列顺序和最近更新全部在构建阶段计算
- 搜索继续使用 Pagefind 静态索引，不增加搜索服务
- 离线能力使用静态 Web App Manifest、Service Worker 和 Cache Storage
- 访问统计仅允许接入托管服务，并且必须可通过配置完全关闭
- 不提交密钥、账号信息或私有 Token
- 保留 GitHub Pages 当前 URL、文章路径、RSS 和 Sitemap 兼容性
- 所有任务按顺序实施，不并行修改共享布局、内容模型和导航生命周期

## 方案决策

### 自动化测试

使用 Playwright 建立桌面端和移动端浏览器回归，并为首页、文章页和关键浮层保留截图基线

首批测试覆盖：

- 首页桌面端和移动端布局
- 有封面和无封面文章的全站 Banner
- 中文搜索、标签和分类筛选
- 主题切换、移动菜单和显示设置
- Expressive Code、文章目录和 PhotoSwipe
- 页面导航后的标题、URL、控制台和横向溢出
- `prefers-reduced-motion`

### 内容模型

文章 Frontmatter 增加以下可选字段：

```yaml
updated: 2026-08-30
series: Dubbo 源码学习
seriesOrder: 3
```

相关推荐算法保持确定性：

1. 排除当前文章和草稿
2. 同系列文章优先
3. 按共同标签数量降序
4. 分数相同时按发布时间降序
5. 最多展示 3 篇

### 搜索筛选

文章页向 Pagefind 暴露 `category`、`tag` 和 `year` 过滤字段，搜索面板读取 Pagefind 静态过滤索引并显示剩余结果数量

### 图片

本地文章封面逐步改为 Content Layer 图片 Schema，避免两处 `import.meta.glob('../../**')` 扫描整个源码目录

- Banner 使用 `full-width`
- 文章封面和正文图片使用 `constrained`
- 外部图片和 `public/` 图片保持兼容
- 保留文章封面作为 Open Graph 图片，但不得覆盖全站 Banner

### 页面导航

在 Playwright 回归稳定后，将 `@swup/astro` 替换为 Astro `ClientRouter`

现有 Swup 生命周期逻辑分别迁移到：

- `astro:before-preparation`
- `astro:after-swap`
- `astro:page-load`

### PWA

使用 `@vite-pwa/astro` 生成 Manifest 和 Service Worker，不增加服务端

实施时项目已升级到 Astro 7，而当前 `@vite-pwa/astro` 未声明支持 Astro 7，因此改为在构建后直接使用 Workbox 生成等价的静态 Service Worker

缓存范围：

- 站点壳层和 `/_astro/` 静态资源
- 已访问文章
- Pagefind 索引
- 离线 fallback 页面

不缓存：

- 外部统计脚本和上报请求
- 不受控制的第三方资源

### 访问统计

默认关闭，通过公开环境变量配置 Cloudflare Web Analytics

```env
PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=
```

该方案不需要自建后端，但需要用户自行创建 Cloudflare Web Analytics 站点并提供公开 Beacon Token

## 实施计划

### Phase 1：测试基础

#### Task 1：接入 Playwright

**说明**：建立浏览器测试目录、配置桌面和移动端项目，并提供本地静态预览启动方式

**验收标准**：

- [ ] `pnpm test:e2e` 可以自动构建并启动预览服务
- [ ] 至少配置一个桌面视口和一个移动视口
- [ ] 测试失败时保留截图、Trace 和控制台信息

**验证**：

- [ ] `pnpm test:e2e`
- [ ] CI 中无人工操作运行

**依赖**：无

**可能修改**：

- `package.json`
- `playwright.config.ts`
- `tests/e2e/`
- `.github/workflows/check.yml`

**规模**：中

#### Task 2：锁定当前核心回归

**说明**：将已经验证过的 Banner、搜索、主题、导航和代码块行为转成可重复测试

**验收标准**：

- [ ] 有封面文章不会替换全站 Banner
- [ ] 搜索“Dubbo”可以返回结果
- [ ] 首页和文章页桌面、移动端无横向溢出
- [ ] 浏览器控制台没有错误或警告

**验证**：

- [ ] Playwright 功能测试通过
- [ ] 首页和文章页截图比较通过

**依赖**：Task 1

**可能修改**：

- `tests/e2e/home.spec.ts`
- `tests/e2e/post.spec.ts`
- `tests/e2e/search.spec.ts`

**规模**：中

### Checkpoint 1

- [ ] `pnpm lint`
- [ ] `pnpm type-check`
- [ ] `pnpm check`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`

### Phase 2：内容发现

#### Task 3：扩展文章内容模型

**说明**：增加 `series` 和 `seriesOrder`，规范已有 `updated` 字段并补充类型和文档

**验收标准**：

- [ ] 无系列字段的旧文章继续构建
- [ ] 同系列的 `seriesOrder` 不允许重复或缺少有效顺序
- [ ] README 包含字段示例

**验证**：

- [ ] Content Layer Schema 校验通过
- [ ] 全部现有文章构建通过

**依赖**：Task 2

**可能修改**：

- `src/content.config.ts`
- `src/types/config.ts`
- `README.md`

**规模**：小

#### Task 4：显示更新时间和最近更新页面

**说明**：文章元数据显示“发布于”和“更新于”，新增按 `updated` 排序的静态页面

**验收标准**：

- [ ] 未设置 `updated` 时不显示重复日期
- [ ] `/updated/` 只展示设置了更新时间的文章
- [ ] 页面按更新时间倒序排列

**验证**：

- [ ] 日期格式和深色模式正确
- [ ] Playwright 验证更新时间与排序

**依赖**：Task 3

**可能修改**：

- `src/components/PostMeta.astro`
- `src/pages/updated.astro`
- `src/utils/content-utils.ts`
- `src/i18n/`

**规模**：中

#### Task 5：系列导航和相关推荐

**说明**：在文章底部加入系列进度、系列上一篇/下一篇和相关推荐

**验收标准**：

- [ ] 系列文章按 `seriesOrder` 展示
- [ ] 非系列文章不出现空系列面板
- [ ] 相关推荐排除当前文章和草稿，最多 3 篇

**验证**：

- [ ] 推荐算法单元测试覆盖排序和边界情况
- [ ] Playwright 验证文章底部布局

**依赖**：Task 3

**可能修改**：

- `src/utils/content-utils.ts`
- `src/components/SeriesNavigation.astro`
- `src/components/RelatedPosts.astro`
- `src/pages/posts/[...slug].astro`

**规模**：中

#### Task 6：Pagefind 分类、标签和年份筛选

**说明**：扩展现有搜索面板，在静态索引中加入过滤字段和数量统计

**验收标准**：

- [ ] 支持分类、标签和年份组合筛选
- [ ] 每个选项显示当前剩余结果数量
- [ ] 支持清除筛选和无结果状态

**验证**：

- [ ] Pagefind 构建日志包含过滤字段
- [ ] Playwright 覆盖单筛选、组合筛选和清除筛选

**依赖**：Task 2

**可能修改**：

- `src/components/Search.svelte`
- `src/pages/posts/[...slug].astro`
- `src/components/PostMeta.astro`
- `pagefind.yml`

**规模**：中

### Checkpoint 2

- [ ] 旧文章无需修改即可构建
- [ ] 系列、推荐、最近更新和搜索筛选均为静态生成
- [ ] RSS、Sitemap 和旧文章 URL 不变
- [ ] 全量自动化检查通过

### Phase 3：图片与导航基础设施

#### Task 7：迁移文章图片 Schema

**说明**：使用 Content Layer 图片能力解析本地封面，并保留外部和 `public/` 图片兼容分支

**验收标准**：

- [ ] 删除文章页和 `ImageWrapper` 中的全目录图片扫描
- [ ] 所有现有本地封面、外部封面和无封面文章正常
- [ ] Open Graph 图片仍为绝对 URL

**验证**：

- [ ] 构建日志无图片缺失错误
- [ ] Playwright 覆盖本地、外部和无封面文章

**依赖**：Task 2

**可能修改**：

- `src/content.config.ts`
- `src/components/misc/ImageWrapper.astro`
- `src/pages/posts/[...slug].astro`
- `src/utils/content-utils.ts`

**规模**：中

#### Task 8：启用响应式图片

**说明**：为不同图片场景配置合理的 `layout`、`sizes`、加载优先级和输出格式

**验收标准**：

- [ ] Banner 输出 `srcset` 和适合全宽场景的 `sizes`
- [ ] 文章封面和正文图片不会下载超过视口需要的尺寸
- [ ] 首屏 Banner 保持高优先级，正文图片继续懒加载

**验证**：

- [ ] 构建后的 HTML 包含 `srcset` 和 `sizes`
- [ ] 桌面、移动端截图无裁切回退

**依赖**：Task 7

**可能修改**：

- `astro.config.mjs`
- `src/components/misc/ImageWrapper.astro`
- `src/layouts/MainGridLayout.astro`
- `src/components/misc/Markdown.astro`

**规模**：中

#### Task 9：Swup 迁移到 ClientRouter

**说明**：移除 Swup，使用 Astro 原生客户端路由和生命周期事件重新初始化滚动条、PhotoSwipe、主题及 Banner 状态

**验收标准**：

- [ ] 删除 `@swup/astro` 和所有 `window.swup` 依赖
- [ ] 前进、后退和站内链接导航正常
- [ ] 页面标题、Head、滚动位置、目录和灯箱在导航后正确
- [ ] 减少动态效果设置由 ClientRouter 正确处理

**验证**：

- [ ] Playwright 连续导航首页、文章、归档、关于我并返回
- [ ] 快速连续导航无重复事件和控制台错误

**依赖**：Task 2、Task 7

**可能修改**：

- `astro.config.mjs`
- `src/layouts/Layout.astro`
- `src/layouts/MainGridLayout.astro`
- `src/global.d.ts`
- `package.json`

**规模**：大，实施时拆成路由接入和生命周期迁移两个提交

### Checkpoint 3

- [ ] 图片构建体积和请求尺寸有对比数据
- [ ] 页面连续导航回归通过
- [ ] 不再依赖 Swup
- [ ] 全量自动化检查通过

### Phase 4：离线和统计

#### Task 10：PWA 与离线阅读

**说明**：生成 Manifest、Service Worker、离线 fallback，并缓存已访问文章和 Pagefind 资源

**验收标准**：

- [ ] 站点满足基本可安装条件
- [ ] 访问过的文章离线可打开
- [ ] 新版本发布后能更新缓存且不会长期显示旧文章
- [ ] GitHub Pages 子路径和尾斜杠行为正确

**验证**：

- [ ] `pnpm build && pnpm preview`
- [ ] Playwright 离线模式验证已访问文章
- [ ] Lighthouse PWA 检查

**依赖**：Task 8、Task 9

**可能修改**：

- `astro.config.mjs`
- `src/layouts/Layout.astro`
- `src/pages/404.astro`
- `src/pwa.ts`
- `public/`

**规模**：中

#### Task 11：可选 Cloudflare Web Analytics

**说明**：增加默认关闭的统计配置，仅当公开 Token 存在时加载 Beacon

**验收标准**：

- [ ] 没有 Token 时不加载任何统计请求
- [ ] Token 只通过公开环境变量提供，不硬编码到源码
- [ ] ClientRouter 导航可以被托管统计服务识别
- [ ] PWA 不缓存统计脚本和上报请求

**验证**：

- [ ] 无 Token 的构建和浏览器网络记录无统计请求
- [ ] 测试 Token 环境仅加载一次 Beacon

**依赖**：Task 9、Task 11

**可能修改**：

- `src/config.ts`
- `src/layouts/Layout.astro`
- `src/env.d.ts`
- `.env.example`

**规模**：小

### Checkpoint 4：完成

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm lint`
- [ ] `pnpm type-check`
- [ ] `pnpm check`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`
- [ ] 完整依赖安全审计为 0
- [ ] 桌面和移动端视觉回归通过
- [ ] 离线、搜索、系列和相关推荐验收通过
- [ ] 没有新增自建后端、数据库、API Route 或 Serverless Function

## 风险与缓解

| 风险 | 影响 | 缓解方式 |
| --- | --- | --- |
| ClientRouter 生命周期与现有脚本不兼容 | 高 | 先建立 E2E，再逐个迁移初始化函数 |
| 图片 Schema 改变现有 Frontmatter 类型 | 高 | 保留字符串兼容分支，分本地、外部和 public 三类测试 |
| Service Worker 缓存旧文章 | 高 | 使用版本化预缓存和更新提示，不缓存外部请求 |
| Pagefind 筛选增加索引体积 | 中 | 只索引分类、标签和年份，构建前后比较体积 |
| 推荐结果不稳定 | 中 | 固定排序规则并添加单元测试 |
| 托管统计涉及第三方请求 | 中 | 默认关闭，文档说明数据流，用户提供 Token 后再启用 |

## 明确不做

- 评论系统
- 自建后台、CMS、数据库和用户系统
- 服务端搜索和推荐接口
- 点赞、收藏、阅读量写入接口
- 推送通知和后台同步
- 需要长期运行进程的定时任务

## 实施顺序

`Playwright → 内容模型 → 最近更新 → 系列/推荐 → 搜索筛选 → 图片 Schema → 响应式图片 → ClientRouter → PWA → 可选统计`

每完成 2 至 3 个任务进行一次构建、浏览器和差异检查，任何阶段都必须保持博客可构建、可部署和旧文章 URL 兼容
