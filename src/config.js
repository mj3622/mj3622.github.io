export default {
  // page1部分
  page1: {
    titleEn: 'Hello,I`m Minjer', //英文标题
    title: '永远在路上', //中文标题
  },
  // page2部分
  page2: {
    authorImg: 'page1.jpg', // 作者头像
    xinhui: '后端工程师一枚，电子信息专业大三在读。', // 幸会
    qiuzhi: '后端开发', // 求职意向
    guanyuwo: '掌握Java进行web应用开发，能够使用MySQL、Redis等主流数据库，  有一定的项目实战经验。希望可以和大家一起学习，共同进步！' // 关于我
  },
  // page3部分
  page3: [{
    icon: 'icon-diannao', // 图标
    title: '开发语言', // 标题
    msg: ['Java', 'Python',] //介绍
  }, {
    icon: 'icon-qianbi1',
    title: '数据库',
    msg: ['MySQL', 'Redis', 'SQLite', 'MongoDB']
  }, {
    icon: 'icon-shouji',
    title: '框架/中间件',
    msg: ['SpringBoot','SpringCloud', 'Mybatis', 'RabbitMQ', ]
  }, {
    icon: 'icon-tubiao-',
    title: '其余技能',
    msg: ['git', 'markdown', 'docker', 'Linux']
  },],
  // page4部分
  page4: {
    // 我的历程
    course: [{
      date: '2021/9——至今', // 时间
      desc: { // 经历
        title: '华中科技大学',
        list: ['Spring框架学习', 'Emoprobe后端开发', '深入学习数据库']
      }
    },],
    // 我的拓展技能掌握
    singlelist: [{
      title: 'vue',
      text: '了解'
    }, {
      title: 'Java',
      text: '掌握'
    },{
      title: 'Python',
      text: '了解'
    }, {
      title: 'SpringBoot',
      text: '掌握'
    }],
    // 我的基本技能掌握
    proresslist: [{
      title: 'Java',
      value: '90%'
    }, {
      title: 'SpringBoot',
      value: '80%'
    }, {
      title: 'MySQL',
      value: '80%'
    }, {
      title: 'Redis',
      value: '60%'
    },{
      title: 'RabbitMQ',
      value: '60%'
    },{
      title: 'Mybatis',
      value: '70%'
    }]
  },
  // page5部分
  page5: [{
    title: 'Emoprobe情感分析系统',
    content: '进行后端开发，使用SpringBoot框架，MySQL数据库，Redis缓存，进行情感分析',
    image: 'poj1.png',
    href: 'https://github.com/pxxxl/Emoprobe'
  }, {
    title: '局域网聊天室',
    content: '有GUI界面的局域网聊天室，支持群聊，私聊，匿名聊天',
    image: 'poj2.png',
    href: 'https://github.com/mj3622/MomoTalk'
  }, {
    title: 'AutoArchive',
    content: '实现游戏《Blue Archive》的自动化操作，包括自动刷图，自动购买道具，自动领取奖励等',
    image: 'poj3.png',
    href: 'https://github.com/mj3622/AutoArchive'
  },{
    title: 'Mist-Forum论坛项目',
    content: '基于Spring Cloud的分布式论坛项目，含有用户端和管理端，实现了用户注册、登录、发帖、评论、点赞等功能',
    image: 'poj4.png',
    href: 'https://github.com/mj3622/mist-forum'
  },{
    title: '校园外卖系统',
    content: '基于SpringBoot的校园外卖系统，有微信小程序的用户端和商家管理的Web端，实现了用户注册、登录、下单、支付等功能',
    image: 'poj5.png',
    href: 'https://github.com/mj3622/Sky-Takeout'
  },{
    title: 'DigitalClock',
    content: '基于Nexys4 DDR开发板的Verilog实现的数字钟项目，数字钟可以实现计时、闹钟等功能',
    image: 'poj6.png',
    href: 'https://github.com/mj3622/DIgitalClock_Design'
  }],
  // page6部分
  page6: {
    github: 'https://github.com/mj3622',
    email: 'Mailto:minjer@foxmail.com?Subject=邮箱标题&Body=邮箱内容！',

  }
}
