# 燕园今天的饭

一个面向北大学生的校园卡消费统计网页。输入校园卡账号、`hallticket` 和日期范围后，可查看消费总览、时间趋势、商户排行与占比、时段热力图及逐笔明细。

凭证只用于当前查询，不写入文件、浏览器存储或日志。页面提供独立的账号与 `hallticket` 获取指南，查询时可随时打开查看。

## 主要功能

- 按日、周、月查看消费金额与次数趋势
- 按金额、次数、客单价切换商户排行
- 通过饼图查看商户消费占比
- 24 小时消费轨道与“星期 × 小时”热力图
- 商户、日期、关键词、时段联动筛选
- 明细排序、分页，以及 CSV、JSON 数据导出
- 独立的账号与 `hallticket` 获取指南
- 桌面端和移动端响应式界面
- 校园卡接口分页、超时、登录失效与异常响应处理

## 技术结构

```text
backend/
  app/                         FastAPI、校园卡客户端与交易标准化
  tests/                       后端测试与接口响应样本
frontend/
  public/guides/               页面使用的账号与 Hallticket 指南图片
  src/app/                     应用入口组件与全局样式
  src/components/              通用界面组件
  src/features/transactions/   交易类型、接口、本地导入、统计及测试
docs/images/legacy/            旧版说明文档使用的历史截图
legacy/                        保留的旧版命令行实现与本地输出
```

后端保持原有数据提取协议：向 `https://card.pku.edu.cn/Report/GetPersonTrjn` 提交 `sdate`、`edate`、`account`、`page`、`rows` 表单，并通过 `hallticket` Cookie 认证。

`legacy/` 仅用于保留原命令行实现。需要运行时使用 `python legacy/main.py`；其凭证写入 `legacy/config.json`，图表写入 `legacy/output/`，二者均不会提交到版本库。

## 本地运行

环境要求：Python 3.9+、Node.js 20+。

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[test]"

cd frontend
npm install
npm run build
cd ..

uvicorn backend.app.main:app --reload
```

打开 <http://127.0.0.1:8000>。构建后的前端由 FastAPI 同一端口托管。

前端开发模式会把 `/api` 代理到 `127.0.0.1:8000`：

```bash
# 终端 1
uvicorn backend.app.main:app --reload

# 终端 2
cd frontend
npm run dev
```

然后打开 <http://127.0.0.1:5173>。

### 纯前端运行

仅启动 Vite 前端即可使用本地统计，不需要启动 FastAPI：

```bash
cd frontend
npm run dev
```

打开 <http://127.0.0.1:5173>，点击“导入本地 JSON”。支持两种数据格式：

- 本页面导出的 JSON（包含 `meta` 和 `transactions`）
- 校园卡接口保存的原始响应 JSON（包含 `rows`）

原始校园卡响应会在浏览器中完成支出筛选、商户排除、金额转分和时间整理。在线输入账号与 Hallticket 查询仍需要 FastAPI；浏览器安全策略不允许 localhost 页面直接读取校园卡跨域响应或设置其 Cookie。

## 测试

```bash
python -m pytest
cd frontend && npm test && npm run build
```

## 获取账号和 Hallticket

登录[北大校园卡服务大厅](https://card.pku.edu.cn/user/user)，在“账户管理”中复制账号。随后打开浏览器开发者工具的 Network，刷新页面并选择 `GetCardInfoByAccountNoParm` 请求，在 Cookies 中复制 `hallticket` 的值。网页中的独立获取指南提供了完整步骤和截图，可从顶部导航直接打开。

## Docker

```bash
docker build -t yanyuan-meals .
docker run --rm -p 8000:8000 yanyuan-meals
```

## 许可

项目采用 [CC BY-NC-SA 4.0](./LICENSE)，仅允许非商业使用；公开衍生版本需要保留署名并以相同方式共享。
