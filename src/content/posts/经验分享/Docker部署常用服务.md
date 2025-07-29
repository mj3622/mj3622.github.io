---
title: Docker部署常用服务
published: 2025-03-10
description: Docker 通过容器化技术简化了应用的开发、测试和部署流程，提高了效率和一致性。本文将介绍如何利用docker快速部署一些常见的服务。
tags: [docker]
category: 经验分享
draft: false
---

# 1. Docker基本介绍

[Docker](https://www.docker.com/) 是一个开源的应用容器引擎，允许开发者将应用及其依赖打包到一个轻量级、可移植的容器中。容器化技术使得应用可以在任何支持 Docker 的环境中运行，确保环境一致性。



## 1.1 Docker 的核心概念

1. **镜像（Image）**：Docker 镜像是一个只读模板，包含运行应用所需的代码、库、环境变量和配置文件。镜像是容器的基础。

2. **容器（Container）**：容器是镜像的运行实例。容器是轻量级的，包含应用及其依赖，但共享主机操作系统的内核。

3. **仓库（Registry）**：Docker 仓库用于存储和分发 Docker 镜像。Docker Hub 是最常用的公共仓库，用户也可以搭建私有仓库。

4. **Dockerfile**：Dockerfile 是一个文本文件，包含一系列指令，用于自动化构建 Docker 镜像。



## 1.2 Docker 的优势

- **环境一致性**：确保开发、测试和生产环境一致，避免“在我机器上能运行”的问题。
- **快速部署**：容器启动速度快，资源占用少，适合微服务架构。
- **隔离性**：每个容器相互隔离，确保应用安全性和稳定性。
- **可移植性**：容器可以在任何支持 Docker 的平台上运行，简化了跨平台部署。



## 1.3 安装 Docker

### CentOS系统

1. **更新软件包列表：**

   ```shell
   sudo yum update
   ```

2. **安装必要的依赖包：**

   ```shell
   sudo yum install -y yum-utils device-mapper-persistent-data lvm2
   ```

3. **添加Docker的官方存储库：**

   ```shell
   sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
   ```

4. **安装Docker引擎：**

   ```shell
   sudo yum install docker-ce docker-ce-cli containerd.io
   ```

5. **启动Docker服务：**

   ```shell
   sudo systemctl start docker
   ```

6. **将Docker添加到启动项，使其在系统启动时自动启动：**

   ```shell
   sudo systemctl enable docker
   ```

7. **验证Docker是否成功安装：**

   ```shell
   sudo docker run hello-world
   ```

   如果一切正常，你将看到一条消息，表示Docker已经正确安装和配置。

8. **配置Docker命令免sudo（可选，添加用户到docker组）：**

   ```shell
   sudo usermod -aG docker your_username
   ```

   请将 `your_username` 替换为你的实际用户名。然后退出当前终端会话，或者运行 `su - your_username`，以使更改生效。



### Ubuntu系统

1. **更新软件包列表：**

   ```shell
   sudo apt update
   ```

2. **安装依赖包以允许apt使用HTTPS：**

   ```shell
   sudo apt install apt-transport-https ca-certificates curl software-properties-common
   ```

3. **添加Docker的官方GPG密钥：**

   ```shell
   curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
   ```

4. **设置Docker的稳定存储库：**

   ```shell
   echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
   ```

   如果你使用的是其他架构，例如arm64，可以将 `[arch=amd64]` 部分替换为 `[arch=arm64]`。

5. **更新软件包列表（再次更新）：**

   ```shell
   sudo apt update
   ```

6. **安装Docker引擎：**

   ```shell
   sudo apt install docker-ce docker-ce-cli containerd.io
   ```

7. **启动Docker服务：**

   ```shell
   sudo systemctl start docker
   ```

8. **将Docker添加到启动项，使其在系统启动时自动启动：**

   ```shell
   sudo systemctl enable docker
   ```

9. **验证Docker是否成功安装：**

   ```shell
   sudo docker run hello-world
   ```

   如果一切正常，你将看到一条消息，表示Docker已经正确安装和配置。

   

# 2. 常用命令

- `docker pull <image>`：从仓库拉取镜像。
- `docker build -t <image_name> .`：根据 Dockerfile 构建镜像。
- `docker run <image>`：运行容器。
- `docker ps`：查看运行中的容器。
- `docker stop <container_id>`：停止容器。
- `docker rm <container_id>`：删除容器。
- `docker rmi <image_id>`：删除镜像。



# 3. 部署常见服务

### 

## 3.1 Nginx

### 1. 拉取镜像

```bash
docker pull nginx:1.25-alpine
```



### 2. 创建并运行容器

```bash
docker run -d \
  --name nginx \
  -p 80:80 \
  -p 443:443 \
  -v nginx_html:/usr/share/nginx/html \
  -v nginx_conf:/etc/nginx/conf.d \
  --restart unless-stopped \
  nginx:1.25-alpine
```

- `-p 80:80`：映射容器内 HTTP 端口 80 → 宿主机 80
- `-p 443:443`：映射容器内 HTTPS 端口 443 → 宿主机 443
- `-v nginx_html:/usr/share/nginx/html`：挂载网站文件目录
- `-v nginx_conf:/etc/nginx/conf.d`：挂载 Nginx 配置文件目录
- `--restart unless-stopped`：容器退出时自动重启



### 3. 验证部署

- 查看容器状态：`docker ps | grep nginx`
- 访问测试页面：浏览器打开 `http://localhost` 或 `http://服务器IP`，显示 Nginx 欢迎页



## 3.2 MySQL

### 1. 拉取镜像

```bash
docker pull mysql:latest
```



### 2. 创建并运行容器

```bash
docker run -d \
  --name mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=your_secure_password \
  -v mysql_data:/var/lib/mysql \
  --restart unless-stopped \
  mysql:latest
```

- `-p 3306:3306`：映射容器内 MySQL 端口 3306 → 宿主机 3306
- `-e MYSQL_ROOT_PASSWORD=your_secure_password`：设置 MySQL root 用户密码
- `-v mysql_data:/var/lib/mysql`：挂载数据卷（持久化数据库文件）
- `--restart unless-stopped`：容器退出时自动重启



### 3. 验证部署

- 查看容器状态：`docker ps | grep mysql`
- 命令行验证：`docker exec -it mysql mysql -u root -p` 输入密码后进入 MySQL Shell



## 3.3 Redis

### 1. 拉取镜像

```bash
docker pull redis:latest
```



### 2. 创建并运行容器

```bash
docker run -d \
  --name redis \
  -p 6379:6379 \
  -e REDIS_PASSWORD=your_secure_password \
  -v redis_data:/data \
  --restart unless-stopped \
  redis:latest
```

- `-p 6379:6379`：映射容器内 Redis 端口 6379 → 宿主机 6379
- `-e REDIS_PASSWORD=your_secure_password`：设置 Redis 访问密码
- `-v redis_data:/data`：挂载数据卷（持久化 Redis 数据）
- `--restart unless-stopped`：容器退出时自动重启



### 3. 验证部署

- 查看容器状态：`docker ps | grep redis`
- 命令行验证：`docker exec -it redis redis-cli -a your_secure_password PING` 返回 `PONG`



## 3.4 RabbitMQ

### 1. 拉取镜像

```bash
docker pull rabbitmq:3.13-management
```



### 2. 创建并运行容器

```bash
docker run -d \
  --name rabbitmq \
  -p 5672:5672 \
  -p 15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=your_secure_password \
  -v rabbitmq_data:/var/lib/rabbitmq \
  --restart unless-stopped \
  rabbitmq:3.13-management
```

-  `-p 5672:5672`：映射容器内 AMQP 协议端口 5672 → 宿主机 5672（消息通信）
- `-p 15672:15672`：映射容器内 HTTP 端口 15672 → 宿主机 15672（管理界面）
- ` -e RABBITMQ_DEFAULT_USER=admin`：设置环境变量：RabbitMQ 默认用户名
- `-e RABBITMQ_DEFAULT_PASS=your_secure_password`：设置环境变量：默认用户密码
- `-v rabbitmq_data:/var/lib/rabbitmq`：挂载数据卷（宿主机命名卷 → 容器数据目录）
- `--restart unless-stopped`：容器退出时自动重启（除非手动停止）



### 3. 验证部署

- 查看容器状态：`docker ps | grep rabbitmq`
- 访问管理界面：http://localhost:15672 或 http://服务器IP:15672。使用设置的账号密码登录（admin/your_secure_password）

## 3.5 Nacos
### 1. 拉取镜像

```bash
docker pull nacos/nacos-server:latest
```
### 2. 创建并运行容器

```bash
docker run --name nacos-standalone-derby \
    -e MODE=standalone \
    -e NACOS_AUTH_TOKEN=${your_nacos_auth_secret_token} \
    -e NACOS_AUTH_IDENTITY_KEY=${your_nacos_server_identity_key} \
    -e NACOS_AUTH_IDENTITY_VALUE=${your_nacos_server_identity_value} \
    -p 8848:8848 \
    -d nacos/nacos-server:latest
```
- `-e MODE=standalone`：设置 Nacos 运行模式为单机模式
- `-e NACOS_AUTH_TOKEN=${your_nacos_auth_secret_token}`：Nacos 用于生成JWT Token的密钥，使用长度大于32字符的字符串，再经过Base64编码。
- `-e NACOS_AUTH_IDENTITY_KEY=${your_nacos_server_identity_key}`：Nacos Server端之间 Inner API的身份标识的Key
- `-e NACOS_AUTH_IDENTITY_VALUE=${your_nacos_server_identity_value}`：Nacos Server端之间 Inner API的身份标识的Value
- `-p 8848:8848`：映射容器内 Nacos 控制台端口

### 3. 验证部署
- 查看容器状态：`docker ps | grep nacos-standalone`
- 访问 Nacos 控制台：http://localhost:8848/nacos

