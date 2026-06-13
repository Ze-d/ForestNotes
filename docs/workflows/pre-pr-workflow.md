# Pre-PR Workflow

提交 PR 前必须执行的完整检查流程。每一步都必须**实际运行命令并查看输出**，不得凭记忆或假设声称通过。

## 快速摘要

| 步骤 | 命令 | 通过标准 |
|------|------|----------|
| 1. Lint | `npm run lint` | 0 errors |
| 2. 类型检查 | `npx tsc -b` | 0 errors |
| 3. 单元测试 | `npm test` | 全部通过 |
| 4. 前端构建 | `npx vite build` | exit 0，输出 dist/ |
| 5. Rust 编译+测试 | `cd src-tauri && cargo test` | 0 failures |

---

## 详细步骤

### 1. Lint — ESLint

```bash
npm run lint
```

- **通过标准**: 无任何 error/warning 输出。
- **若失败**: 运行 `npx eslint . --fix` 自动修复，无法修复的手动处理。

### 2. 类型检查 — TypeScript

```bash
npx tsc -b
```

- **通过标准**: 零输出（exit code 0）。
- **注意**: 不要只依赖 Vite 的 `transpileOnly` 模式，必须跑完整 `tsc`。

### 3. 单元测试 — Vitest

```bash
npm test
```

- **通过标准**: 所有 test file 通过，0 failures。
- **确认事项**:
  - 新功能有对应的测试覆盖
  - Bug 修复有回归测试
  - 测试文件数量和用例数量未减少（除非有意移除废弃测试）

### 4. 前端构建 — Vite

```bash
npx vite build
```

- **通过标准**: `✓ built in X.XXs`，输出 `dist/` 目录。
- **可接受的 warning**:
  - `module "buffer" has been externalized` — 第三方库（gray-matter）的正常行为
  - `chunks larger than 500 kB` — 后续优化项，不阻塞 PR
  - 第三方库中的 `eval` warning — 不阻塞

### 5. Rust 编译与测试 — Cargo

```bash
cd src-tauri && cargo test
```

- **通过标准**: 编译成功 + 所有 test 通过（0 failures）。
- **可接受的 warning**: `dead_code` 为后续功能预留函数，不阻塞。
- **若新增了 Rust 代码**: 确认关键逻辑有 `#[cfg(test)] mod tests` 覆盖。

---

## 补充检查

根据 PR 的改动范围，选择性执行。

### 代码质量

- [ ] 无 `any` 类型（除非有注释说明理由）
- [ ] 优先使用 `const`，其次 `let`，不用 `var`
- [ ] 无硬编码密钥、token、API key
- [ ] 所有异步操作有错误处理
- [ ] 面向用户的字符串清晰有用

### Rust 侧改动

```bash
cd src-tauri && cargo clippy -- -D warnings   # Clippy 严格模式
```

### 新增/修改前端依赖

确认 `package.json` 变更合理，`package-lock.json` 已更新：

```bash
npm ci   # 验证 lock 文件一致性
```

### 数据安全

- [ ] 所有文件操作经过 `resolve_safe_path` 路径穿越保护
- [ ] 数据库操作包裹在错误处理中
- [ ] 无用户数据发往外部服务
- [ ] 无硬编码密钥、token、密码

### 架构一致性

- [ ] Markdown 文件仍是唯一真实数据源（SQLite 仅做 metadata/cache/index）
- [ ] 新功能未突破现有模块边界
- [ ] 未引入不必要的新依赖（新依赖需有文档化理由）

### MVP 边界检查

- [ ] 无云同步/账户/登录相关代码
- [ ] 无插件系统代码
- [ ] 无 AI/RAG/embeddings 代码
- [ ] 无复杂 block editor（当前分支的 3D 森林除外）
- [ ] 无移动端支持代码

---

## 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `npm test` 报 module 找不到 | 依赖未安装 | `npm ci` |
| `tsc -b` 报类型错误但 Vite dev 正常 | Vite 默认跳过类型检查 | 修复类型错误 |
| `cargo test` 报 Rust 版本不匹配 | `rust-toolchain.toml` 指定版本未安装 | `rustup update` |
| `cargo test` 有 `unused` warning | 后续功能预留函数 | 确认非本次改动引入即可 |

---

## 完成后

全部通过的确认话术：

```
✅ ESLint: 0 errors
✅ tsc: 0 errors
✅ Vitest: N files / M tests passed
✅ Vite build: built in Xs
✅ Cargo test: 0 failures

Ready for PR.
```

## 关联文档

- [testing-strategy.md](../testing/testing-strategy.md) — 测试分层与策略
- [tdd-guide.md](../testing/tdd-guide.md) — TDD Red-Green-Refactor 指南
- [coding-rules.md](../ai/coding-rules.md) — TypeScript / React / Rust / CSS / Git 编码规范
