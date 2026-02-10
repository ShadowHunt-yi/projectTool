import { resolve } from 'path'
import { setVerbose, error, warn, CliError } from './utils/log'
import { setupSignalHandlers } from './runner/executor'
import { runCommand } from './cli/run'
import { infoCommand } from './cli/info'
import { scriptCommand } from './cli/script'

declare const __VERSION__: string
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0-dev'

interface CliOptions {
  verbose: boolean
  dir: string
  noInstall: boolean
  install: boolean
}

function parseArgs(args: string[]): { command: string; options: CliOptions; args: string[] } {
  const options: CliOptions = {
    verbose: false,
    dir: process.cwd(),
    noInstall: false,
    install: false,
  }

  let command = ''
  const remainingArgs: string[] = []
  let i = 0

  while (i < args.length) {
    const arg = args[i]

    if (arg === '-v' || arg === '--verbose') {
      options.verbose = true
    } else if (arg === '-d' || arg === '--dir') {
      options.dir = resolve(args[++i] || '.')
    } else if (arg === '--no-install') {
      options.noInstall = true
    } else if (arg === '-i' || arg === '--install') {
      options.install = true
    } else if (arg === '-h' || arg === '--help') {
      command = 'help'
    } else if (arg === '-V' || arg === '--version') {
      command = 'version'
    } else if (!arg.startsWith('-')) {
      if (!command) {
        command = arg
      } else {
        remainingArgs.push(arg)
      }
    } else {
      warn(`未知选项: ${arg}`)
    }

    i++
  }

  return { command, options, args: remainingArgs }
}

function showHelp() {
  console.log(`
${'\x1b[36m'}pr${'\x1b[0m'} v${VERSION} - 零配置智能项目运行器 (project-runner)

${'\x1b[1m'}用法:${'\x1b[0m'} pr <command> [options]

${'\x1b[1m'}命令:${'\x1b[0m'}
  run              完整流程：检测 → install → 启动开发服务器
  test             运行测试
  build            构建项目
  start            生产模式启动
  info             显示项目分析结果
  <script>         运行 package.json 中的任意脚本

${'\x1b[1m'}选项:${'\x1b[0m'}
  -v, --verbose    显示详细检测过程
  -d, --dir <path> 指定项目目录 (默认: 当前目录)
  -i, --install    强制执行依赖安装
  --no-install     跳过依赖安装步骤
  -h, --help       显示帮助信息
  -V, --version    显示版本号

${'\x1b[1m'}示例:${'\x1b[0m'}
  pr run           一键启动项目
  pr run -i        强制安装依赖后启动
  pr run -v        显示详细检测过程
  pr test          运行测试
  pr lint          运行 lint 脚本
  pr info          查看项目信息
`)
}

function showVersion() {
  console.log(`pr v${VERSION}`)
}

async function main() {
  // 设置信号处理
  setupSignalHandlers()

  // 解析命令行参数
  const { command, options, args } = parseArgs(process.argv.slice(2))

  // 设置 verbose 模式
  setVerbose(options.verbose)

  // 处理命令
  switch (command) {
    case '':
    case 'help':
      showHelp()
      break

    case 'version':
      showVersion()
      break

    case 'run':
      await runCommand(options.dir, { noInstall: options.noInstall, forceInstall: options.install, scriptType: 'dev' })
      break

    case 'test':
      await runCommand(options.dir, { noInstall: true, scriptType: 'test' })
      break

    case 'build':
      await runCommand(options.dir, { noInstall: true, scriptType: 'build' })
      break

    case 'start':
      await runCommand(options.dir, { noInstall: true, scriptType: 'start' })
      break

    case 'info':
      await infoCommand(options.dir)
      break

    default:
      // 尝试运行自定义脚本
      await scriptCommand(options.dir, command)
      break
  }
}

main().catch((err) => {
  if (err instanceof CliError) {
    error(err.message)
    process.exit(err.exitCode)
  }
  error(err.message || '未知错误')
  process.exit(1)
})
