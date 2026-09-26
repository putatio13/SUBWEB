# SUBWEB

一个面向 ACL4SSR / Subconverter 生态的现代化在线订阅转换前端。

[![Use EdgeOne Pages to deploy](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fcmliu%2FSUBWEB&install-command=npm%20install&build-command=npm%20run%20build&output-directory=dist)

## 项目简介

`SUBWEB` 的核心职责很简单：在浏览器里收集订阅链接、目标客户端、规则配置和附加参数，然后拼装出最终可用的订阅转换链接。

它本身不是订阅转换后端，也不会在前端直接完成节点解析或规则转换。真正执行转换的是你选择的后端服务，例如兼容 `subconverter` 参数格式的服务端。

这也意味着：

- 项目主体是静态站点，适合部署到 Cloudflare Pages、EdgeOne Pages、Netlify、Vercel 等静态托管平台。
- 即使不启用任何 Serverless API，页面的主功能也可以正常工作。
- 后端是否可用、规则文件是否可访问、转换速度是否稳定，取决于你选用的转换服务。

## 功能特性

- 响应式界面，适配桌面端与移动端。
- 支持亮色、暗色、跟随系统三种主题。
- 支持单条或多条原始订阅链接输入。
- 支持常见目标客户端格式：
  `Clash`、`ClashR`、`Sing-Box`、`Surge`、`Quantumult`、`Quantumult X`、`Surfboard`、`V2Ray`、`SS`、`SSR`、`SSD`、`Loon` 等。
- 内置多组远程规则配置，包含 ACL4SSR、CM 规则和通用规则。
- 支持自定义远程配置 URL。
- 支持常用筛选参数：
  `include`、`exclude`、`filename`、`emoji`、`append_type`、`append_info`、`scv`、`udp`、`list`、`sort`、`fdn`、`insert`。
- 自动探测预置后端可用性和响应时间，并优先选择可用后端。
- 支持手动填写自定义后端地址，并自动补全常见 `/sub?` 形式。
- 生成结果后可直接复制。
- 支持二维码展示。
- 支持 `clash://install-config` 导入。

## 项目结构

```text
.
├─ public/
│  ├─ index.html          # 页面骨架
│  ├─ favicon.ico
│  └─ qrcode.min.js
├─ src/
│  ├─ index.js            # 主逻辑，表单处理、URL 生成、后端探测、二维码等
│  ├─ config.js           # 目标客户端、后端列表、规则配置
│  └─ assets/css/
│     ├─ main.css         # 主要样式
│     └─ index.less
├─ functions/
│  ├─ api/
│  │  ├─ create.js
│  │  └─ [id].js
│  └─ s/
│     └─ [id].js
├─ lib/short-links.mjs    # 短链校验、存储、限流与跳转
├─ migrations/           # D1 表结构迁移
├─ tests/                # API 与前端链接状态回归测试
├─ webpack.config.js
├─ wrangler.toml
└─ package.json
```

## 技术栈

- JavaScript
- Webpack 5
- Babel
- Tailwind CSS
- jQuery
- Cloudflare Pages Functions + D1（可选订阅短链服务）

## 快速开始

### 环境要求

- Node.js 24（推荐，回归测试使用内置 SQLite）
- npm 9 或更高版本

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run serve
```

### 生产构建

```bash
npm run build
```

构建完成后，静态文件会输出到 `dist/` 目录。

## 工作原理

页面会把你输入的参数组装成类似下面这样的链接：

```text
https://your-backend.example/sub?url=...&target=clash&config=...&emoji=true...
```

因此请注意两点：

- 这个仓库只负责生成链接，不负责替代后端转换服务。
- 如果你部署的是公开页面，建议优先使用你自己维护的转换后端，而不是完全依赖公共后端。

## 自定义与二次开发

### 1. 修改目标客户端、默认后端、规则配置

编辑 [`src/config.js`](./src/config.js)。

这里维护了：

- `targetConfig`：目标客户端列表
- `backendConfig`：后端列表
- `externalConfig`：规则配置列表

### 2. 修改链接生成逻辑

编辑 [`src/index.js`](./src/index.js) 中的 `generateSubUrl`。

如果你需要：

- 增加新的查询参数
- 调整默认参数
- 改造复制、二维码、导入逻辑

都应该从这里入手。

### 3. 修改页面结构

编辑 [`public/index.html`](./public/index.html)。

### 4. 修改样式

编辑 [`src/assets/css/main.css`](./src/assets/css/main.css)。

## Cloudflare Pages 部署

Cloudflare Pages 是这个仓库最自然的部署目标，因为仓库里已经使用了 Cloudflare Pages 的 `functions/` 目录约定。

### 方案一：Git 集成部署

这是最推荐的方式。

1. 将仓库推送到 GitHub 或 GitLab。
2. 登录 Cloudflare Dashboard，进入 Workers & Pages。
3. 选择 `Create application > Pages > Connect to Git`。
4. 选择仓库并授权。
5. 在构建配置里填写：
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: 留空，使用仓库根目录
6. 建议在环境变量中补充：
   - `NODE_VERSION=24`
7. 点击 `Save and Deploy`。

这个方案的优点：

- 推送代码后自动触发构建和部署。
- 支持生产环境和预览环境。
- 仓库根目录下的 `functions/` 可以随项目一起部署。

### 方案二：Wrangler 直接上传

适合本地手动部署，或者接入你自己的 CI/CD。

```bash
npm install
npm run build
npx wrangler pages project create
npx wrangler pages deploy dist
```

如果你只是上传纯静态资源，也可以使用 Cloudflare Dashboard 的拖拽上传；但如果你希望同时部署 `functions/` 目录，就不要用拖拽上传，应该使用 Wrangler。

### 自定义域名

部署完成后可在项目后台添加自定义域名：

1. 进入 Workers & Pages。
2. 选择对应项目。
3. 打开 `Custom domains`。
4. 点击 `Set up a domain`。
5. 按控制台提示完成域名接入。

如果是 apex 根域，通常需要把域名托管到 Cloudflare；如果是子域名，则按提示添加 CNAME 即可。

### 启用订阅短链

生成完整转换链接后，点击结果区的“生成短链”。转换网页位于 `subconv.620895.xyz`；该站和生产 Pages 域名 `subweb-3lq.pages.dev` 生成的短链使用 `https://aot.im/s/…`。预览部署继续使用各自的预览域名和数据库。创建成功后，复制、普通二维码、Clash 导入和 Clash 二维码会一起使用短链。取消“使用短链”即可切回完整链接；修改订阅参数会清除上一次结果。

`aot.im` 不绑定订阅转换 Pages。独立的 `aot-shortlinks` Worker 只接管 `/s/*`；`aot-site` Worker 作为根域站点入口，当前仅提供 `/zoho-domain-verification.html`（内容为 `30563962`），根路径和其他路径返回空白 404。将来可在站点入口增加个人主页，短链路由不受影响。旧的 `subconv.aot.im` 保持不解析。Pages 的 `functions/_middleware.js` 仍作为误绑域名时的保护，`public/_routes.json` 必须覆盖所有路径，包括静态资源。

创建接口由 Pages Functions 提供；独立 Worker 使用同一个生产 D1 数据库解析 `aot.im/s/:id`：
- `POST /api/create`：JSON 请求 `{ "url": "完整转换链接" }`，返回 `slug`、`link` 和 `expiresAt`。正式站点的 `link` 为 `https://aot.im/s/…`；预览站点的 `link` 保持预览域名。
- `GET /s/:id`、`HEAD /s/:id`：返回 302 跳转。原型的 `/api/:id` 路由继续兼容。
- 链接默认长期有效；API 可选传入整数 `expiresInDays`（1–365）。不存在返回 404，过期或停用返回 410。
- 创建接口每个来源 IP 每分钟最多 10 次、每小时最多 100 次；限流不影响订阅读取。
- 默认仅允许 `https://conv.620895.xyz` 的转换链接。要启用其他可信后端，在 Wrangler 的 `[vars]` 和对应预览环境中设置 `SHORTLINK_ALLOWED_ORIGINS`，使用逗号分隔完整 origin。自定义后端仍可生成和使用普通长链接。
- `SHORTLINK_PUBLIC_ORIGIN` 设置正式短链域名；当前为 `https://aot.im`。`aot-shortlinks` Worker 的 `/s/*` 路由必须绑定相同的生产 D1 数据库，才能解析已有和新建的短链。
- 短码使用 96 位密码学随机数，SQL 使用参数绑定。服务不保存原始 IP、UA 或逐次访问日志。
- 短链会在数据库中保存完整订阅地址，302 跳转可还原该地址。持有短链即可读取订阅，请按订阅凭据保管。

#### 数据库和绑定

本项目通过 `wrangler.toml` 管理生产和预览数据库绑定，名称均为 `DB`。部署到自己的 Cloudflare 账号时，请创建自己的数据库并替换配置中的数据库 ID；生产和预览使用不同数据库。

```bash
npx wrangler d1 create subweb-shortlinks
npx wrangler d1 create subweb-shortlinks-preview
```

首次部署前执行数据库迁移：

```bash
npx wrangler d1 migrations apply subweb-shortlinks --remote
npx wrangler d1 migrations apply subweb-shortlinks-preview --env preview --remote
```

迁移兼容空数据库和原型的旧 `links` 表，保留已有链接和日志，并添加有效期字段及限流表。请通过迁移命令执行一次，不要重复手动执行 `ALTER TABLE`。停用某条链接时，将 `links.status` 改为 `0`。

没有配置 D1 时，长链接功能正常，创建短链会提示服务未就绪。

#### 本地验证和部署

使用 Node.js 24（测试使用内置 SQLite）：

```bash
npm ci
npm test
npm run build
npx wrangler d1 migrations apply subweb-shortlinks --local
npx wrangler pages dev dist
```

本地数据保存在 `.wrangler/`，不影响线上数据库。生产部署可推送到已连接的 Git 仓库，或运行 `npx wrangler pages deploy dist`。

`public/_routes.json` 会复制到构建目录，让所有路径先经过主机名隔离中间件，防止误将 `aot.im` 绑定到 Pages 时泄露静态页面。请不要给 `/s/*` 添加交互式验证码，否则订阅客户端无法自动更新。

#### 独立短链 Worker

`worker/shortlinks.mjs` 是可单独部署的解析器；`wrangler.shortlinks.toml` 绑定现有生产 D1 和 `aot.im/s/*` 路由。`worker/site.mjs` 是独立的根域站点入口；`wrangler.site.toml` 将 `aot.im` 设为其 Custom Domain。两者可分别使用 `npx wrangler deploy --config wrangler.shortlinks.toml` 和 `npx wrangler deploy --config wrangler.site.toml` 部署。Cloudflare 会为站点 Worker 的 Custom Domain 创建新的 DNS 记录；短链 Worker 路由优先于站点 Worker。

切换时先从订阅转换 Pages 的 Custom Domains 移除 `aot.im`，并删除原来指向 Pages 的根域 CNAME；随后为 `aot-site` 添加 `aot.im` Custom Domain，再为 `aot-shortlinks` 添加 `aot.im/s/*` 路由。不要删除 `subconv.620895.xyz` 的 Pages 绑定。

短链 Worker 只读取短链，不接收创建请求，也不提供网页。数据库中不存在的短码返回 404，停用或过期返回 410。`workers_dev` 与预览 URL 均已关闭。生产部署后可检查根路径是 404、Zoho 验证文件是 `30563962`、已知有效短链是 302，转换网页仍在 `subconv.620895.xyz` 正常打开。

## EdgeOne Pages 部署

这个项目的主功能全部运行在浏览器端，所以部署到 EdgeOne Pages 作为静态站点没有问题。

### 方案一：导入 Git 仓库

这是最省事的方式。

1. 将代码推送到 GitHub。
2. 登录 EdgeOne Pages 控制台。
3. 选择“导入 Git 仓库”。
4. 授权 GitHub，并选择当前仓库。
5. 在构建配置中填写：
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
   - Root directory: 仓库根目录
6. 选择合适的加速区域后开始部署。

完成后，后续推送到部署分支会自动触发重新部署。

### 方案二：EdgeOne CLI / 本地部署

适合手动部署和 CI/CD。

#### 1. 安装 CLI

```bash
npm install -g edgeone
```

#### 2. 登录

```bash
edgeone login
```

#### 3. 在仓库根目录直接部署

```bash
edgeone pages deploy -n subweb
```

预览环境示例：

```bash
edgeone pages deploy -n subweb -e preview
```

如果你已经手动构建好静态文件，也可以上传构建产物：

```bash
npm run build
edgeone pages deploy ./dist -n subweb
```

### 自定义域名

在 EdgeOne Pages 后台进入项目的“域名管理”页面即可添加自定义域名。

需要注意：

- 如果你选择的是中国大陆可用区或包含中国大陆的全球可用区，自定义域名通常需要先完成备案。
- 按控制台提示完成所有权校验与 CNAME 配置后才能生效。

### 关于 Functions 兼容性

这里要单独说明：

- 当前仓库中的 `functions/` 目录是 Cloudflare Pages 的目录约定。
- EdgeOne Pages Functions 使用的不是这套目录结构。
- 因此，把本仓库原样部署到 EdgeOne Pages 时，可以稳定使用静态前端主功能，但不要假设 `functions/` 里的 Cloudflare 代码会直接可用。

如果你想把短链接 API 也迁移到 EdgeOne Pages，建议按 EdgeOne CLI 当前初始化出来的函数目录结构重新组织，再逐个迁移接口逻辑。

## 已知限制

- 本项目不是转换后端，后端不可用时页面无法替你完成转换。
- 公共后端、公共规则文件随时可能失效、变慢或被限流。
- 短链功能需要 Pages Functions 和已迁移的 D1 数据库；其他静态托管平台需要另行接入兼容接口。
- 远程规则链接如果发生变更，页面中的预设配置也需要同步更新。

## 常见问题

### 1. 为什么我部署到静态平台后也能用？

因为页面的主流程只是生成转换链接，计算量几乎都在浏览器端完成。

### 2. 为什么生成的链接打不开？

通常不是前端页面本身的问题，而是：

- 你选择的后端服务不可用
- 订阅源失效
- 规则配置 URL 不可访问
- 目标客户端参数不兼容

### 3. 是否必须部署 `functions/`？

不必须。主功能不依赖 `functions/`。

### 4. EdgeOne 和 Cloudflare 哪个更适合这个仓库？

如果你只想最低成本上线页面，两个都可以。

- 选 Cloudflare Pages：仓库内 `functions/` 目录更贴近原生约定。
- 选 EdgeOne Pages：静态站点部署很顺手，国内外访问策略更灵活。

## 参考文档

### Cloudflare 官方文档

- Git 集成：https://developers.cloudflare.com/pages/configuration/git-integration/
- 构建配置：https://developers.cloudflare.com/pages/configuration/build-configuration/
- Direct Upload / Wrangler：https://developers.cloudflare.com/pages/get-started/direct-upload/
- Pages Functions：https://developers.cloudflare.com/pages/functions/
- Pages Functions 配置：https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- D1 绑定：https://developers.cloudflare.com/pages/functions/bindings/
- 自定义域名：https://developers.cloudflare.com/pages/configuration/custom-domains/

### EdgeOne 官方文档

- 导入 Git 仓库：https://pages.edgeone.ai/zh/document/importing-a-git-repository
- 直接上传：https://pages.edgeone.ai/zh/document/direct-upload
- EdgeOne CLI：https://pages.edgeone.ai/document/edgeone-cli
- Pages Functions 概览：https://pages.edgeone.ai/zh/document/pages-functions-overview
- Node Functions：https://pages.edgeone.ai/document/node-functions
- 自定义域名：https://pages.edgeone.ai/document/custom-domain
- Deploy Button：https://pages.edgeone.ai/document/deploy-button
