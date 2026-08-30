---
title: "从 WebSocket 到 Spring STOMP：实时通信、连接管理与消息顺序实践"
published: 2026-07-18
description: "从 WebSocket 握手、连接鉴权到 Spring STOMP 路由，梳理实时通信中连接管理、并发发送、背压与端到端消息顺序的工程实践"
tags: [Java, Spring Boot, WebSocket, STOMP]
category: 编程实践
draft: false
---

实时聊天、在线通知、协同编辑、订单状态推送等场景，都要求服务端能够主动向客户端发送消息。

传统 HTTP 更偏向“客户端发起请求，服务端返回响应”。即使使用轮询或长轮询，本质上仍由客户端驱动。WebSocket 则建立一条可长期保持的双向通信通道，让客户端与服务端都能主动发送消息。

但在生产环境中，建立连接只是开始。连接如何鉴权、用户与连接如何关联、多个线程如何安全发送、慢客户端如何处理、消息顺序如何定义，才是实时通信最容易出问题的部分。

下面以 Servlet 栈的 Spring 应用为例，依次讨论：

1. WebSocket 的握手与适用边界；
2. JSR 356、Spring WebSocket 与 STOMP 的职责差异；
3. 连接鉴权、会话管理与用户级消息；
4. 同一连接的并发发送与顺序投递；
5. 背压、确认、重连与集群下的端到端顺序。

---

## 一、WebSocket 解决的是什么问题

WebSocket 是支持全双工通信的网络协议。连接建立后，客户端和服务端都可以随时向对方发送消息，不再受 HTTP “一次请求对应一次响应”模型的限制。

常见地址如下：

~~~text
ws://example.com/ws/chat
wss://example.com/ws/chat
~~~

其中：

- **ws://** 表示未加密的 WebSocket 连接，通常对应 HTTP；
- **wss://** 表示经 TLS 加密的 WebSocket 连接，通常对应 HTTPS；
- WebSocket 可以复用现有的 80、443 端口、域名、证书、反向代理和负载均衡入口。

### 1. WebSocket 与 HTTP 的关系

把 WebSocket 简单理解为“基于 HTTP 的长连接”并不准确。HTTP 主要负责连接开始时的协议升级；升级成功后，双方通过 WebSocket 帧而非普通 HTTP 请求与响应通信。

~~~http
GET /ws/chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: xxx
Sec-WebSocket-Version: 13
~~~

服务端同意升级时会返回：

~~~http
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: xxx
~~~

整个过程可以概括为：

~~~text
HTTP Upgrade 握手
        ↓
101 Switching Protocols
        ↓
后续通过 WebSocket 帧双向通信
~~~

使用 HTTP Upgrade 的价值在于兼容现有互联网基础设施，而不是让后续消息继续按 HTTP 语义传输。

### 2. 不要为了“实时”而默认选择 WebSocket

WebSocket 很适合高频、低延迟、双向的交互，例如聊天室、协作编辑、设备控制和游戏状态同步。但它并不是唯一答案：

| 需求 | 更合适的选择 |
| --- | --- |
| 低频查询状态 | 普通 HTTP |
| 服务端偶尔单向通知 | SSE |
| 高频双向消息或客户端主动上报 | WebSocket |
| 跨服务、可追溯、可重试的业务事件 | 消息队列加 WebSocket 网关 |

选择 WebSocket 后，系统会多出连接生命周期、重连、心跳、慢客户端和水平扩展等长期运维成本。因此应先确认业务是否真的需要持续双向通道。

---

## 二、Java 中的三层 WebSocket 抽象

Java 服务端常见的实时通信方式可以看作三个抽象层次：

| 方案 | 核心抽象 | 适合场景 | 主要代价 |
| --- | --- | --- | --- |
| JSR 356 | Session、消息帧、生命周期回调 | 连接模型简单、需要底层控制 | 连接、路由、鉴权均需自行维护 |
| Spring WebSocket | WebSocketSession、Handler、Interceptor | 接入 Spring 体系、需要统一容器差异 | 仍要自行设计消息路由与会话模型 |
| Spring STOMP | destination、订阅、消息代理 | 房间广播、用户消息、Controller 风格处理 | 要理解协议、订阅和 Broker 边界 |

可以简单理解为：

~~~text
JSR 356
    ↓
直接管理每一条连接

Spring WebSocket
    ↓
统一连接与处理器模型

Spring STOMP
    ↓
面向 destination 和订阅进行消息路由
~~~

抽象层次越高，样板代码越少；但鉴权、背压、可靠性和业务顺序这些底层问题并不会因此消失。

---

## 三、原生 WebSocket：JSR 356 与 Session

Java 标准 WebSocket API 通常称为 JSR 356。不同运行环境的包名有所不同：

| 运行环境 | 常见包名 |
| --- | --- |
| Tomcat 8/9、Spring Boot 2.x | **javax.websocket.\*** |
| Tomcat 10+、Spring Boot 3.x | **jakarta.websocket.\*** |

除了 Jakarta 命名空间迁移，两者的核心编程模型基本一致。

~~~java
@ServerEndpoint("/ws/chat")
public class ChatEndpoint {

    @OnOpen
    public void onOpen(Session session) {
        System.out.println("连接建立：" + session.getId());
    }

    @OnMessage
    public void onMessage(String message, Session session)
            throws IOException {
        System.out.println("收到消息：" + message);
        session.getBasicRemote()
                .sendText("服务端收到：" + message);
    }

    @OnClose
    public void onClose(Session session, CloseReason closeReason) {
        System.out.println("连接关闭：" + session.getId());
        System.out.println("关闭原因：" + closeReason);
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        throwable.printStackTrace();
    }
}
~~~

生命周期回调的职责如下：

| 注解 | 触发时机 | 常见用途 |
| --- | --- | --- |
| **@OnOpen** | 握手成功、连接建立后 | 绑定连接、初始化状态 |
| **@OnMessage** | 收到客户端消息 | 处理业务消息、心跳 |
| **@OnClose** | 连接关闭 | 清理资源、更新在线状态 |
| **@OnError** | 传输或处理异常 | 记录异常、触发清理 |

### 1. Session 表示连接，不表示用户

一个 **Session** 对应一条物理 WebSocket 连接，而不是一个业务用户。同一用户可以同时打开多个浏览器标签页，也可以同时登录手机与桌面端。

~~~text
用户 1001
├── 浏览器标签页 A
├── 浏览器标签页 B
├── 手机客户端
└── 桌面客户端
~~~

因此，生产环境中通常不能用下面的结构表示在线用户：

~~~java
Map<Long, Session>
~~~

更常见的是：

~~~java
Map<Long, Set<Session>>
~~~

如果还要区分终端和设备，可在用户维度下继续按 **deviceId** 或 **clientType** 建索引。只有当业务明确规定“同一用户只允许一条连接”时，才应在新连接成功后主动关闭旧连接。

### 2. Session 中应该保存什么

原生 Session 中常用的能力包括：

~~~java
session.getId();                  // 当前连接 ID
session.isOpen();                 // 连接是否仍然打开
session.close();                  // 主动关闭连接

session.getRequestURI();          // 握手 URI
session.getQueryString();         // 原始查询参数
session.getRequestParameterMap(); // 查询参数 Map

session.getUserProperties();      // 连接级自定义属性
session.setMaxIdleTimeout(60_000);

session.getBasicRemote().sendText("hello");
session.getAsyncRemote().sendText("hello");
~~~

路径参数适合表达业务资源，例如 **roomId**、**orderId** 或 **conversationId**；查询参数更适合表达客户端信息，例如 **deviceId**、版本和平台。两者都不应被当作认证事实。

Session 属性只应保存连接生命周期内确实需要的轻量数据，例如已验证的用户 ID、客户端类型和关联资源 ID。把大对象、长期缓存或可从数据库重新获取的业务数据塞进 Session，会让连接回收、内存估算和多实例同步都变得困难。

WebSocket 的 Ping/Pong 控制帧与业务心跳也应分开看待。前者用于传输层存活探测；后者通常承载客户端版本、会话状态或业务活跃度。是否需要业务心跳，取决于业务是否要区分“TCP 还活着”和“客户端应用仍可正常工作”。

### 3. 客户端传入的 userId 不是身份凭证

路径和查询参数可用于传递资源定位信息，例如 **roomId**、**orderId**、**clientType** 或 **deviceId**。但客户端传入的 **userId** 只能视为普通输入，不能作为真实身份的依据。

~~~java
@ServerEndpoint("/ws/chat/{userId}/{roomId}")
public class ChatEndpoint {

    @OnOpen
    public void onOpen(
            Session session,
            @PathParam("userId") String userId,
            @PathParam("roomId") String roomId
    ) {
        // userId 只能用于展示或校验，不能直接作为认证结果。
    }
}
~~~

更可靠的做法是在握手阶段，通过 Cookie、既有认证上下文或短期连接票据识别真实用户，再将认证结果绑定到连接。浏览器原生 WebSocket API 不能像普通 HTTP 请求一样任意设置 Authorization 请求头；若不得不使用查询参数传递短期票据，应设置极短有效期，并确保网关与访问日志不会记录敏感参数。

在 **@OnOpen** 中再校验一次当然可以，但这时底层连接已经成功建立。希望尽早拒绝非法请求时，应使用容器认证、JSR 356 的 Configurator，或 Spring 的握手拦截器。

### 4. 在 Spring Boot 中使用 @ServerEndpoint

**@ServerEndpoint** 属于 Jakarta WebSocket 规范，不是 Spring MVC 注解。在嵌入式 Servlet 容器中，通常需要注册 **ServerEndpointExporter**：

~~~java
@Configuration
public class WebSocketEndpointConfig {

    @Bean
    public ServerEndpointExporter serverEndpointExporter() {
        return new ServerEndpointExporter();
    }
}
~~~

使用原生 API 的优势是直接、轻量、对连接和协议帧的控制粒度细；相应地，Session 注册、用户关联、广播、跨节点投递和并发发送都需要自行处理。

---

## 四、Spring WebSocket：统一 Handler 与握手流程

Spring WebSocket 在 Tomcat、Jetty、Undertow 等底层实现之上提供统一抽象。它用 **WebSocketSession** 表示连接，用 **WebSocketHandler** 处理生命周期。

~~~java
@Component
public class ChatWebSocketHandler extends TextWebSocketHandler {

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        System.out.println("连接建立：" + session.getId());
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession session,
            TextMessage message
    ) throws IOException {
        session.sendMessage(
                new TextMessage("服务端收到：" + message.getPayload())
        );
    }

    @Override
    public void afterConnectionClosed(
            WebSocketSession session,
            CloseStatus status
    ) {
        System.out.println("连接关闭：" + session.getId());
    }
}
~~~

端点注册和握手拦截器可放在同一配置中：

~~~java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final ChatWebSocketHandler chatWebSocketHandler;
    private final UserHandshakeInterceptor handshakeInterceptor;

    public WebSocketConfig(
            ChatWebSocketHandler chatWebSocketHandler,
            UserHandshakeInterceptor handshakeInterceptor
    ) {
        this.chatWebSocketHandler = chatWebSocketHandler;
        this.handshakeInterceptor = handshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(
            WebSocketHandlerRegistry registry
    ) {
        registry.addHandler(chatWebSocketHandler, "/ws/chat")
                .addInterceptors(handshakeInterceptor)
                .setAllowedOrigins("https://app.example.com");
    }
}
~~~

示例中的 Origin 必须替换为实际受信任的前端域名，不应为了调试在生产环境放开所有来源。

### 1. 在握手阶段绑定可信身份

握手拦截器适合解析认证上下文、校验连接票据，并将认证结果写入连接属性：

~~~java
@Component
public class UserHandshakeInterceptor implements HandshakeInterceptor {

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Map<String, Object> attributes
    ) {
        AuthenticatedUser user = authenticate(request);
        if (user == null) {
            return false;
        }

        attributes.put("userId", user.id());
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request,
            ServerHttpResponse response,
            WebSocketHandler wsHandler,
            Exception exception
    ) {
    }

    private AuthenticatedUser authenticate(ServerHttpRequest request) {
        // 复用项目已有的认证逻辑。
        return null;
    }
}
~~~

后续处理消息时，从 Session 属性或认证主体中读取用户身份，而不是重新相信客户端消息体中的用户字段。

### 2. 关闭与异常清理必须幂等

断网、浏览器崩溃、客户端显式关闭和服务端主动断开，都可能触发关闭事件。某些场景下，同一个 STOMP 会话还可能观察到重复的断开事件。因此在线状态清理应设计为幂等：重复执行不会把计数减成负数，也不会误删新连接。

一个常见做法是使用连接 ID 作为清理的唯一键：删除成功才更新在线状态；删除不到则直接返回。

---

## 五、STOMP：从管理 Session 到管理 destination

当业务中出现大量房间广播、订阅与用户级消息时，直接维护 Session 会越来越复杂。STOMP 在 WebSocket 之上定义了文本帧协议，让客户端以 **SEND** 和 **SUBSCRIBE** 命令围绕 destination 进行通信。

~~~text
STOMP Client
        ↓
WebSocket 端点 /ws
        ↓
Spring 消息处理层
        ├── /app/**      进入 @MessageMapping
        ├── /topic/**    广播订阅
        ├── /queue/**    由 Broker 定义其语义
        └── /user/**     Spring 用户级目的地
~~~

最小配置如下：

~~~java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketStompConfig
        implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOrigins("https://app.example.com");
    }

    @Override
    public void configureMessageBroker(
            MessageBrokerRegistry registry
    ) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setUserDestinationPrefix("/user");
    }
}
~~~

其中：

- 客户端发送到 **/app/\*\*** 的消息，会进入服务端的 **@MessageMapping** 方法；
- **/topic** 与 **/queue** 是常见命名约定，Simple Broker 会将匹配订阅的消息转发给客户端；
- destination 的具体语义由 Broker 定义，不能仅凭 **/queue** 前缀就假定“只有一个消费者收到消息”；
- **/user/\*\*** 由 Spring 的用户目的地机制处理，用于避免不同用户订阅同名私有队列时发生冲突。

### 1. 一个 STOMP 会话包含多个阶段

WebSocket 连接建立后，STOMP 客户端还会发送 CONNECT 帧；收到 CONNECTED 后，STOMP 会话才算建立。随后客户端才能订阅 destination 或发送应用消息。

~~~text
WebSocket Upgrade
        ↓
STOMP CONNECT
        ↓
STOMP CONNECTED
        ↓
SUBSCRIBE / SEND
~~~

因此，不能把客户端在 STOMP CONNECT 帧中填写的用户名、角色或自定义头直接当作认证结果。应优先使用 WebSocket 握手阶段已经建立的 HTTP 认证主体，并在处理 CONNECT、SUBSCRIBE 与 SEND 时继续应用授权规则。

对于仅使用 Spring Security 的常规场景，HTTP 握手的认证主体可被 WebSocket/STOMP 会话继承。若有额外的房间、租户或设备权限，仍应在订阅与消息处理处校验，而不是只在连接建立时校验一次。

### 2. @MessageMapping 中仍然要做授权

STOMP 降低了路由复杂度，但不替代业务权限校验。客户端订阅了某个房间地址，并不代表它有权看到该房间数据；客户端在消息体中填写 senderId，也不代表消息来自该用户。

~~~java
@Controller
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final RoomAccessService roomAccessService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    public void send(ChatSendRequest request, Principal principal) {
        roomAccessService.checkMember(
                principal.getName(),
                request.roomId()
        );

        ChatMessage message = chatService.save(
                request.roomId(),
                principal.getName(),
                request.content()
        );

        messagingTemplate.convertAndSend(
                "/topic/room/" + message.roomId(),
                message
        );
    }
}
~~~

这里的发送者取自 **Principal**，房间成员资格由服务端校验。对于订阅权限，也应配置消息安全规则或在订阅事件中按业务规则检查，不能只依赖前端隐藏入口。

### 3. 用户点对点发送

向指定用户发送消息时，可使用：

~~~java
messagingTemplate.convertAndSendToUser(
        username,
        "/queue/messages",
        message
);
~~~

客户端订阅的通常是：

~~~text
/user/queue/messages
~~~

Spring 会根据连接关联的 **Principal**，将通用的用户地址转换为实际会话使用的内部 destination。若同一用户有多个已订阅的会话，默认都会收到该消息；这通常符合“多端同步”预期，若只想回复当前会话则要显式控制广播范围。

### 4. STOMP 的 Receipt 和 ACK 不等同于业务成功

STOMP 可以协商 receipt 或确认语义，具体支持范围取决于客户端、Spring 配置和所使用的 Broker。但无论哪一种，都要区分三个层次：

| 信号 | 它通常表示什么 | 它不能证明什么 |
| --- | --- | --- |
| WebSocket 发送回调 | 服务端当前发送流程结束 | 前端已处理业务消息 |
| STOMP receipt | Broker 或对端已确认处理某个协议帧 | 用户已经看到内容 |
| 业务 ACK | 客户端明确上报已处理某个 eventId | 业务数据本身一定正确 |

关键业务若需要“至少一次投递”或“最终可恢复”，应由业务协议设计 eventId、去重、重放和超时补偿，而不是只依赖传输层的一个成功回调。

---

## 六、Tomcat 中连续异步发送为什么可能失败

一个常见误区是：

> 调用了异步发送，容器就会自动把同一 Session 的所有消息排队并保证顺序。

例如：

~~~java
session.getAsyncRemote().sendText("A");
session.getAsyncRemote().sendText("B");
session.getAsyncRemote().sendText("C");
~~~

在部分 Tomcat 版本和具体时序下，这段代码可能抛出包含 **TEXT_FULL_WRITING** 的 IllegalStateException。

原因在于：异步发送表示调用线程不必等待底层网络写入完成；它不表示同一连接可以同时开始多个完整文本消息的写入。第一条消息尚在发送时，第二条消息又尝试进入写状态，就可能触发容器状态检查失败。

~~~text
发送 A
        ↓
Session 进入文本写入状态
        ↓
A 尚未完成
        ↓
立即发送 B
        ↓
状态检查失败或产生并发写入风险
~~~

因此需要记住：

> 异步描述的是调用与完成通知方式，不是同一连接的并发发送模型。

### 1. Spring 的 ConcurrentWebSocketSessionDecorator

对 Spring 的 **WebSocketSession**，可以使用 **ConcurrentWebSocketSessionDecorator**。它确保同一时间只有一个线程实际发送消息；若发送缓慢，其他线程提交的消息会进入缓冲区，并受到发送时长与缓冲大小限制。

~~~java
WebSocketSession safeSession =
        new ConcurrentWebSocketSessionDecorator(
                session,
                10_000,
                512 * 1024
        );
~~~

它适合解决“多个线程不能同时调用 sendMessage”这一传输层问题，但不自动定义业务层的先后关系。例如两个不同业务线程几乎同时产生事件时，谁先进入缓冲区不一定等同于数据库事务、领域事件或用户操作的先后顺序。严格业务有序仍需由业务层定义序列。

---

## 七、同一 Session 的顺序发送：两种方式

如果业务要求同一连接内的消息严格按提交顺序发送，需要满足：

~~~text
上一条消息的发送回调完成
        ↓
才开始下一条消息的实际写入
~~~

### 1. 固定消息集合：链式回调

若待发送的消息集合在开始时已经确定，可在上一条消息成功回调后发送下一条：

~~~java
private void sendInOrder(Session session, List<String> messages) {
    sendNext(session, messages.iterator());
}

private void sendNext(Session session, Iterator<String> iterator) {
    if (!session.isOpen() || !iterator.hasNext()) {
        return;
    }

    String message = iterator.next();
    session.getAsyncRemote().sendText(message, result -> {
        if (!result.isOK()) {
            Throwable exception = result.getException();
            if (exception != null) {
                exception.printStackTrace();
            }
            return;
        }

        sendNext(session, iterator);
    });
}
~~~

这种方式简单直观，适合单一来源、一次性确定的消息序列；它不适合多个业务线程持续向同一连接投递消息。

### 2. 多个生产者：每个 Session 一个发送队列

如果多个线程都可能向同一连接推送消息，更稳妥的方式是为每个 Session 分配一个独立发送队列：

~~~text
业务线程提交消息
        ↓
消息进入 Session 队列
        ↓
CAS 获得发送权
        ↓
发送队头消息
        ↓
发送完成回调
        ↓
继续处理下一条消息
~~~

下面是一个仅演示核心并发控制的 JSR 356 实现：

~~~java
public class OrderedSessionSender {

    private final Session session;
    private final Queue<String> queue = new ConcurrentLinkedQueue<>();
    private final AtomicBoolean sending = new AtomicBoolean(false);
    private final AtomicBoolean closed = new AtomicBoolean(false);

    public OrderedSessionSender(Session session) {
        this.session = session;
    }

    public void send(String message) {
        if (closed.get() || !session.isOpen()) {
            return;
        }

        queue.offer(message);
        tryStartSending();
    }

    private void tryStartSending() {
        if (sending.compareAndSet(false, true)) {
            sendNext();
        }
    }

    private void sendNext() {
        if (closed.get() || !session.isOpen()) {
            stop();
            return;
        }

        String message = queue.poll();
        if (message == null) {
            sending.set(false);

            // 避免发送标记切换期间有新消息入队却无人消费。
            if (!queue.isEmpty()) {
                tryStartSending();
            }
            return;
        }

        try {
            session.getAsyncRemote().sendText(message, result -> {
                if (!result.isOK()) {
                    Throwable exception = result.getException();
                    if (exception != null) {
                        exception.printStackTrace();
                    }
                    stop();
                    return;
                }

                sendNext();
            });
        } catch (RuntimeException exception) {
            exception.printStackTrace();
            stop();
        }
    }

    public void close() {
        closed.set(true);
        stop();
    }

    private void stop() {
        queue.clear();
        sending.set(false);
    }
}
~~~

连接管理器在建立、发送和关闭时维护发送器即可：

~~~java
private final Map<String, OrderedSessionSender> senders =
        new ConcurrentHashMap<>();

public void onOpen(Session session) {
    senders.put(
            session.getId(),
            new OrderedSessionSender(session)
    );
}

public void send(Session session, String message) {
    OrderedSessionSender sender = senders.get(session.getId());
    if (sender != null) {
        sender.send(message);
    }
}

public void onClose(Session session) {
    OrderedSessionSender sender = senders.remove(session.getId());
    if (sender != null) {
        sender.close();
    }
}
~~~

这里的队列保证的是“进入该发送器后的线性顺序”，而不是跨线程产生事件的全局因果顺序。若业务顺序有定义，应在入队前按领域序列号排序或由单一事件流决定投递顺序。

---

## 八、背压：慢客户端不能无限占用内存

上面的示例使用了无界的 ConcurrentLinkedQueue，只适合解释机制。真实客户端可能网络很慢、页面被挂起，甚至已经断线但尚未触发关闭回调。如果服务端持续投递消息，无界队列会不断增长，最终拖垮服务进程。

生产环境至少应明确以下策略：

- 单 Session 最大排队消息数与最大排队字节数；
- 单条消息最大发送时长；
- 最大允许投递延迟；
- 队列满时是拒绝新消息、丢弃旧消息还是合并消息；
- 连续发送失败次数与慢连接断开条件；
- 是否需要把消息降级为离线消息。

不同消息类型的策略应不同：

| 消息类型 | 常见策略 |
| --- | --- |
| 在线人数、任务进度、设备状态 | 合并或只保留最新状态 |
| 弹幕、日志、非关键通知 | 限量丢弃并记录指标 |
| 聊天、订单、资金等关键事件 | 先持久化，再用事件 ID 与补偿机制保证可追溯 |

“不丢消息”不应该通过无限增长的内存队列实现，而应通过持久化、重试、过期策略和客户端补偿协议实现。

---

## 九、发送完成、客户端收到与业务确认是三件事

WebSocket 异步发送的成功回调，只能说明服务端当前发送流程完成，不能证明：

1. 消息已经被客户端页面处理；
2. 客户端完成了业务写入；
3. 用户已经看到了消息；
4. 断线重连后仍不会重复或遗漏。

若业务需要端到端的可靠处理，应把传输层回调与业务确认分开设计。一个实用的消息体至少可包含：

~~~json
{
  "eventId": "evt-abc",
  "aggregateId": "conversation-1001",
  "sequence": 1024,
  "type": "chat.message.created",
  "payload": {
    "content": "hello"
  }
}
~~~

客户端可持久化最后已处理的 **sequence** 或已确认的 **eventId**，并在重连后告知服务端自己的游标。服务端根据游标重放缺失事件；客户端则用 eventId 去重、用 sequence 检查是否缺号或乱序。

~~~text
Session 发送队列
    解决同一连接的写入串行化

事件 sequence / eventId
    解决端到端的去重、检测乱序与补偿
~~~

对于先写数据库再推送的关键业务事件，还应避免“事务提交失败但已推送”或“事务已提交但进程在推送前崩溃”。常见做法是使用事务外盒（Transactional Outbox）：业务事务中同时写入领域数据与待发布事件，再由独立发布者可靠地投递事件。

---

## 十、心跳、重连与集群边界

### 1. 心跳不能替代重连

心跳用于更快发现失效连接，避免代理或中间网络设备回收空闲通道；它不负责恢复连接。客户端仍需要实现指数退避重连，并在重连成功后恢复订阅、重新同步状态或按 sequence 补偿事件。

Spring 的 Simple Broker 可以配置 STOMP 心跳。使用外部 STOMP Broker Relay 时，还应监控 Broker 可用性：服务端与 Broker 的系统连接可以重连，但浏览器端的 WebSocket 连接不会自动恢复，客户端仍需自行重连。

### 2. 单机有序不等于集群有序

每个 Session 一个发送队列，只能保证：

~~~text
同一个服务实例
同一个物理连接
同一个发送器
~~~

中的发送顺序。在多实例部署下，同一用户可能连接到节点 A，而业务事件在节点 B 产生；同一个房间的事件也可能来自多个服务实例。此时需要让事件流具有可路由、可排序的业务键，例如按 conversationId、orderId 或 userId 进行分区。

常见演进路径是：

~~~text
业务服务
    ↓ 领域事件 / Outbox
消息代理或事件流
    ↓ 按业务键分区
WebSocket 网关
    ↓
用户连接
~~~

Spring 的内置 Simple Broker 将订阅保存在当前应用内存中，适合单实例或开发场景。需要多实例广播、跨节点用户目的地或更复杂的 ACK、持久化和路由能力时，应评估 STOMP Broker Relay 与外部 Broker，并结合客户端重连和业务补偿方案。

---

## 十一、如何选择实现方式

| 场景 | 推荐方案 |
| --- | --- |
| 单一设备连接、协议控制要求高 | JSR 356 |
| 简单文本推送、需复用 Spring 认证和拦截器 | Spring WebSocket |
| 聊天室、房间广播、用户级消息 | Spring STOMP |
| 多实例、高吞吐、需要跨节点路由或持久化 | 外部 Broker 或事件流加 WebSocket 网关 |
| 关键业务事件、不允许仅靠内存队列保证可靠性 | 持久化事件、幂等消费、重连补偿 |

一个简单的设备长连接不应为了“架构完整”引入 STOMP 和消息中间件；同样，面向多实例的聊天或订单系统，也不应只依赖进程内 Map 与无界队列。

---

## 十二、上线前检查清单

- [ ] 使用 **wss://**，并在反向代理正确转发 Upgrade 请求。
- [ ] 在握手阶段建立可信身份，不信任路径、查询参数或消息体中的 userId。
- [ ] 对发送和订阅目的地进行授权校验。
- [ ] 用户与连接按一对多关系管理，关闭清理逻辑可重复执行。
- [ ] 同一 Session 不并发写入；有序需求使用发送器或显式序列。
- [ ] 设置发送超时、缓冲上限和慢客户端策略。
- [ ] 设计心跳、客户端重连、订阅恢复与状态补偿。
- [ ] 关键事件具备 eventId、sequence 与去重/补偿方案。
- [ ] 多实例部署时，明确跨节点路由、事件分区和 Broker 可用性策略。
- [ ] 记录连接数、发送队列长度、慢连接关闭、传输错误、重连次数等指标。

---

## 十三、结语

WebSocket 的价值不只是“保持一条长连接”，而是提供一条双方都能主动使用的实时通道。JSR 356 直接控制连接；Spring WebSocket 统一 Handler 与握手模型；STOMP 则把关注点从 Session 移到 destination、订阅和用户级路由。

但无论选择哪一层，工程上的关键问题始终相同：身份是否可信、连接是否可清理、写入是否串行、慢客户端是否可控、断线后能否恢复、集群中是否还能保持业务顺序。

尤其需要记住：

> 异步发送不等于并发安全；连接内有序不等于端到端有序；发送完成也不等于业务已被客户端确认。

只有把传输、可靠性和业务顺序分层处理，实时通信系统才能在负载升高、网络波动和多实例部署后仍保持稳定。

## 参考资料

- [Spring Framework：STOMP Overview](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/overview.html)
- [Spring Framework：User Destinations](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/user-destination.html)
- [Spring Framework：Simple Broker](https://docs.spring.io/spring-framework/reference/web/websocket/stomp/handle-simple-broker.html)
- [Spring Framework：ConcurrentWebSocketSessionDecorator](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/socket/handler/ConcurrentWebSocketSessionDecorator.html)
