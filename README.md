# PKU-Annual-Eat

> **推荐使用[此网址](https://eat-at-pku.aiyu.fun/)或[此网址](https://eat.huh.moe/)。其分类和可视化做的不知道比我高到哪里去了。**
> 
> **仓库指路：[zhuohaoyu/PKU-Annual-Eat](https://github.com/zhuohaoyu/PKU-Annual-Eat)**

一年过去了，你在白鲸食堂里花的钱都花在哪儿了？

## 项目简介

> 项目的 idea 来源于 [Rose-max111](https://github.com/Rose-max111)。

本项目是一个用于统计白鲸大学学生校园卡消费情况的脚本。通过模拟登录大学校园卡网站，获取学生的校园卡消费记录，并通过数据可视化的方式展示。

本项目fork自[THU-Annual-Eat](https://github.com/leverimmy/THU-Annual-Eat)，感谢原作者的贡献。

![demo](./demo.png)

## 使用方法

### 0. 获取account和hallticket

首先，登录校园卡账号后，在[白鲸大学校园卡网站](https://card.pku.edu.cn/user/user)获取你的`account`和`hallticket`。方法如下：

![card](./card.png)

点击`账号管理`，在弹出的页面中找到`账号`，复制其值。

![account](./account.png)

`F12` 打开开发者工具，切换到`Network`标签页，然后`Ctrl+R`刷新页面，找到 `GetCardInfoByAccountNoParm` 这个请求，进入`Cookies`选项卡，复制其中`hallticket`字段的**value**，后面会用到。

![hallticket](./hallticket.png)

### 1. 安装依赖

本项目依赖于 `requests`、`matplotlib`，请确保你的 Python 环境中已经安装了这些库。

```bash
pip install requests matplotlib
```

### 2. 运行脚本

```bash
python main.py
```

首次运行时，请输入你的`account`和`hallticket`，会自动保存在 `config.json` 文件中。

### 3.（可选）修改配置

如果你想修改`account`或者`hallticket`，可以直接修改 `config.json` 文件。

```json
{
    "account": "你的account",
    "hallticket": "你的hallticket"
}
```

## LICENSE

除非另有说明，本仓库的内容采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 许可协议。在遵守许可协议的前提下，您可以自由地分享、修改本文档的内容，但不得用于商业目的。

如果您认为文档的部分内容侵犯了您的合法权益，请联系项目维护者，我们会尽快删除相关内容。
