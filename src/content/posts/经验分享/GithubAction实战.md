---
published: 2026-01-22
title: GitHub Actions 实战：从零搭建 CI/CD 流水线
description: 本文详细介绍了如何使用 GitHub Actions 实现代码自动部署到 Linux 服务器的 CI/CD 流水线，涵盖 SSH 密钥配置、Workflow 编写及前后端项目的实战案例。
tags: [DevOps, GitHub Actions, CI-CD]
category: 经验分享
draft: false
---

在现代开发流程中，CI/CD（持续集成/持续部署）已经成为提高效率的关键环节。本文将介绍如何利用 GitHub Actions，在代码推送到 GitHub 仓库时，自动将其部署到你的 Linux 服务器上。

我们将使用目前社区最流行的 `appleboy/ssh-action` 方案，因为它配置简单且足够安全。

## 1. 原理简介

自动部署的核心流程非常简单：

1. **触发**：当你向 GitHub 的特定分支（如 `main`）推送代码时，触发 Action。
2. **连接**：GitHub 的运行容器通过 SSH 密钥连接到你的私有服务器。
3. **执行**：在服务器上执行预设的脚本（例如 `git pull` 拉取最新代码，或者 `docker compose up -d` 重启容器）。

## 2. 准备工作：配置 SSH 密钥

为了让 GitHub Actions 能够免密登录你的服务器，我们需要配置 SSH 密钥对。我们将直接在服务器上生成这对密钥。

### 第一步：在服务器生成密钥并授权

SSH 登录到你的**目标服务器**，在终端执行以下命令：

```bash
# 1. 生成密钥对 (生成到 ~/.ssh/github_action 文件，避免覆盖默认密钥)
# 一路回车即可，无需设置密码
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/github_action

# 2. 确保 .ssh 目录存在且权限正确
mkdir -p ~/.ssh && chmod 700 ~/.ssh

# 3. 将刚刚生成的公钥追加到 authorized_keys (实现自我授权)
cat ~/.ssh/github_action.pub >> ~/.ssh/authorized_keys

# 4. 设置 authorized_keys 权限 (必须是 600，否则 SSH 会拒绝登录)
chmod 600 ~/.ssh/authorized_keys

```

### 第二步：获取私钥填入 GitHub Secrets

我们需要把刚刚生成的**私钥**告诉 GitHub。

1. **在服务器终端查看私钥内容**：

```bash
cat ~/.ssh/github_action

```

2. **复制**输出的全部内容（从 `-----BEGIN OPENSSH PRIVATE KEY-----` 开头，到 `-----END OPENSSH PRIVATE KEY-----` 结尾）。
3. 打开你的 GitHub 仓库页面，点击 **Settings** -> **Secrets and variables** -> **Actions**。
4. 点击 **New repository secret**，添加以下三个变量：

- `HOST`: 你的服务器 IP 地址。
- `USERNAME`: 服务器登录用户名（例如 `root` 或 `ubuntu`）。
- `KEY`: 粘贴刚才复制的**私钥内容**。

> **注意**：私钥（`github_action` 文件）是免密登录的凭证，请不要泄露给他人。公钥（`.pub` 结尾）留在服务器上即可。

## 3. 编写 Workflow 文件

在你的项目根目录下，创建路径 `.github/workflows/deploy.yml`，并写入以下内容。

这个示例假设你的项目是基于 Docker 部署的（推荐方式），或者通过 Git 拉取代码的方式。

```yaml
name: Auto Deploy

on:
  push:
    branches:
      - main # 监听 main 分支的变动

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.KEY }}
          script: |
            # 1. 进入项目目录
            cd /path/to/your/project

            # 2. 拉取最新代码
            git pull origin main

            # 3. 如果是 Docker 项目，重建并重启容器
            # docker compose down
            # docker compose up -d --build

            # 3. 如果是普通后端项目 (例如 Java/Python)，可能需要执行类似下面的命令：
            # mvn clean package
            # systemctl restart my-service

            echo "Deployment finished successfully!"
```

### 关键参数解析

- **uses: appleboy/ssh-action@master**: 这是一个封装好的 SSH 动作，它会自动处理 SSH 连接的繁琐细节。
- **secrets.\***: 这里引用的就是我们在 GitHub Settings 里配置的加密变量，确保敏感信息不暴露在代码中。
- **script**: 这里写你在服务器上需要手动执行的那些命令。

## 4. 进阶：使用 SCP 传输文件 (可选)

如果你不需要在服务器上安装 Git，而是想把编译好的文件（比如 Java 的 `.jar` 包或前端 `dist` 目录）直接传过去，可以配合 `appleboy/scp-action` 使用。

```yaml
- name: Copy files via SCP
  uses: appleboy/scp-action@master
  with:
    host: ${{ secrets.HOST }}
    username: ${{ secrets.USERNAME }}
    key: ${{ secrets.KEY }}
    source: "target/*.jar" # 本地构建好的文件
    target: "/home/user/app/" # 服务器目标路径
```

我是 Chris。在实际开发中，前端和后端的构建与部署逻辑有很大区别：前端通常需要编译成静态文件并上传到 Nginx 目录，而后端（以 Java 为例）则需要编译打包 Jar 包并重启服务。

以下是针对这两个场景完善后的博客内容，你可以将其作为“进阶实战”部分加入到文章中。

---

## 5. 进阶实战：前后端项目的 CI/CD 部署

在真实项目中，我们通常不会直接在服务器上拉取代码编译，而是利用 GitHub Actions 的云端资源进行**构建（Build）**，然后只将生成好的**产物（Artifact）**传输到服务器。这样可以大大减轻服务器的负载。

### 场景一：前端 Vue 项目部署

**核心流程**：安装 Node.js 环境 -> `npm run build` 打包生成 `dist` 目录 -> 将 `dist` 目录传输到服务器 Nginx 路径。

在 `.github/workflows/deploy-vue.yml` 中配置：

```yaml
name: Deploy Vue Frontend

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      # 1. 拉取代码
      - name: Checkout
        uses: actions/checkout@v3

      # 2. 设置 Node.js 环境
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: "18" # 根据你的项目版本调整
          cache: "npm"

      # 3. 安装依赖并构建
      - name: Install and Build
        run: |
          npm install
          npm run build
        # 此时目录下会生成一个 dist 文件夹

      # 4. 将 dist 文件夹传输到服务器 (使用 scp)
      - name: Copy files to Server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.KEY }}
          source: "dist/*"
          # 移除本地路径前缀，确保上传后只有文件内容
          strip_components: 1
          # 目标地址通常是 Nginx 的静态资源目录
          target: "/usr/share/nginx/html/my-vue-app"

      # 5. (可选) 如果配置了 Nginx 缓存，可能需要重启 Nginx
      # - name: Reload Nginx
      #   uses: appleboy/ssh-action@master
      #   ...
```

### 场景二：后端 Java (Spring Boot) 项目部署

**核心流程**：安装 JDK -> Maven 打包生成 `.jar` 文件 -> 传输 Jar 包 -> 登录服务器重启服务。

在 `.github/workflows/deploy-java.yml` 中配置：

```yaml
name: Deploy Java Backend

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      # 1. 拉取代码
      - name: Checkout
        uses: actions/checkout@v3

      # 2. 设置 JDK 环境
      - name: Set up JDK 17
        uses: actions/setup-java@v3
        with:
          java-version: "17"
          distribution: "temurin"
          cache: "maven"

      # 3. Maven 打包 (跳过单元测试以加快速度)
      - name: Build with Maven
        run: mvn clean package -DskipTests

      # 4. 传输 Jar 包到服务器
      - name: SCP Jar to Server
        uses: appleboy/scp-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.KEY }}
          # 假设打包后的文件在 target 目录下
          source: "target/*.jar"
          target: "/home/ubuntu/app/backend"
          strip_components: 1

      # 5. SSH 登录并重启服务
      - name: Restart Application
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.KEY }}
          script: |
            cd /home/ubuntu/app/backend
            # 停止旧进程 (这里通过文件名匹配，请根据实际情况调整)
            # 如果没有正在运行的进程，grep 可能会报错，所以加了 || true
            ps -ef | grep 'my-app.jar' | grep -v grep | awk '{print $2}' | xargs -r kill -9

            # 启动新进程 (使用 nohup 后台运行)
            nohup java -jar my-app.jar > app.log 2>&1 &
            echo "Java Service Restarted!"
```

### ⚠️ 注意事项

1. **路径问题**：`appleboy/scp-action` 传输文件时，如果不加 `strip_components`，它可能会把整个路径结构（如 `target/my-app.jar`）都复制过去，导致服务器上变成 `/home/user/target/my-app.jar`。通常我们需要设置 `strip_components: 1` 来去除第一层目录。
2. **权限问题**：确保你配置的 `USERNAME` 对目标目录（如 Nginx 的 html 目录）拥有写入权限，否则 SCP 传输会失败。
3. **Java 重启脚本**：上面示例中的 `kill` 命令比较简单粗暴。在生产环境中，建议编写专门的 `deploy.sh` 脚本放在服务器上，Action 只需要执行 `sh deploy.sh` 即可，这样更安全且易于维护。

## 6. 进阶：配置飞书或钉钉消息通知

为了第一时间掌握部署结果（成功还是失败），我们可以利用飞书或钉钉群机器人的 Webhook 功能，在 Action 执行结束后自动发送通知。

### 6.1 准备工作

1. **获取 Webhook 地址**：

- **钉钉**：在钉钉群设置 -> 智能群助手 -> 添加机器人 -> 自定义 -> 复制 Webhook 地址。
- **飞书**：在飞书群设置 -> 机器人 -> 添加机器人 -> 自定义机器人 -> 复制 Webhook 地址。

2. **配置 Secrets**：

- 将获取到的完整 Webhook URL（或者钉钉的 Access Token）添加到 GitHub 仓库的 Secrets 中，命名为 `NOTIFY_WEBHOOK`。

### 6.2 修改 Workflow 文件

在 `steps` 的最后添加通知步骤。这里我们利用 `if: always()` 保证无论部署成功还是失败，都会触发通知。

#### 方案 A：钉钉通知 (使用 `zcong1993/actions-ding`)

这是一个社区常用的钉钉插件，配置非常简单。

```yaml
# ... 上面是部署步骤 ...

- name: 发送钉钉通知
  if: always() # 保证无论成功失败都执行
  uses: zcong1993/actions-ding@master
  with:
    # 这里只需要填 Webhook 链接中 access_token= 后面的那串字符
    dingToken: ${{ secrets.DING_TOKEN }}
    body: |
      {
        "msgtype": "link", 
        "link": {
          "text": "构建结果：${{ job.status }} \n提交信息：${{ github.event.head_commit.message }}", 
          "title": "${{ github.repository }} 部署通知", 
          "picUrl": "", 
          "messageUrl": "https://github.com/${{ github.repository }}/actions"
        }
      }
```

#### 方案 B：飞书通知 (使用通用 curl 命令)

飞书目前官方没有提供 Action，直接使用 `curl` 发送请求是最稳定且无需依赖第三方插件的方式。

```yaml
# ... 上面是部署步骤 ...

- name: 发送飞书通知
  if: always()
  run: |
    # 根据 job 状态设置不同的表情
    if [ "${{ job.status }}" == "success" ]; then
      STATUS_ICON="✅"
    else
      STATUS_ICON="❌"
    fi

    # 发送 POST 请求
    curl -X POST -H "Content-Type: application/json" \
    -d '{
      "msg_type": "text",
      "content": {
        "text": "'"$STATUS_ICON"' 部署结束 \n项目：${{ github.repository }} \n状态：${{ job.status }}"
      }
    }' \
    ${{ secrets.FEISHU_WEBHOOK }}
```

### 6.3 效果验证

配置完成后，当你再次提交代码触发 Action 时，你的工作群就会收到类似下面的消息：

- **成功时**：✅ 部署结束 - 状态：success
- **失败时**：❌ 部署结束 - 状态：failure

这样你就不需要时刻盯着 GitHub 的页面等待进度条了。
