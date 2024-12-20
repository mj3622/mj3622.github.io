---
title: Redis高级篇
published: 2024-12-19
description: 本文为Redis进阶相关的学习笔记，包括持久化、主从、哨兵、分片和多级缓存等内容
image: ./assets/cover.png
tags: [Redis]
category: 学习笔记
draft: false
---

# 1. 分布式缓存

由于单点Redis中存在以下问题，因此在本节中，将一一介绍其对应的解决方法。

![image-20241219213716433](./assets/image-20241219213716433.png)

## 1.1 RDB（Redis DataBase）持久化

#### **概念**

- RDB 是 Redis 的一种快照（Snapshotting）持久化方式。
- 在特定的时间间隔，将 Redis 内存中的数据以二进制文件的形式保存到磁盘。
- 默认的 RDB 文件名为 `dump.rdb`。

#### **工作原理**

- Redis 会通过 `fork` 操作创建一个子进程。
- 子进程将当前内存数据写入到临时文件，写入完成后用该文件替换之前的 RDB 文件。

#### **触发方式**

1. **手动触发**：

   - 使用 `SAVE` 命令：阻塞式生成 RDB 文件。
   - 使用 `BGSAVE` 命令：非阻塞式生成 RDB 文件。

2. **自动触发**：

   - 根据 `save` 配置项，设置满足条件时自动触发（如写操作达到一定数量或时间间隔）。

     ```bash
     # redis.conf
     # save ""		 # 禁用 RDB 快照
     save 900 1       # 在 900 秒内（15 分钟）至少有 1 次写操作时触发 RDB 快照
     save 300 10      # 在 300 秒内（5 分钟）至少有 10 次写操作时触发 RDB 快照
     save 60 10000    # 在 60 秒内（1 分钟）至少有 10000 次写操作时触发 RDB 快照
     dbfilename dump.rdb  # RDB 文件的文件名
     dir /path/to/dir     # 保存 RDB 文件的路径
     stop-writes-on-bgsave-error yes  # RDB 生成错误时停止写操作
     ```

#### **优点**

- **磁盘占用小**：只保存某一时刻的完整数据快照。
- **恢复速度快**：加载 RDB 文件时速度较快。
- **性能较高**：持久化由子进程完成，主进程无需处理磁盘 I/O。

#### **缺点**

- **可能丢失数据**：如果 Redis 在快照之间宕机，会丢失最近一次快照之后的数据。
- **不适合频繁持久化**：快照操作较重，频繁执行可能影响性能。



## 1.2 AOF（Append Only File）持久化

#### **概念**

- AOF 是 Redis 的日志型持久化方式。
- 它会以日志形式记录每个写入操作，将其追加到一个文件中（默认文件名为 `appendonly.aof`）。

#### **工作原理**

- Redis 将每一个写操作（如 `SET`、`HSET`）以文本形式记录到 AOF 文件。
- 定期根据策略对 AOF 文件进行重写（压缩），以减小文件大小。

#### **触发方式**

配置项控制写入时机：

- `appendfsync always`：每次写操作都立即同步到磁盘，性能较差但最安全。
- `appendfsync everysec`（默认）：每秒同步一次，性能和数据安全性之间的平衡。
- `appendfsync no`：由操作系统决定何时写入，性能最高但最不安全。

```bash
# redis.conf
appendonly yes              # 开启 AOF 持久化（默认关闭）
appendfilename "appendonly.aof"  # AOF 文件名
appendfsync always          # 每次写操作后立即同步到磁盘（性能低，数据最安全）
appendfsync everysec        # 每秒同步一次（默认，性能与安全的平衡）
appendfsync no              # 操作系统决定何时同步（性能高，数据安全性低）
no-appendfsync-on-rewrite yes  # AOF 重写期间，不进行磁盘同步
auto-aof-rewrite-percentage 100  # AOF 文件大小是上次重写时的 100% 时触发重写
auto-aof-rewrite-min-size 64mb  # AOF 文件最小达到 64MB 时允许触发重写
```

#### **优点**

- **更高的数据安全性**：每次写操作都会记录，最多丢失最近 1 秒的数据（`everysec` 模式）。
- **可读性强**：AOF 文件是可读的文本文件，便于分析和修复数据。
- **灵活性高**：可以根据实际需要选择同步策略。

#### **缺点**

- **磁盘占用大**：AOF 文件比 RDB 文件大，特别是写操作频繁时。使用`BGREWRITEAOF`指令重写可以进行一定程度的优化。
- **恢复速度慢**：加载 AOF 文件需要重放所有日志，速度较慢。
- **性能影响**：频繁写入磁盘可能影响 Redis 性能。



## 1.3 Redis主从

![image-20241220095942137](./assets/image-20241220095942137.png)

### 1. 搭建主从集群

接着尝试尝试写入数据看是否能进行数据同步：

```bash
# 从节点
127.0.0.1:7001> get k
(nil)

# 主节点
127.0.0.1:7000> set k 1
OK

# 从节点
127.0.0.1:7001> get k
"1"
```

**1.编写配置文件**

`redis-cluster/master/redis.conf`

```bash
# redis实例的声明 IP
replica-announce-ip 10.0.2.15

port 7000
bind 0.0.0.0
protected-mode no
appendonly yes
```



`redis-cluster/slave1/redis.conf`（其他从节点类似）

```bash
# slave1 - redis.conf
replica-announce-ip 10.0.2.15
replicaof 10.0.2.15 7000

port 7001
bind 0.0.0.0
protected-mode no
appendonly yes
```



**2.分别启动三个实例**

为了方便查看日志，我们打开3个ssh窗口，分别启动3个redis实例，启动命令：

```bash
# 第1个
redis-server master/redis.conf --daemonize yes
# 第2个
redis-server slave1/redis.conf --daemonize yes
# 第3个
redis-server slave2/redis.conf --daemonize yes
```

若要一键停止可以使用如下命令：

```bash
printf '%s\n' 7000 7001 7002 | xargs -I{} -t redis-cli -p {} shutdown
```



**3.验证可用性**

分别使用命令`redis-cli -p 7000 info replication`观察三个实例，可以发现构成为一主二从

![image-20241220195942620](./assets/image-20241220195942620.png)

![image-20241220200001918](./assets/image-20241220200001918.png)

![image-20241220200016825](./assets/image-20241220200016825.png)

接着尝试写入数据，观察能否同步

```bash
# 从节点
127.0.0.1:7001> get k
(nil)

# 主节点
127.0.0.1:7000> set k 1
OK

# 从节点
127.0.0.1:7001> get k
"1"
```

### 2. 数据同步原理

![image-20241220114221628](./assets/image-20241220114221628.png)

`replid` ：是一个唯一标识符，用于标识Redis实例的复制状态。每个Redis节点（无论是主节点还是从节点）都有一个唯一的 `replid`。

`offset` ：是一个数字，表示主节点复制积压缓冲区中的数据的偏移量。它标识了主节点写操作的顺序，用于确保主从同步中增量数据的正确传输。

#### **初始同步（全量同步）**

当从节点第一次连接到主节点时，会执行一次全量同步，步骤如下：

1. **从节点向主节点发送SYNC命令**：当从节点启动并连接到主节点时，会向主节点发送一个`SYNC`命令，表示准备进行数据同步。
2. **主节点开始创建RDB快照**：主节点会创建一个RDB（Redis数据备份）快照，这时主节点会暂停处理写请求并将内存中的数据写入到磁盘。
3. **从节点接收数据快照**：主节点生成RDB文件之后，将整个数据集（即RDB文件）发送给从节点。
4. **从节点加载RDB文件**：从节点接收到完整的RDB文件后，将文件加载到内存中，完成初步数据同步。



![image-20241220114754497](./assets/image-20241220114754497.png)

#### **增量同步（部分同步）**

在全量同步后，主节点和从节点会持续进行增量同步：

1. **主节点的写操作**：主节点在进行数据写操作时，会将这些操作记录到一个叫做`replication backlog`（复制积压缓冲区）的小缓冲区中。
2. **从节点的同步**：从节点会定期向主节点发送`PSYNC`命令，请求同步自上次同步以来的增量数据。
3. **主节点返回增量数据**：主节点会将自上次同步以来的所有写操作（包括`SET`、`DEL`等）发送给从节点，确保从节点数据的实时更新。

> [!NOTE]
>
> repl_baklog大小有上限，写满后会覆盖最早的数据。如果slave断开时间过久，导致尚未备份的数据被覆盖，则无法基于log做增量同步，只能再次全量同步。



#### 使用优化

- 在master中配置`repl-diskless-sync yes`启用无磁盘复制，避免全量同步时的磁盘lO。
- Redis单节点上的内存占用不要太大，减少RDB导致的过多磁盘IO。
- 适当提高repl_baklog的大小，发现slave岩机时尽快实现故障恢复，尽可能避免全量同步。
- 限制一个master上的slave节点数量，如果实在是太多slave，则可以采用主-从-从链式结构，减少master压力。



## 1.4 Redis哨兵

### 1. 基本介绍

Redis 哨兵（**Sentinel**）是一个用于 Redis 集群高可用性（High Availability, HA）管理的系统，它通过监控、通知和故障转移等机制，确保 Redis 服务在出现故障时能够自动恢复，保证系统的高可用性。



#### 哨兵的作用：

1. **监控**（Monitoring）

   - 哨兵会定期检查 Redis 实例的状态（包括主节点和从节点）。它通过发送`PING`命令来检查节点是否处于正常运行状态。如果发现某个 Redis 节点不可用（例如：由于网络问题或节点宕机），哨兵会将该节点标记为下线（fail）。

   - 哨兵可以监控多个 Redis 实例，包括主节点和从节点。

2. **自动故障转移**（Automatic Failover）
   - 当主节点发生故障（例如宕机或无法响应）时，Redis 哨兵会自动进行故障转移。
3. **通知**（Notification）
   - 当 Redis 节点出现问题（例如：故障、下线等），哨兵会通过配置的通知方式（如邮件、短信、HTTP 请求等）通知管理员。



#### 监控服务的原理

1. **定期发送`PING`命令**：哨兵通过每秒向被监控的 Redis 实例发送`PING`命令，检测节点是否存活。
2. **基于响应的超时判断**：如果被监控节点在指定时间内没有响应，哨兵会将其标记为疑似下线（`Subjectively Down`，简称`SDOWN`）。
3. **多哨兵协作验证**：如果标记主节点为`SDOWN`的哨兵数量达到`quorum`值，那么该节点会被标记为客观下线（`Objectively Down`，简称`ODOWN`）。
4. **故障检测与恢复**：当主节点被标记为`ODOWN`时，哨兵会启动故障转移流程。



#### 选举依据

一旦发现master故障，sentinel需要在salve中选择一个作为新的master，选择依据是这样的：

1. 首先会判断slave节点与master节点断开时间长短，如果超过指定值$（down-after-milliseconds*10）$则会排除该slave节点
2. 然后判断slave节点的`slave-priority`值，越小优先级越高，如果是0则永不参与选举
3. 如果`slave-prority`一样，则判断slave节点的`offset`值，越大说明数据越新，优先级越高
4. 最后是判断slave节点的运行id大小，越小优先级越高



#### 故障转移流程

![image-20241220161442406](./assets/image-20241220161442406.png)



### 2. 搭建哨兵集群

1.如果没有安装`redis-sentinel`，先运行下面的指令安装

```bash
sudo apt update
sudo apt install redis-sentinel -y
```



2.为每个哨兵编写一份配置文件

```bash
port 26379
bind 0.0.0.0
sentinel monitor mymaster 10.0.2.15 6379 2
sentinel down-after-milliseconds mymaster 5000
sentinel failover-timeout mymaster 10000
sentinel parallel-syncs mymaster 1

# 多个主节点的配置（如果有的话）
# sentinel monitor mymaster2 10.0.2.15 6380 2
# sentinel down-after-milliseconds mymaster 5000
# sentinel failover-timeout mymaster 10000
# sentinel parallel-syncs mymaster 1
```

- `mymaster`：主节点的名称。
- `10.0.2.15 6379`：主节点的地址和端口。
- `2`：需要至少两个哨兵实例同意，才会进行故障转移。



3.分别启动三个哨兵

```bash
# 第1个
redis-sentinel s1/sentinel.conf
# 第2个
redis-sentinel s2/sentinel.conf
# 第3个
redis-sentinel s3/sentinel.conf
```



4.测试

手动关停7000端口主节点，若观察到主节点发生切换，即证明哨兵正常运行

![image-20241220164315051](./assets/image-20241220164315051.png)



### 3. RedisTemplate连接哨兵

1. 引入redis依赖

   ```xml
   <dependency>
       <groupId>org.springframework.boot</groupId>
       <artifactId>spring-boot-starter-data-redis</artifactId>
   </dependency>
   ```

2. 再`application.yml`中配置相关信息

   ```yml
   spring:
     data:
       redis:
         sentinel:
           master: mymaster	# 之前配置的master名称
           nodes:	# sentinel节点
             - 192.168.64.10:27000
             - 192.168.64.10:27001
             - 192.168.64.10:27002
   ```

3. 配置主从读写分离

   ```java
   @Bean
   public LettuceClientConfigurationBuilderCustomizer lettuceClientConfigurationBuilderCustomizer() {
       return clientConfigurationBuilder -> clientConfigurationBuilder.readFrom(ReadFrom.REPLICA_PREFERRED);
   }
   ```

   - MASTER：从主节点读取
   - MASTER_PREFERRED：优先从master节点读取，master不可用才读取replica
   - REPLICA：从slave（replica）节点读取
   - REPLICA_PREFERRED：优先从slave（replica）节点读取，所有的slave都不可用才读取master
