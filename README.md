# Minjer Blog

基于 Astro 和 Fuwari 构建的个人技术博客，用于整理学习笔记、编程实践、项目记录与经验分享

在线访问：[https://mj3622.github.io](https://mj3622.github.io)

## 功能

- 使用 Markdown 管理文章，支持分类、标签、归档、最近更新和系列导航
- 使用 Pagefind 提供中文全文搜索以及分类、标签、年份组合筛选
- 在构建阶段生成系列进度和最多 3 篇相关推荐
- 使用 Expressive Code 渲染代码块，支持语法高亮、行号、复制和折叠区段
- 支持 Mermaid 图表、KaTeX 数学公式、GitHub 风格提示块和文章目录
- 支持亮色、暗色、跟随系统以及自定义主题色
- 支持响应式图片、图片灯箱、ClientRouter 页面导航和减少动效偏好
- 支持 PWA 安装、已访问文章离线阅读、RSS 和站点地图
- 可选接入 Cloudflare Web Analytics，未配置时不会发起统计请求

## 技术栈

| 用途 | 技术 |
| --- | --- |
| 静态站点 | Astro 7 |
| 交互组件 | Svelte 5 |
| 样式 | Tailwind CSS 4、Stylus |
| 内容 | Astro Content Layer、Markdown |
| 代码块 | Expressive Code |
| 搜索 | Pagefind |
| 离线缓存 | Workbox |
| 自动化检查 | Biome、TypeScript、Astro Check、Vitest、Playwright |
| 部署 | GitHub Pages、GitHub Actions |

本项目基于 [Fuwari](https://github.com/saicaca/fuwari) 定制

## 本地开发

### 环境要求

- Node.js 22.12+
- pnpm 9.6

### 安装与启动

```bash
git clone https://github.com/mj3622/mj3622.github.io.git
cd mj3622.github.io
pnpm install
pnpm dev
```

开发服务器默认运行在 [http://localhost:4321](http://localhost:4321)

## 文章管理

文章保存在 `src/content/posts/`，可以按目录组织文章及其图片资源

创建新文章：

```bash
pnpm new-post -- "文章标题"
```

文章 Frontmatter 示例：

```yaml
---
title: 文章标题
published: 2026-08-30
updated: 2026-08-30
description: 文章摘要
image: ./assets/cover.png
tags: [Astro, Blog]
category: 编程实践
series: Astro 博客建设
seriesOrder: 1
draft: false
lang: zh_CN
---
```

站点标题、导航、个人资料、Banner 和主题配置位于 `src/config.ts`

`updated`、`series` 和 `seriesOrder` 都是可选字段。同一系列的文章需要设置不重复的正整数顺序

## 可选访问统计

复制环境变量示例并填入 Cloudflare Web Analytics 的公开 Beacon Token：

```bash
cp .env.example .env
```

```env
PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN=
```

留空即完全关闭统计，项目不包含自建后端、数据库或 Serverless Function

## 检查与构建

```bash
pnpm lint
pnpm type-check
pnpm check
pnpm build
pnpm test:unit
pnpm test:e2e
pnpm preview
```

构建结果输出到 `dist/`，Pagefind 搜索索引和 Workbox Service Worker 会在构建后自动生成

## 项目结构

```text
src/
├── components/       页面与交互组件
├── content/posts/    博客文章与文章资源
├── layouts/          页面布局
├── pages/            Astro 路由
├── plugins/          Markdown 与 Expressive Code 插件
├── content.config.ts 内容集合配置
└── config.ts         站点配置
```

## 部署

推送到 `main` 分支后，GitHub Actions 会执行质量检查并部署到 GitHub Pages

## 联系方式

如有内容错误或改进建议，可以发送邮件至 [minjer@foxmail.com](mailto:minjer@foxmail.com)

## License

本项目基于 MIT License 开源，详情请查看 [LICENSE](LICENSE) 文件
