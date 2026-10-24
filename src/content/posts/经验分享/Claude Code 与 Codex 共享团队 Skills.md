---
title: "Claude Code 与 Codex 共享团队 Skills"
published: 2026-10-24
description: "通过 GitHub 私有仓库和原生插件市场分发团队 Skills，覆盖 macOS、Windows 接入、SSH 认证、自动更新、版本发布与回滚"
tags: [Agent Skills, Claude Code, Codex]
category: 经验分享
draft: true
---

团队的代码审查规范、接口约定和发布流程可以整理成 Skills，供 Claude Code 和 Codex 共用。通过私有 Git 仓库统一维护、原生插件市场分发，成员安装后就能持续获取更新，减少手动复制带来的版本差异

准备好 Git、OpenSSH 和团队仓库，确保 Git 与 SSH 能在终端使用。下文以 GitHub 私有仓库 `your-team/agent-skills`、发布分支 `main` 为例；自建 GitLab 替换为项目的克隆地址和认证配置即可

## 1. 仓库结构

**市场清单列出插件，插件打包多个 Skills，客户端按插件安装和更新**

| 产品 | 市场清单（相对仓库根目录） | 插件清单（相对插件根目录） |
| --- | --- | --- |
| Claude Code | `.claude-plugin/marketplace.json` | `.claude-plugin/plugin.json` |
| Codex | `.agents/plugins/marketplace.json` | `plugin.json`，声明 Agent Plugins schema |

Codex 兼容 Claude Code 的市场和插件格式，因此本文统一采用 Claude Code 格式，两端共用以下目录结构。[OpenAI 插件格式](https://developers.openai.com/plugins/build/plugins)、[Claude Code 插件格式](https://code.claude.com/docs/en/plugins-reference)

```text
agent-skills/
├── .claude-plugin/
│   └── marketplace.json          # 市场清单
└── plugins/
    └── shared-skills/            # 插件根目录
        ├── .claude-plugin/
        │   └── plugin.json      # 插件名称与版本
        └── skills/
            └── team-check/
                └── SKILL.md     # 技能说明与指令
```

`skills/` 与插件内的 `.claude-plugin/` 同级，每个技能占一个子目录。两端都读取 `skills/<技能名>/SKILL.md`

### 市场清单

`.claude-plugin/marketplace.json`：

```json
{
  "name": "team-skills",
  "owner": { "name": "Your Team" },
  "plugins": [
    {
      "name": "shared-skills",
      "source": "./plugins/shared-skills",
      "description": "团队共享技能"
    }
  ]
}
```

`source` 从仓库根目录指向插件目录，安装标识为 `shared-skills@team-skills`，即 `插件名@市场名`

### 插件清单

`plugins/shared-skills/.claude-plugin/plugin.json`：

```json
{
  "name": "shared-skills",
  "version": "0.1.0",
  "description": "团队共享技能",
  "author": { "name": "Your Team" }
}
```

`name` 与市场中的插件条目保持一致，版本号统一在这份文件中维护

### 技能文件

`plugins/shared-skills/skills/team-check/SKILL.md`：

```markdown
---
name: team-check
description: 用户要求检查团队插件是否安装成功或查询已安装版本时使用
---

以本 SKILL.md 所在目录为基准，读取 ../../.claude-plugin/plugin.json
回复其中的 name 和 version，格式为「已加载插件：<name>，版本：<version>」
读取失败时说明原因，不猜测版本号
```

`description` 描述使用场景，正文写执行规则。新增真实技能时，在 `skills/` 下增加同级目录；脚本和参考资料放在对应技能目录内，通过相对路径引用

## 2. 发布到私有仓库

将上述目录和文件提交到团队仓库的 `main` 分支，后续客户端通过该仓库地址安装插件，并跟踪这个分支的更新

每位成员在本机配置有仓库读取权限的 SSH 密钥或 HTTPS 凭证。自动更新需要后台直接使用这些凭证；使用带口令的 SSH 密钥时，由 SSH agent 管理口令

## 3. 在 Codex 桌面端安装

进入 **设置 → 插件 → 添加 → 添加插件市场**，填写：

| 字段 | 内容 |
| --- | --- |
| 来源 | `git@github.com:your-team/agent-skills.git` |
| Git 引用 | `main` |
| 稀疏路径 | 留空 |

跟踪 `main` 可以接收后续发布；稀疏路径留空，保留完整市场清单与插件目录

![Codex 添加插件市场填写示意](/images/team-shared-skills/codex-marketplace-form.svg)

添加后，在 `team-skills` 市场中安装并启用 `shared-skills`。新建聊天，选择 `shared-skills:team-check` 并请求检查安装结果，应返回「已加载插件：shared-skills，版本：0.1.0」

## 4. 在 Claude Code 中安装

在终端添加市场并安装插件，`#main` 指定发布分支，`--scope user` 安装到当前用户范围：

```sh
claude plugin marketplace add "git@github.com:your-team/agent-skills.git#main"
claude plugin install shared-skills@team-skills --scope user
```

在 Claude Code 新会话中调用：

```text
/shared-skills:team-check
```

应返回「已加载插件：shared-skills，版本：0.1.0」。已有会话先执行 `/reload-plugins`

**自建市场需要开启自动更新**：执行 `/plugin`，进入 **Marketplaces → team-skills → Enable auto-update**。配置文件中对应市场的开关为 `autoUpdate: true`。[Claude Code 自动更新说明](https://code.claude.com/docs/en/discover-plugins#keep-plugins-updated)

![Claude Code 开启市场自动更新的操作示意](/images/team-shared-skills/claude-auto-update.svg)

## 5. 发布与更新

在仓库工作副本中修改技能，同步递增 `plugins/shared-skills/.claude-plugin/plugin.json` 的 `version`，将内容与版本号一起合并到远程 `main`

例如，将插件版本从 `0.1.0` 升到 `0.1.1`，更新后的 `team-check` 会从插件清单读取并返回 `0.1.1`。新增、修改和删除技能都按同样方式发布，客户端依据版本变化更新缓存。[插件版本规则](https://code.claude.com/docs/en/plugins/host-marketplace#release-a-new-version)

| 客户端 | 获取更新 | 加载新版 |
| --- | --- | --- |
| Codex 桌面端 | 完整退出并重启应用，等待启动时检查市场 | 新建聊天，确认插件版本与技能内容 |
| Claude Code | 开启市场自动更新后，在会话启动后的后台检查中下载 | 收到 `Plugin updated` 提示后执行 `/reload-plugins`，或开启新会话 |

更新依赖网络和后台凭证，下载完成后还需要会话加载新版。首次接入可发布一次小版本，在另一台电脑的新会话中调用 `team-check`，确认返回版本为 `0.1.1`，并检查本次修改的技能内容；验证自动更新期间保持自动流程，不手动刷新或重装

需要立即更新 Claude Code 时，在终端执行：

```sh
claude plugin marketplace update team-skills
claude plugin update shared-skills@team-skills --scope user
```

随后在会话中执行 `/reload-plugins`

真实技能接入后，可删除 `team-check/` 并递增插件版本。需要回滚时，用旧内容发布更高版本，例如将 `0.1.0` 的内容发布为 `0.1.2`

## 6. 常见问题

| 现象 | 检查项 |
| --- | --- |
| 私有仓库读取失败 | 仓库权限、SSH 身份、agent、主机信任和组织 SSO 授权 |
| 终端正常，桌面应用失败 | 应用使用的 SSH 程序、配置、凭证和网络环境 |
| 市场添加失败 | 目标分支中的 `.claude-plugin/marketplace.json` 及其 `source` 路径 |
| 安装后找不到技能 | 插件启用状态、`skills/<技能名>/SKILL.md` 路径和新会话加载情况 |
| 更新仍是旧版 | 远程分支、插件版本号、自动更新开关、下载结果与会话版本 |
