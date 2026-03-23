# Contributing

OpenCrab 当前仍在快速迭代，但欢迎 issue、文档修正和代码贡献。

## 开发前先确认

- 使用 macOS
- Node.js `20.9+`
- 本机可执行 `codex`
- 账号具备可用的执行环境使用资格

## 本地启动

```bash
npm install
cp .env.example .env.local
npm run dev
```

如果你还没登录，可以直接在 `/settings` 里完成连接。

## 提交前检查

每次提交前至少运行：

```bash
npm run lint
npm run test
npm run typecheck
npm run build
```

## 贡献边界

- 不要提交 `.env.local`、`OPENCRAB_HOME`、`channel-secrets.json` 或其他运行时产物
- 不要把本地绝对路径、私人邮箱、个人身份信息直接写进文档和 seed 数据
- 新增或修改功能时，文档必须和当前代码保持一致
- 修改 API、设置项、运行时目录或产品入口时，至少同步更新 README 与相关 docs

## 当前推荐的改动方式

- 优先做兼容式重构，不做破坏现有产品面的推倒式改写
- 公共逻辑尽量收敛到共享工具层，减少 store / route / provider 重复代码
- 任何涉及文件持久化的改动，都优先沿用现有共享 JSON store 工具

## PR 说明建议

建议在说明里写清楚：

- 改动目标
- 用户可见影响
- 是否有数据结构或运行时目录变化
- 文档是否已同步
- 本地验证结果
