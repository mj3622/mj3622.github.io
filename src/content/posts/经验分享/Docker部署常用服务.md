---
title: Docker 部署常用服务
published: 2025-03-10
description: 记录 Docker Engine 的安装方法，以及 Nginx、MySQL、Redis、RabbitMQ、Nacos 和 MinIO 的单机部署命令
tags: [Docker, 容器化, 部署]
category: 经验分享
draft: false
---

我经常需要在本地临时跑一个 MySQL 或 Redis。直接安装当然也行，但用完以后还要处理服务、配置和数据目录，时间久了机器上会留下一堆自己都记不清的东西。

Docker 更适合这种场景：镜像负责提供运行环境，容器负责运行服务，数据则单独放进卷里。删掉容器不会顺手删掉数据，下次换个镜像还可以接着用。

> 下面的命令用于单机学习和开发环境。密码必须替换，数据库与管理端口不要直接暴露到公网

# 1. 先认识四个概念

- 镜像（Image）是只读的运行模板，里面有应用、依赖和默认配置
- 容器（Container）是镜像启动后的实例，可以停止、重建或删除
- 仓库（Registry）保存并分发镜像，Docker Hub 是最常见的公共仓库
- Dockerfile 记录镜像的构建步骤，适合打包自己的应用

镜像和容器最容易混淆。可以把镜像看成安装包，把容器看成已经启动的程序，不过容器还多了一层文件系统和资源隔离。

# 2. 安装 Docker Engine

Linux 发行版的安装命令会变化。下面只保留 Docker 官方仓库的当前做法，遇到发行版版本不匹配时，应回到 [Docker Engine 安装文档](https://docs.docker.com/engine/install/)核对。

## 2.1 CentOS Stream

Docker 当前支持仍在维护的 CentOS Stream 版本。先加入官方 RPM 仓库，再安装 Engine、Buildx 和 Compose 插件。

```shell
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

sudo dnf install docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo systemctl enable --now docker
sudo docker run --rm hello-world
```

## 2.2 Ubuntu

Ubuntu 使用官方 APT 仓库。旧教程里的 `apt-key` 已经不适合继续使用，GPG 密钥应放进 `/etc/apt/keyrings`。

```shell
sudo apt update
sudo apt install -y ca-certificates curl

sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources > /dev/null <<EOF_DOCKER
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF_DOCKER

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

sudo docker run --rm hello-world
```

默认情况下，普通用户需要通过 `sudo` 调用 Docker。把用户加入 `docker` 组会获得接近 root 的权限，不应只把它当成省略几个字符的小设置；个人开发机确认风险后，可以执行：

```shell
sudo usermod -aG docker "$USER"
```

退出并重新登录后生效

# 3. 常用命令

| 命令 | 用途 |
| --- | --- |
| `docker pull <image>` | 拉取镜像 |
| `docker images` | 查看本地镜像 |
| `docker ps` | 查看运行中的容器 |
| `docker ps -a` | 查看所有容器 |
| `docker logs -f --tail 100 <container>` | 持续查看最近日志 |
| `docker exec -it <container> <command>` | 在容器内执行命令 |
| `docker stop <container>` | 停止容器 |
| `docker start <container>` | 再次启动已有容器 |
| `docker rm <container>` | 删除容器 |
| `docker volume ls` | 查看数据卷 |

我通常先看 `docker ps -a`，确认容器到底是没启动，还是启动后立刻退出。后一种情况直接看日志，比反复重跑命令有效得多。

# 4. 部署常见服务

下面示例尽量把管理端口绑定到 `127.0.0.1`，这样只有宿主机能直接访问。需要让局域网设备连接时，再根据防火墙和网络环境调整监听地址。

示例使用稳定大版本或官方维护的浮动标签，方便复制运行。长期环境应固定到经过验证的补丁版本，并在升级前阅读对应的发布说明。

## 4.1 Nginx

### 启动容器

```shell
docker run -d \
  --name nginx \
  -p 80:80 \
  -p 443:443 \
  -v nginx_html:/usr/share/nginx/html \
  -v nginx_conf:/etc/nginx/conf.d \
  --restart unless-stopped \
  nginx:stable-alpine
```

两个命名卷分别保存网页文件和站点配置。第一次创建卷时，Docker 会把镜像内的默认内容复制进去。

### 验证部署

```shell
docker ps --filter name=nginx
curl -I http://localhost
```

返回 Nginx 响应头后，说明端口映射已经生效

## 4.2 MySQL

### 启动容器

```shell
docker run -d \
  --name mysql \
  -p 127.0.0.1:3306:3306 \
  -e MYSQL_ROOT_PASSWORD='replace_with_a_strong_password' \
  -v mysql_data:/var/lib/mysql \
  --restart unless-stopped \
  mysql:8.4
```

`mysql_data` 保存数据库文件。删除并重建容器时，只要继续挂载这个卷，原来的数据就还在。

### 验证部署

MySQL 第一次启动需要初始化数据目录，看到容器处于运行状态不等于已经可以连接。先看日志，出现 ready for connections 后再进入客户端。

```shell
docker logs -f mysql
docker exec -it mysql mysql -u root -p
```

## 4.3 Redis

官方 Redis 镜像不会读取 `REDIS_PASSWORD` 环境变量。要设置密码，可以传入 `--requirepass`，或者挂载自己的 `redis.conf`。

### 启动容器

```shell
docker run -d \
  --name redis \
  -p 127.0.0.1:6379:6379 \
  -v redis_data:/data \
  --restart unless-stopped \
  redis:8-alpine \
  redis-server --appendonly yes --requirepass 'replace_with_a_strong_password'
```

这里同时打开了 AOF 持久化。密码直接出现在命令行历史中仍然不够稳妥，生产环境更适合挂载配置文件或使用密钥管理方案。

### 验证部署

```shell
docker exec -it redis \
  redis-cli -a 'replace_with_a_strong_password' PING
```

返回 `PONG` 即可

## 4.4 RabbitMQ

`management` 标签已经启用管理插件，5672 是 AMQP 端口，15672 是管理页面端口

### 启动容器

```shell
docker run -d \
  --name rabbitmq \
  -p 127.0.0.1:5672:5672 \
  -p 127.0.0.1:15672:15672 \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS='replace_with_a_strong_password' \
  -v rabbitmq_data:/var/lib/rabbitmq \
  --restart unless-stopped \
  rabbitmq:4-management
```

### 验证部署

```shell
docker exec rabbitmq rabbitmq-diagnostics -q ping
```

命令成功后，打开 `http://localhost:15672`，使用上面设置的账号和密码登录

## 4.5 Nacos

Nacos 官方的单机镜像适合学习和开发，不适合直接替代生产集群。当前版本的控制台和服务端口已经分开，因此示例同时映射 8080、8848 和 9848。

先创建只存放在本机的环境变量文件 `nacos.env`：

```dotenv
MODE=standalone
NACOS_AUTH_ENABLE=true
NACOS_AUTH_ADMIN_ENABLE=true
NACOS_AUTH_CONSOLE_ENABLE=true
NACOS_AUTH_SYSTEM_TYPE=nacos
NACOS_AUTH_TOKEN=replace_with_a_base64_secret_longer_than_32_bytes
NACOS_AUTH_IDENTITY_KEY=serverIdentity
NACOS_AUTH_IDENTITY_VALUE=replace_with_a_random_identity_value
```

`NACOS_AUTH_TOKEN` 应由至少 32 字节的随机内容生成，再进行 Base64 编码。不要把真实的 `nacos.env` 提交到仓库。

```shell
openssl rand -base64 48
```

### 启动容器

```shell
docker run -d \
  --name nacos \
  --env-file nacos.env \
  -p 127.0.0.1:8080:8080 \
  -p 127.0.0.1:8848:8848 \
  -p 127.0.0.1:9848:9848 \
  --restart unless-stopped \
  nacos/nacos-server:latest
```

### 验证部署

```shell
docker logs -f nacos
```

启动完成后访问 `http://localhost:8080`。首次启用鉴权时，按控制台提示初始化管理员密码并妥善保存。

## 4.6 MinIO

单节点、单磁盘 MinIO 适合本地测试，没有额外的数据冗余。9000 提供 S3 API，9001 是 Web Console。

### 启动容器

```shell
docker run -d \
  --name minio \
  -p 127.0.0.1:9000:9000 \
  -p 127.0.0.1:9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD='replace_with_a_strong_password' \
  -v minio_data:/mnt/data \
  --restart unless-stopped \
  quay.io/minio/minio \
  server /mnt/data --console-address ':9001'
```

### 验证部署

```shell
docker logs --tail 100 minio
```

打开 `http://localhost:9001` 登录控制台，应用连接 S3 API 时使用 `http://localhost:9000`

# 5. 更新、重建与删除

容器不应该靠进入内部手工更新。拉取新镜像后删除旧容器，再用原命令重建；数据卷不变，服务数据也不会因为容器重建而消失。

```shell
docker pull mysql:8.4
docker stop mysql
docker rm mysql

# 重新执行前面的 docker run 命令
```

如果服务不再需要，先删容器，再决定是否删除数据卷：

```shell
docker stop mysql
docker rm mysql

# 确认数据不再需要后再执行
docker volume rm mysql_data
```

最后一条命令会直接删除数据库文件，没有回收站。动手之前最好先运行 `docker volume inspect mysql_data`，确认卷名和挂载位置。

# 6. 常见问题

## 6.1 容器启动后立刻退出

先查状态和日志：

```shell
docker ps -a
docker logs --tail 200 <container_name>
```

常见原因是启动参数错误、配置文件无法读取，或者挂载目录权限不对

## 6.2 端口已经被占用

`Bind for 0.0.0.0:xxxx failed` 表示宿主机端口冲突。可以停止占用端口的程序，也可以修改 `-p` 左边的宿主机端口。

```shell
lsof -i :3306
```

例如 `-p 13306:3306` 表示通过宿主机 13306 访问容器内的 3306

## 6.3 重建容器后数据不见了

先检查新容器是否挂载了原来的命名卷：

```shell
docker inspect <container_name> --format '{{json .Mounts}}'
docker volume ls
```

数据通常没有消失，只是新容器挂到了另一个卷或空目录

# 7. 参考资料

- [Docker Engine 安装文档](https://docs.docker.com/engine/install/)
- [Docker 官方 Redis 镜像](https://hub.docker.com/_/redis)
- [Docker 官方 MySQL 镜像](https://hub.docker.com/_/mysql)
- [Docker 官方 RabbitMQ 镜像](https://hub.docker.com/_/rabbitmq)
- [Nacos Docker 快速开始](https://nacos.io/en/docs/latest/quickstart/quick-start-docker/)
- [MinIO 单节点容器部署](https://min.io/docs/minio/container/operations/install-deploy-manage/deploy-minio-single-node-single-drive.html)
