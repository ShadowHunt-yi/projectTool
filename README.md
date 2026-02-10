# project-runner (pr)

零配置智能项目运行器 - 一键运行任意 Node.js 项目

[![npm version](https://img.shields.io/npm/v/project-runner.svg)](https://www.npmjs.com/package/project-runner)
[![license](https://img.shields.io/npm/l/project-runner.svg)](https://github.com/liangzhenqi/project-runner/blob/main/LICENSE)

## 特性

- **零配置** - 自动检测项目类型和包管理器
- **智能识别** - 支持 npm / yarn / pnpm / bun
- **一键运行** - 自动安装依赖并启动项目
- **跨平台** - 支持 Windows / macOS / Linux

## 安装

```bash
# 使用 npm
npm install -g project-runner

# 使用 bun
bun install -g project-runner
```

## 使用

```bash
# 一键运行项目（自动 install + 启动开发服务器）
pr run

# 显示详细检测过程
pr run -v

# 跳过依赖安装
pr run --no-install

# 运行测试
pr test

# 构建项目
pr build

# 生产模式启动
pr start

# 运行任意 package.json 脚本
pr lint
pr custom-script

# 查看项目信息
pr info
```

## 工作原理

`pr run` 执行以下完整流程：

```
1. 检测项目类型 (Node.js / Python)
2. 检测包管理器 (npm / yarn / pnpm / bun)
   - 优先级: packageManager 字段 > volta 字段 > lockfile
3. 检测依赖状态
   - node_modules 是否存在
   - lockfile 是否更新
4. 安装依赖（如需要）
5. 读取 scripts，确定启动命令
6. 启动项目
```

## 包管理器检测

`pr` 通过以下方式检测包管理器（按优先级排序）：

1. **packageManager 字段** (corepack)
   ```json
   { "packageManager": "pnpm@9.1.0" }
   ```

2. **volta 字段**
   ```json
   { "volta": { "pnpm": "9.1.0" } }
   ```

3. **Lockfile 检测**
   - `bun.lockb` / `bun.lock` → bun
   - `pnpm-lock.yaml` → pnpm
   - `yarn.lock` → yarn
   - `package-lock.json` → npm

## 命令

| 命令 | 说明 |
|------|------|
| `pr run` | 完整流程：检测 → install → 启动开发服务器 |
| `pr test` | 运行测试 |
| `pr build` | 构建项目 |
| `pr start` | 生产模式启动 |
| `pr info` | 显示项目分析结果 |
| `pr <script>` | 运行 package.json 中的任意脚本 |

## 选项

| 选项 | 说明 |
|------|------|
| `-v, --verbose` | 显示详细检测过程 |
| `-d, --dir <path>` | 指定项目目录（默认：当前目录）|
| `-i, --install` | 强制执行依赖安装 |
| `--no-install` | 跳过依赖安装步骤 |
| `-h, --help` | 显示帮助信息 |
| `-V, --version` | 显示版本号 |

## 示例输出

### `pr info`

```
pr - 项目分析结果
────────────────────────────────────────
项目名称: my-app
版本:     1.0.0
项目类型: nodejs
包管理器: pnpm (lockfile)
依赖状态: 已就绪

识别的命令:
  pr run   → pnpm dev
  pr test  → pnpm test
  pr build → pnpm build

所有脚本:
  dev → vite
  test → vitest
  build → tsc && vite build
  lint → eslint .
```

### `pr run -v`

```
[pr] 正在分析项目...
[pr] 项目类型: nodejs
[pr] 包管理器: pnpm (from lockfile)
[pr] 将执行脚本: dev
[pr] 依赖状态: 已是最新
> pnpm dev

> my-app@1.0.0 dev
> vite

  VITE v5.0.0  ready in 300 ms
  ➜  Local:   http://localhost:5173/
```

## 开发

```bash
# 克隆项目
git clone https://github.com/liangzhenqi/project-runner.git
cd project-runner

# 安装依赖
bun install

# 本地运行
bun run dev

# 链接到全局
bun link
```

## License

MIT
