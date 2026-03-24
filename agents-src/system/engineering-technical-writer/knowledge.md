### 你的技术交付物

### 高质量自述文件模板
```markdown
# Project Name

> One-sentence description of what this does and why it matters.

[![npm version](https://badge.fury.io/js/your-package.svg)](https://badge.fury.io/js/your-package)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

### Why This Exists

<!-- 2-3 sentences: the problem this solves. Not features — the pain. -->

### Quick Start

<!-- Shortest possible path to working. No theory. -->

```bash
npm 安装你的包
```

```javascript
从“你的包”导入{doTheThing}；

const 结果 = 等待 doTheThing({ 输入: '你好' });
控制台.log(结果); //“你好世界”
```

### Installation

<!-- Full install instructions including prerequisites -->

**Prerequisites**: Node.js 18+, npm 9+

```bash
npm 安装你的包
# or
纱线添加你的包
```

### Usage

### Basic Example

<!-- Most common use case, fully working -->

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timeout` | `number` | `5000` | Request timeout in milliseconds |
| `retries` | `number` | `3` | Number of retry attempts on failure |

### Advanced Usage

<!-- Second most common use case -->

### API Reference

See [full API reference →](https://docs.yourproject.com/api)

### Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

### License

MIT © [Your Name](https://github.com/yourname)
```

### OpenAPI 文档示例
```yaml
# openapi.yml - documentation-first API design
openapi: 3.1.0
info:
  title: Orders API
  version: 2.0.0
  description: |
    The Orders API allows you to create, retrieve, update, and cancel orders.

    ## Authentication
    All requests require a Bearer token in the `Authorization` header.
    Get your API key from [the dashboard](https://app.example.com/settings/api).

    ## Rate Limiting
    Requests are limited to 100/minute per API key. Rate limit headers are
    included in every response. See [Rate Limiting guide](https://docs.example.com/rate-limits).

    ## Versioning
    This is v2 of the API. See the [migration guide](https://docs.example.com/v1-to-v2)
    if upgrading from v1.

paths:
  /orders:
    post:
      summary: Create an order
      description: |
        Creates a new order. The order is placed in `pending` status until
        payment is confirmed. Subscribe to the `order.confirmed` webhook to
        be notified when the order is ready to fulfill.
      operationId: createOrder
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateOrderRequest'
            examples:
              standard_order:
                summary: Standard product order
                value:
                  customer_id: "cust_abc123"
                  items:
                    - product_id: "prod_xyz"
                      quantity: 2
                  shipping_address:
                    line1: "123 Main St"
                    city: "Seattle"
                    state: "WA"
                    postal_code: "98101"
                    country: "US"
      responses:
        '201':
          description: Order created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Order'
        '400':
          description: Invalid request — see `error.code` for details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
              examples:
                missing_items:
                  value:
                    error:
                      code: "VALIDATION_ERROR"
                      message: "items is required and must contain at least one item"
                      field: "items"
        '429':
          description: Rate limit exceeded
          headers:
            Retry-After:
              description: Seconds until rate limit resets
              schema:
                type: integer
```

### 教程结构模板
```markdown
# Tutorial: [What They'll Build] in [Time Estimate]

**What you'll build**: A brief description of the end result with a screenshot or demo link.

**What you'll learn**:
- Concept A
- Concept B
- Concept C

**Prerequisites**:
- [ ] [Tool X](link) installed (version Y+)
- [ ] Basic knowledge of [concept]
- [ ] An account at [service] ([sign up free](link))

---

### Step 1: Set Up Your Project

<!-- Tell them WHAT they're doing and WHY before the HOW -->
First, create a new project directory and initialize it. We'll use a separate directory
to keep things clean and easy to remove later.

```bash
mkdir 我的项目 && cd 我的项目
npm 初始化 -y
```

You should see output like:
```
写入 /path/to/my-project/package.json: { ... }
```

> **Tip**: If you see `EACCES` errors, [fix npm permissions](https://link) or use `npx`.

### Step 2: Install Dependencies

<!-- Keep steps atomic — one concern per step -->

### Step N: What You Built

<!-- Celebrate! Summarize what they accomplished. -->

You built a [description]. Here's what you learned:
- **Concept A**: How it works and when to use it
- **Concept B**: The key insight

### Next Steps

- [Advanced tutorial: Add authentication](link)
- [Reference: Full API docs](link)
- [Example: Production-ready version](link)
```

### Docusaurus 配置
```javascript
// docusaurus.config.js
const config = {
  title: 'Project Docs',
  tagline: 'Everything you need to build with Project',
  url: 'https://docs.yourproject.com',
  baseUrl: '/',
  trailingSlash: false,

  presets: [['classic', {
    docs: {
      sidebarPath: require.resolve('./sidebars.js'),
      editUrl: 'https://github.com/org/repo/edit/main/docs/',
      showLastUpdateAuthor: true,
      showLastUpdateTime: true,
      versions: {
        current: { label: 'Next (unreleased)', path: 'next' },
      },
    },
    blog: false,
    theme: { customCss: require.resolve('./src/css/custom.css') },
  }]],

  plugins: [
    ['@docusaurus/plugin-content-docs', {
      id: 'api',
      path: 'api',
      routeBasePath: 'api',
      sidebarPath: require.resolve('./sidebarsApi.js'),
    }],
    [require.resolve('@cmfcmf/docusaurus-search-local'), {
      indexDocs: true,
      language: 'en',
    }],
  ],

  themeConfig: {
    navbar: {
      items: [
        { type: 'doc', docId: 'intro', label: 'Guides' },
        { to: '/api', label: 'API Reference' },
        { type: 'docsVersionDropdown' },
        { href: 'https://github.com/org/repo', label: 'GitHub', position: 'right' },
      ],
    },
    algolia: {
      appId: 'YOUR_APP_ID',
      apiKey: 'YOUR_SEARCH_API_KEY',
      indexName: 'your_docs',
    },
  },
};
```

### 学习与记忆

您从中学习：
- 由于文档空白或含糊不清而导致的支持票
- 开发者反馈和 GitHub 问题标题以“Why does...”开头
- 文档分析：退出率高的页面是读者失败的页面
- 对不同的 README 结构进行 A/B 测试，看看哪种结构可以提高采用率

### 高级能力

### 文档架构
- **Divio System**：单独的教程（面向学习）、操作指南（面向任务）、参考（面向信息）和解释（面向理解）——切勿混合使用
- **信息架构**：卡片分类、树测试、复杂文档站点的渐进式披露
- **Docs Linting**：Vale、markdownlint 和用于 CI 中内部风格实施的自定义规则集

### 卓越 API 文档
- 使用 Redoc 或 Stoplight 从 OpenAPI/AsyncAPI 规范自动生成参考
- 编写叙述性指南，解释何时以及为何使用每个端点，而不仅仅是它们的用途
- 在每个 API 参考中包括速率限制、分页、错误处理和身份验证

### 内容运营
- 使用内容审核电子表格管理文档债务：URL、上次审核、准确性得分、流量
- 实现与软件语义版本控制一致的文档版本控制
- 构建文档贡献指南，使工程师可以轻松编写和维护文档

---

**说明参考**：您的技术写作方法就在这里 - 应用这些模式，在 README 文件、API 参考、教程和概念指南中提供一致、准确且深受开发人员喜爱的文档。
