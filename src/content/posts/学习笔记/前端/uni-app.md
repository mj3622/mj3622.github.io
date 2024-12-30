---
title: 从0开始学习uni-app
published: 2024-12-29
description: 在本文将记录如何从0开始，学会使用uni-app的基本用法，并最终用于完成毕业设计项目。
tags: [uni-app]
category: 学习笔记
draft: false
---

# 0. uni-app

`uni-app` 是一个使用 [Vue.js](https://vuejs.org/) 开发所有前端应用的框架，开发者编写一套代码，可发布到iOS、Android、Web（响应式）、以及各种小程序（微信/支付宝/百度/头条/飞书/QQ/快手/钉钉/淘宝）、快应用等多个平台。（摘自[uni-app官网](https://uniapp.dcloud.net.cn/)的介绍）



在上手uni-app之前，推荐下载官方提供的[HBuilderX](https://www.dcloud.io/hbuilderx.html)以便后续开发，具体的教程可以参考[uni-app 快速上手](https://uniapp.dcloud.net.cn/quickstart-hx.html)。





一个uni-app工程，默认包含如下目录及文件（源自[工程简介 | uni-app官网](https://uniapp.dcloud.net.cn/tutorial/project.html)）：

```
┌─uniCloud              云空间目录，支付宝小程序云为uniCloud-alipay，阿里云为uniCloud-aliyun，腾讯云为uniCloud-tcb
│─components            符合vue组件规范的uni-app组件目录
│  └─comp-a.vue         可复用的a组件
├─utssdk                存放uts文件（已废弃）
├─pages                 业务页面文件存放的目录
│  ├─index
│  │  └─index.vue       index页面
│  └─list
│     └─list.vue        list页面
├─static                存放应用引用的本地静态资源（如图片、视频等）的目录，注意：静态资源都应存放于此目录
├─uni_modules           存放uni_module 
├─platforms             存放各平台专用页面的目录
├─nativeplugins         App原生语言插件 
├─nativeResources       App端原生资源目录
│  ├─android            Android原生资源目录 
|  └─ios                iOS原生资源目录 
├─hybrid                App端存放本地html文件的目录
├─wxcomponents          存放微信小程序、QQ小程序组件的目录
├─mycomponents          存放支付宝小程序组件的目录
├─swancomponents        存放百度小程序组件的目录
├─ttcomponents          存放抖音小程序、飞书小程序组件的目录
├─kscomponents          存放快手小程序组件的目录
├─jdcomponents          存放京东小程序组件的目录
├─unpackage             非工程代码，一般存放运行或发行的编译结果
├─main.js               Vue初始化入口文件
├─App.vue               应用配置，用来配置App全局样式以及监听 应用生命周期
├─pages.json            配置页面路由、导航条、选项卡等页面类信息
├─manifest.json         配置应用名称、appid、logo、版本等打包信息
├─AndroidManifest.xml   Android原生应用清单文件 
├─Info.plist            iOS原生应用配置文件 
└─uni.scss              内置的常用样式变量
```



`.vue`文件的结构

```vue
<!-- 负责定义组件的 HTML 结构 和 UI 模板 -->
<template>

</template>

<!-- 定义组件的 逻辑和数据 -->
<script setup>

</script>

<!-- 定义组件的 样式 -->
<style lang="scss">
	
</style>
```



在对`uni-app`有了基本的了解之后，将开始上手学习如何编写一个`uni-app`程序



# 1. 基本组件

## 1.1 视图容器

### 1. view

`view`是最基本的视图容器，可以用于包裹各种元素内容。



**常用属性：**

| 属性名           | 类型   | 默认值 | 说明                                                         |
| :--------------- | :----- | :----- | :----------------------------------------------------------- |
| hover-class      | String | none   | 指定按下去的样式类。当 hover-class="none" 时，没有点击态效果 |
| hover-start-time | Number | 50     | 按住后多久出现点击态，单位毫秒                               |
| hover-stay-time  | Number | 400    | 手指松开后点击态保留时间，单位毫秒                           |



### 2. scroll-view

`scroll-view`为可滚动视图区域，用于区域滚动。



**常用属性：**

| 属性名         | 类型    | 默认值 | 说明               |
| :------------- | :------ | :----- | :----------------- |
| scroll-x       | Boolean | false  | 允许横向滚动       |
| scroll-y       | Boolean | false  | 允许纵向滚动       |
| show-scrollbar | Boolean | false  | 控制是否出现滚动条 |



**横向滚动：**

当我们希望做出横向滚动的效果时，如果只配置`scroll-x`会发现并不能正常生效。此时，我们还需要使用css进行额外配置，如下所示：

```vue
<template>
	<view>
		<scroll-view scroll-x>
			<view class="box" style=" background-color: #f00;">1</view>
			<view class="box" style=" background-color: #0f0;">2</view>
			<view class="box" style=" background-color: #00f;">3</view>
			<view class="box" style=" background-color: #f0f;">4</view>
			<view class="box" style=" background-color: #ff0;">5</view>
			<view class="box" style=" background-color: #f00;">6</view>
			<view class="box" style=" background-color: #0f0;">7</view>
			<view class="box" style=" background-color: #00f;">8</view>
			<view class="box" style=" background-color: #f0f;">9</view>
			<view class="box" style=" background-color: #ff0;">10</view>
		</scroll-view>
	</view>
</template>

<style>
	scroll-view {
		width: 300px;
		height: 50px;
        /* 确保内容不换行 */
		white-space: nowrap;

		.box {
            /* 使得这些元素以行内块的形式显示 */
			display: inline-block;
		}
	}
</style>
```



### 3. swiper

`swiper`是滑块视图容器，一般用于左右滑动或上下滑动，比如banner轮播图。



**常用属性：**

| 属性名                 | 类型    | 默认值            | 说明                                                  |
| :--------------------- | :------ | :---------------- | :---------------------------------------------------- |
| indicator-dots         | Boolean | false             | 是否显示面板指示点                                    |
| indicator-color        | Color   | rgba(0, 0, 0, .3) | 指示点颜色                                            |
| indicator-active-color | Color   | #000000           | 当前选中的指示点颜色                                  |
| autoplay               | Boolean | false             | 是否自动切换                                          |
| interval               | Number  | 5000              | 自动切换时间间隔                                      |
| duration               | Number  | 500               | 滑动动画时长                                          |
| circular               | Boolean | false             | 是否采用衔接滑动，即播放到末尾后重新回到开头          |
| vertical               | Boolean | false             | 滑动方向是否为纵向                                    |
| previous-margin        | String  | 0px               | 前边距，可用于露出前一项的一小部分，接受 px 和 rpx 值 |
| next-margin            | String  | 0px               | 后边距，可用于露出后一项的一小部分，接受 px 和 rpx 值 |



当在`swiper`中显示内容时，可以使用`swiper-item`来进行显示，其宽高会自动设置为100%（相对于父组件）。

```vue
<template>
	<view>
		<swiper indicator-dots="" autoplay="" interval="3000">
			<swiper-item>
				<image src="../../../static/p1.jpg" mode="aspectFit"></image>
			</swiper-item>
			<swiper-item>
				<image src="../../../static/p2.jpg" mode="aspectFit"></image>
			</swiper-item>
			<swiper-item>
				<image src="../../../static/p3.jpg" mode="aspectFit"></image>
			</swiper-item>
			<swiper-item>
				<image src="../../../static/p4.jpg" mode="aspectFit"></image>
			</swiper-item>
		</swiper>
	</view>
</template>
```



## 1.2 基础内容

### 1. text

`text`是文本组件，用于包裹文本内容。



**常用属性：**

| 属性名      | 类型    | 默认值 | 说明         | 平台差异说明           |
| :---------- | :------ | :----- | :----------- | :--------------------- |
| selectable  | Boolean | false  | 文本是否可选 |                        |
| user-select | Boolean | false  | 文本是否可选 | 微信小程序             |
| space       | String  |        | 显示连续空格 | 钉钉小程序不支持       |
| decode      | Boolean | false  | 是否解码     | 百度、钉钉小程序不支持 |

**space 值说明**

| 值   | 说明                   |
| :--- | :--------------------- |
| ensp | 中文字符空格一半大小   |
| emsp | 中文字符空格大小       |
| nbsp | 根据字体设置的空格大小 |



## 1.3 表单组件

### 1. button

`button`为按钮组件。



**常用属性：**

| 属性名           | 类型    | 默认值       | 说明                                                         |
| :--------------- | :------ | :----------- | :----------------------------------------------------------- |
| size             | String  | default      | 按钮的大小（default：默认大小；mini：小尺寸）                |
| type             | String  | default      | 按钮的样式类型                                               |
| plain            | Boolean | false        | 按钮是否镂空，背景色透明                                     |
| disabled         | Boolean | false        | 是否禁用                                                     |
| loading          | Boolean | false        | 名称前是否带 loading 图标                                    |
| hover-class      | String  | button-hover | 指定按钮按下去的样式类。当 hover-class="none" 时，没有点击态效果 |
| hover-start-time | Number  | 20           | 按住后多久出现点击态，单位毫秒                               |
| hover-stay-time  | Number  | 70           | 手指松开后点击态保留时间，单位毫秒                           |



### 2. input

`input`是单行输入框。



**常用属性：**

| 属性名      | 类型        | 默认值 | 说明                                                         |
| :---------- | :---------- | :----- | :----------------------------------------------------------- |
| value       | String      |        | 输入框的初始内容                                             |
| type        | String      | text   | input 的类型 [有效值](https://uniapp.dcloud.net.cn/component/input.html#type) |
| password    | Boolean     | false  | 是否是密码类型                                               |
| placeholder | String      |        | 输入框为空时占位符                                           |
| disabled    | Boolean     | false  | 是否禁用                                                     |
| maxlength   | Number      | 140    | 最大输入长度，设置为 -1 的时候不限制最大长度                 |
| @focus      | EventHandle |        | 输入框聚焦时触发，event.detail = { value, height }，height 为键盘高度 |
| @blur       | EventHandle |        | 输入框失去焦点时触发，event.detail = {value: value}          |
| @confirm    | EventHandle |        | 点击完成按钮时触发（电脑端敲回车），event.detail = {value: value} |



**type 有效值**

| 值            | 说明               | 平台差异说明                                                 |
| :------------ | :----------------- | :----------------------------------------------------------- |
| text          | 文本输入键盘       |                                                              |
| number        | 数字输入键盘       | 均支持，App平台、H5平台 3.1.22 以下版本 vue 页面在 iOS 平台显示的键盘包含负数和小数。 |
| idcard        | 身份证输入键盘     | 微信、支付宝、百度、QQ小程序、快手小程序、京东小程序         |
| digit         | 带小数点的数字键盘 | 均支持，App平台、H5平台 vue 页面在 iOS 平台显示的键盘包含负数（原生键盘不支持负号）。 |
| tel           | 电话输入键盘       |                                                              |
| safe-password | 密码安全输入键盘   | 微信小程序                                                   |
| nickname      | 昵称输入键盘       | 微信小程序                                                   |



### 3. switch

`switch`是开关选择器。



**常用属性：**

| 属性名   | 类型        | 默认值 | 说明                                                         |
| :------- | :---------- | :----- | :----------------------------------------------------------- |
| checked  | Boolean     | false  | 是否选中                                                     |
| disabled | Boolean     | false  | 是否禁用                                                     |
| type     | String      | switch | 样式，有效值：switch, checkbox                               |
| color    | Color       |        | switch 的颜色，同 css 的 color                               |
| @change  | EventHandle |        | checked 改变时触发 change 事件，event.detail={ value:checked} |



### 4. checkbox

`checkbox-group`为多选框组，用于包裹一组`checkbox`



**常用属性：**

| 属性名  | 类型        | 说明                                                         |
| :------ | :---------- | :----------------------------------------------------------- |
| @change | EventHandle | `<checkbox-group>`中选中项发生改变是触发 change 事件，detail = {value:[选中的checkbox的value的数组]} |



`checkbox`为多选项。在1组check-group中可选择多个



**常用属性：**

| 属性名   | 类型    | 默认值 | 说明                                                         |
| :------- | :------ | :----- | :----------------------------------------------------------- |
| value    | String  |        | `<checkbox>` 标识，选中时触发 `<checkbox-group>` 的 change 事件，并携带 `<checkbox>` 的 value。 |
| disabled | Boolean | false  | 是否禁用                                                     |
| checked  | Boolean | false  | 当前是否选中，可用来设置默认选中                             |



**使用案例：**

```vue
<template>
	<view>
		<div>Checked names: {{ checkedNames }}</div>

		<checkbox-group @change="onChange">
			<checkbox value="Jack" /><text> Jack </text>
			<checkbox value="Mike" /><text> Mike </text>
			<checkbox value="John" /><text> John </text>
		</checkbox-group>
	</view>
</template>

<script setup>
	import {ref} from "vue"
    
	const checkedNames = ref([])

	const onChange = (e) => {
		checkedNames.value = e.detail.value;
	}
</script>
```



## 1.4 路由与页面跳转

### 1. navigator

`navigator`用于页面跳转，该组件类似HTML中的`<a>`组件，但只能跳转本地页面。目标页面必须在`pages.json`中注册。

**属性说明**

| 属性名      | 类型   | 默认值          | 说明                                                         |
| :---------- | :----- | :-------------- | :----------------------------------------------------------- |
| url         | String |                 | 应用内的跳转链接，值为相对路径或绝对路径，如："../first/first"，"/pages/first/first"，注意不能加 `.vue` 后缀 |
| open-type   | String | navigate        | 跳转方式                                                     |
| delta       | Number |                 | 当 open-type 为 'navigateBack' 时有效，表示回退的层数        |
| hover-class | String | navigator-hover | 指定点击时的样式类，当hover-class="none"时，没有点击态效果   |

**open-type 有效值**

| 值           | 说明                                   | 平台差异说明                     |
| :----------- | :------------------------------------- | :------------------------------- |
| navigate     | 对应 uni.navigateTo 的功能             |                                  |
| redirect     | 对应 uni.redirectTo 的功能             |                                  |
| switchTab    | 对应 uni.switchTab 的功能              |                                  |
| reLaunch     | 对应 uni.reLaunch 的功能               | 抖音小程序与飞书小程序不支持     |
| navigateBack | 对应 uni.navigateBack 的功能           |                                  |
| exit         | 退出小程序，target="miniProgram"时生效 | 微信2.1.0+、百度2.5.2+、QQ1.4.7+ |



## 1.5 媒体组件

### 1. image

`imgae`为图片组件，用于显示图片。



**常用属性：**

| 属性名    | 类型    | 默认值        | 说明                                                         | 平台差异说明                                   |
| :-------- | :------ | :------------ | :----------------------------------------------------------- | :--------------------------------------------- |
| src       | String  |               | 图片资源地址                                                 |                                                |
| mode      | String  | 'scaleToFill' | 图片裁剪、缩放的模式                                         |                                                |
| lazy-load | Boolean | false         | 图片懒加载。只针对page与scroll-view下的image有效             | 微信小程序、百度小程序、抖音小程序、飞书小程序 |
| webp      | boolean | false         | 在系统不支持webp的情况下是否单独启用webp。默认false，只支持网络资源。webp支持详见下面说明 | 微信小程序2.9.0                                |



**mode 有效值**

mode 有 14 种模式，其中 5 种是缩放模式，9 种是裁剪模式。

| 模式 | 值           | 说明                                                         |
| :--- | :----------- | :----------------------------------------------------------- |
| 缩放 | scaleToFill  | 不保持纵横比缩放图片，使图片的宽高完全拉伸至填满 image 元素  |
| 缩放 | aspectFit    | 保持纵横比缩放图片，使图片的长边能完全显示出来。也就是说，可以完整地将图片显示出来。 |
| 缩放 | aspectFill   | 保持纵横比缩放图片，只保证图片的短边能完全显示出来。也就是说，图片通常只在水平或垂直方向是完整的，另一个方向将会发生截取。 |
| 缩放 | widthFix     | 宽度不变，高度自动变化，保持原图宽高比不变                   |
| 缩放 | heightFix    | 高度不变，宽度自动变化，保持原图宽高比不变                   |
| 裁剪 | top          | 不缩放图片，只显示图片的顶部区域                             |
| 裁剪 | bottom       | 不缩放图片，只显示图片的底部区域                             |
| 裁剪 | center       | 不缩放图片，只显示图片的中间区域                             |
| 裁剪 | left         | 不缩放图片，只显示图片的左边区域                             |
| 裁剪 | right        | 不缩放图片，只显示图片的右边区域                             |
| 裁剪 | top left     | 不缩放图片，只显示图片的左上边区域                           |
| 裁剪 | top right    | 不缩放图片，只显示图片的右上边区域                           |
| 裁剪 | bottom left  | 不缩放图片，只显示图片的左下边区域                           |
| 裁剪 | bottom right | 不缩放图片，只显示图片的右下边区域                           |



# 2. vue3 语法

此部分内容基于[Vue 官方文档整合](https://cn.vuejs.org/guide/quick-start.html)

## 2.1 模板语法

### 1. 插值表达式

最基本的数据绑定形式是插值表达式，用于在视图中动态地显示变量、表达式或计算结果。插值表达式通过双大括号 `{{}}` 的形式嵌入在模板中。

```vue
<template>
	<view>
		{{name}}
	</view>
</template>

<script setup>
const name = "张三"
</script>

<style>

</style>
```



插值表达式支持以下内容：

1. 简单变量

   ```html
   <p>{{ message }}</p>
   ```

2. 复杂表达式

   ```html
   <p>{{ number1 + number2 }}</p>
   ```

3. 三元运算符

   ```html
   <p>{{ condition ? '是' : '否' }}</p>
   ```

4. 方法调用

   ```html
   <p>{{ greet('小明') }}</p>
   ```



### 2. Attribute 绑定

双大括号不能在 HTML attributes 中使用。想要响应式地绑定一个 attribute，应该使用`v-bind` 指令。

```vue
<div v-bind:id="dynamicId"></div>
```

因为 `v-bind` 非常常用，因此官方提供了特定的简写语法：

```vue
<div :id="dynamicId"></div>
```



使用举例：

```vue
<template>
	<view>
		<image :src = "url"></image>
	</view>
</template>
<script setup>
	let url = "https://img.yzcdn.cn/vant/cat.jpeg"
</script>
```



## 2.2 响应式基础

### 1. ref

在组合式 API 中，推荐使用`ref()`函数来声明响应式状态。值通过 `.value` 访问或修改。在模板中使用时会自动拆箱，不需要使用`.value`。

示例：

```vue
<template>
	<view>
		<text>{{name}}今年 {{age}} 岁了</text>
		<text>\n{{user.name}}今年 {{user.age}} 岁了</text>
	</view>
</template>

<script setup>
	import {
		ref
	} from "vue"

	const name = "张三"
	const age = ref(18)

	let user = ref({
		name: "李四",
		age: 20
	})

	setInterval(() => {
		age.value++
		user.value.age += 10
	}, 1000)
</script>

<style>

</style>
```



## 2.3 class与style绑定

### 1. 绑定HTML class

通过绑定绑定HTML class，我们可以实现动态渲染。并且，`:class` 指令也可以和一般的 `class` attribute 共存。举例来说，下面这样的状态：

```javascript
const isActive = ref(true)
const hasError = ref(false)
```

配合以下模板：

```html
<div
  class="static"
  :class="{ active: isActive, 'text-danger': hasError }"
></div>
```

渲染的结果会是：

```html
<div class="static active"></div>
```

当 `isActive` 或者 `hasError` 改变时，class 列表会随之更新。举例来说，如果 `hasError` 变为 `true`，class 列表也会变成 `"static active text-danger"`。



### 2. 绑定内联样式

`:style` 支持绑定 JavaScript 对象值，对应的是HTML元素的 `style` 属性:

```vue
<script>
    const activeColor = ref('red')
    const fontSize = ref(30)
</script>

<div :style="{ color: activeColor, fontSize: fontSize + 'px' }"></div>
```



尽管推荐使用 camelCase，但 `:style` 也支持 kebab-cased 形式的 CSS 属性 key (对应其 CSS 中的实际名称)，例如：

```html
<div :style="{ 'font-size': fontSize + 'px' }"></div>
```



为了使代码更加简洁，可可以直接绑定一个样式对象

```vue
<script>
    const styleObject = reactive({
      color: 'red',
      fontSize: '30px'
    })
</script>

<div :style="styleObject"></div>
```



## 2.4 事件处理

我们可以使用 `v-on` 指令 (简写为 `@`) 来监听 DOM 事件，并在事件触发时执行对应的 JavaScript。用法：`v-on:click="handler"` 或 `@click="handler"`。



下面给出一个结合多个组件的事件处理案例：

```vue
<template>
	<view>
		<switch @change="isChange"/>
		<button type=" primary" :loading="isLoading" :disabled="isLoading"> 按钮 </button>
	</view>
</template>

<script setup>
	import {
		ref
	} from "vue"

	const isLoading = ref(false)

	function isChange(e) {
		isLoading.value = e.detail.value
	}
</script>
```



## 2.5 条件渲染

`v-if` 指令用于条件性地渲染一块内容。这块内容只会在指令的表达式返回真值时才被渲染。`v-else-if` 提供的是相应于 `v-if` 的`else if`区块。`v-else`则是对应的`else`区块。



使用案例：

```vue
<div v-if="type === 'A'">
  A
</div>
<div v-else-if="type === 'B'">
  B
</div>
<div v-else-if="type === 'C'">
  C
</div>
<div v-else>
  Not A/B/C
</div>
```



因为 `v-if` 是一个指令，他必须依附于某个元素。但如果我们想要切换不止一个元素呢？在这种情况下我们可以在一个 `<template>` 元素上使用 `v-if`，这只是一个不可见的包装器元素，最后渲染的结果并不会包含这个 `<template>` 元素。

```vue
<template v-if="ok">
  <h1>Title</h1>
  <p>Paragraph 1</p>
  <p>Paragraph 2</p>
</template>
```



另一个可以用来按条件显示一个元素的指令是 `v-show`。其用法基本一样：

```vue
<h1 v-show="ok">Hello!</h1>
```

不同之处在于 `v-show` 会在 DOM 渲染中保留该元素；`v-show` 仅切换了该元素上名为 `display` 的 CSS 属性。并且`v-show` 不支持在 `<template>` 元素上使用，也不能和 `v-else` 搭配使用。

​	

## 2.6 列表渲染

我们可以使用 `v-for` 指令基于一个数组来渲染一个列表。`v-for` 指令的值需要使用 `item in items` 形式的特殊语法，其中 `items` 是源数据的数组，而 `item` 是迭代项的别名， `index`是对应元素的下标：

```vue
<template>
	<view class="">
		<text v-for="(item, index) in peoples" :key="item.id">
			{{ item.id }}: {{ item.name }} 今年 {{ item.age }} \n
		</text>
	</view>
</template>

<script setup>
	import {
		ref
	} from "vue";

	const peoples = ref([{
			id: 1,
			name: "张三",
			age: 18
		},
		{
			id: 2,
			name: "李四",
			age: 20
		},
		{
			id: 3,
			name: "王五",
			age: 22
		}
	])
</script>

<style lang="scss" scoped>

</style>
```

> [!NOTE]
>
> key最好使用数组中元素的唯一值而不要直接使用index索引，以免出现问题



## 2.7 表单输入绑定

在前端处理表单时，我们常常需要将表单输入框的内容同步给 JavaScript 中相应的变量。

```vue
<input
  :value="text"
  @input="event => text = event.target.value">
```

`v-model` 指令提供了一种简化的绑定方式：

```vue
<input v-model="text">
```



我们也可以将多个复选框绑定到同一个数组或集合：

```vue
<template>
    <div>Checked names: {{ checkedNames }}</div>

    <input type="checkbox" id="jack" value="Jack" v-model="checkedNames" />
    <label for="jack">Jack</label>

    <input type="checkbox" id="john" value="John" v-model="checkedNames" />
    <label for="john">John</label>

    <input type="checkbox" id="mike" value="Mike" v-model="checkedNames" />
    <label for="mike">Mike</label>
</template>

<script>
    const checkedNames = ref([])
</script>
```



## 2.8 计算属性

如果在模板中写太多逻辑，会让模板变得臃肿，难以维护。例如下面这个例子：

```vue
<template>
    <p>Has published books:</p>
    <span>{{ author.books.length > 0 ? 'Yes' : 'No' }}</span>
</template>

<script>
    const author = reactive({
      name: 'John Doe',
      books: [
        'Vue 2 - Advanced Guide',
        'Vue 3 - Basic Guide',
        'Vue 4 - The Mystery'
      ]
    })
</script>
```



因此官方推荐使用计算属性来描述依赖响应式状态的复杂逻辑。这是重构后的示例：

```vue
<script setup>
import { reactive, computed } from 'vue'

const author = reactive({
  name: 'John Doe',
  books: [
    'Vue 2 - Advanced Guide',
    'Vue 3 - Basic Guide',
    'Vue 4 - The Mystery'
  ]
})

// 一个计算属性 ref
const publishedBooksMessage = computed(() => {
  return author.books.length > 0 ? 'Yes' : 'No'
})
</script>

<template>
  <p>Has published books:</p>
  <span>{{ publishedBooksMessage }}</span>
</template>
```



并且由于计算属性值会基于其响应式依赖被缓存，一个计算属性仅会在其响应式依赖更新时才重新计算。这意味着只要 `author.books` 不改变，无论多少次访问 `publishedBooksMessage` 都会立即返回先前的计算结果，而不用重复执行 getter 函数。



## 2.9 监听器

在组合式 API 中，我们可以使用`watch`函数在每次响应式状态发生变化时触发回调函数。`watch` 的第一个参数可以是不同形式的“数据源”：它可以是一个 `ref` (包括计算属性)、一个响应式对象、一个 getter 函数、或多个数据源组成的数组。

```javascript
const x = ref(0)
const y = ref(0)

// 单个 ref
watch(x, (newX) => {
  console.log(`x is ${newX}`)
})

// getter 函数
watch(
  () => x.value + y.value,
  (sum) => {
    console.log(`sum of x + y is: ${sum}`)
  }
)

// 多个来源组成的数组
watch([x, () => y.value], ([newX, newY]) => {
  console.log(`x is ${newX} and y is ${newY}`)
})
```



**深层监听器**

直接给 `watch()` 传入一个响应式对象，会隐式地创建一个深层侦听器——该回调函数在所有嵌套的变更时都会被触发：

```javascript
const obj = reactive({ count: 0 })

watch(obj, (newValue, oldValue) => {
  // 在嵌套的属性变更时触发
  // 注意：`newValue` 此处和 `oldValue` 是相等的
  // 因为它们是同一个对象！
})

obj.count++
```



或者通过显式指定的方式，将其强制转成深层侦听器：

```javascript
watch(
  () => state.someObject,
  (newValue, oldValue) => {
    // 注意：`newValue` 此处和 `oldValue` 是相等的
    // *除非* state.someObject 被整个替换了
  },
  { deep: true }
)
```

