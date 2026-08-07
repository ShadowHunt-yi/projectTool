import { resolve } from 'path'
import { setVerbose, error, warn, CliError } from './utils/log'
import { setupSignalHandlers } from './runner/executor'
import { runCommand } from './cli/run'
import { infoCommand } from './cli/info'
import { scriptCommand } from './cli/script'
import { cleanCommand } from './cli/clean'
import { doctorCommand } from './cli/doctor'
import { addCommand, removeCommand } from './cli/add'
import { initCommand } from './cli/init'
import { upgradeCommand } from './cli/upgrade'
import { openCommand } from './cli/open'

declare const __VERSION__: string
const VERSION = typeof __VERSION__ !== 'undefined' ? __VERSION__ : '0.0.0-dev'

interface CliOptions {
  verbose: boolean
  dir: string
  noInstall: boolean
  install: boolean
  entry?: string
  filter?: string
  all: boolean
  open: boolean
  dev: boolean
  global: boolean
  template?: string
  pm?: string
  name?: string
  cache: boolean
  reinstall: boolean
}

function parseArgs(args: string[]): { command: string; options: CliOptions; args: string[] } {
  const options: CliOptions = {
    verbose: false,
    dir: process.cwd(),
    noInstall: false,
    install: false,
    all: false,
    open: false,
    dev: false,
    global: false,
    cache: false,
    reinstall: false,
  }

  let command = ''
  const remainingArgs: string[] = []
  let i = 0

  while (i < args.length) {
    const arg = args[i]
    if (!arg) {
      i++
      continue
    }

    if (arg === '-v' || arg === '--verbose') {
      options.verbose = true
    } else if (arg === '-d' || arg === '--dir') {
      const dirArg = args[i + 1]
      if (!dirArg || dirArg.startsWith('-')) {
        throw new CliError('--dir 需要一个目录参数')
      }
      options.dir = resolve(dirArg)
      i++
    } else if (arg === '--no-install') {
      options.noInstall = true
    } else if (arg === '-i' || arg === '--install') {
      options.install = true
    } else if (arg === '-e' || arg === '--entry') {
      const entryArg = args[i + 1]
      if (!entryArg || entryArg.startsWith('-')) {
        throw new CliError('--entry 需要一个入口名参数')
      }
      options.entry = entryArg.trim()
      i++
    } else if (arg === '--filter') {
      const filterArg = args[i + 1]
      if (!filterArg || filterArg.startsWith('-')) {
        throw new CliError('--filter 需要一个包名参数')
      }
      options.filter = filterArg.trim()
      i++
    } else if (arg === '--all') {
      options.all = true
    } else if (arg === '--open') {
      options.open = true
    } else if (arg === '-D' || arg === '--dev') {
      options.dev = true
    } else if (arg === '-g' || arg === '--global') {
      options.global = true
    } else if (arg === '--cache') {
      options.cache = true
    } else if (arg === '--reinstall') {
      options.reinstall = true
    } else if (arg === '--template' || arg === '-t') {
      const tplArg = args[i + 1]
      if (!tplArg || tplArg.startsWith('-')) {
        throw new CliError('--template 需要一个模板名参数')
      }
      options.template = tplArg.trim()
      i++
    } else if (arg === '--pm') {
      const pmArg = args[i + 1]
      if (!pmArg || pmArg.startsWith('-')) {
        throw new CliError('--pm 需要一个包管理器名参数')
      }
      options.pm = pmArg.trim()
      i++
    } else if (arg === '--name') {
      const nameArg = args[i + 1]
      if (!nameArg || nameArg.startsWith('-')) {
        throw new CliError('--name 需要一个项目名参数')
      }
      options.name = nameArg.trim()
      i++
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
  run              完整流程:检测 -> install -> 启动开发脚本
  test             运行测试
  build            构建项目
  start            生产模式启动
  info             显示项目分析结果
  clean            清理 node_modules 和构建产物
  doctor           项目诊断:Node 版本/PM/安全审计
  add <pkg>        安装依赖 (pr add lodash -D)
  remove <pkg>     移除依赖 (pr remove lodash)
  init [template]  初始化新项目 (vite/express/cli/empty)
  open             打开浏览器到开发服务器
  upgrade          升级 project-runner 到最新版本
  <script>         运行 package.json 中的任意脚本

${'\x1b[1m'}选项:${'\x1b[0m'}
  -v, --verbose    显示详细检测过程
  -d, --dir <path> 指定项目目录 (默认: 当前目录)
  -i, --install    强制执行依赖安装
  --no-install     跳过依赖安装步骤
  -e, --entry      指定 MPA 入口 (也可用环境变量 PR_ENTRY)
  --filter <name>  在指定 workspace 子包中运行
  --all            在所有 workspace 子包中运行
  --open           启动 dev server 后自动打开浏览器
  -D, --dev        安装到 devDependencies (pr add)
  -g, --global     全局安装 (pr add)
  --cache          清理 PM 缓存 (pr clean)
  --reinstall      清理后重装依赖 (pr clean)
  -t, --template   指定项目模板 (pr init)
  --pm <name>      指定包管理器 (pr init)
  --name <name>    指定项目名 (pr init)
  -h, --help       显示帮助信息
  -V, --version    显示版本号

${'\x1b[1m'}示例:${'\x1b[0m'}
  pr run
  pr run --entry main
  pr run --open
  pr run --all
  pr run --filter @scope/pkg
  PR_ENTRY=formengine pr run
  pr build --entry approve
  pr info
  pr clean --reinstall
  pr doctor
  pr add lodash -D
  pr init -t vite
  pr upgrade
`)
}

function showVersion() {
  console.log(`pr v${VERSION}`)
}

async function main() {
  setupSignalHandlers()
  const { command, options, args: remainingArgs } = parseArgs(process.argv.slice(2))
  setVerbose(options.verbose)

  switch (command) {
    case '':
    case 'help':
      showHelp()
      break

    case 'version':
      showVersion()
      break

    case 'run':
      await runCommand(options.dir, {
        noInstall: options.noInstall,
        forceInstall: options.install,
        scriptType: 'dev',
        entry: options.entry,
        filter: options.filter,
        all: options.all,
        open: options.open,
      })
      break

    case 'test':
      await runCommand(options.dir, {
        noInstall: options.noInstall,
        forceInstall: options.install,
        scriptType: 'test',
        entry: options.entry,
      })
      break

    case 'build':
      await runCommand(options.dir, {
        noInstall: options.noInstall,
        forceInstall: options.install,
        scriptType: 'build',
        entry: options.entry,
      })
      break

    case 'start':
      await runCommand(options.dir, {
        noInstall: options.noInstall,
        forceInstall: options.install,
        scriptType: 'start',
        entry: options.entry,
      })
      break

    case 'info':
      await infoCommand(options.dir)
      break

    case 'clean':
      await cleanCommand(options.dir, { cache: options.cache, reinstall: options.reinstall })
      break

    case 'doctor':
      await doctorCommand(options.dir)
      break

    case 'add':
      await addCommand(options.dir, remainingArgs, { dev: options.dev, global: options.global })
      break

    case 'remove':
    case 'rm':
      await removeCommand(options.dir, remainingArgs, { global: options.global })
      break

    case 'init':
      await initCommand(options.dir, {
        template: options.template || remainingArgs[0],
        pm: (options.pm as any) || 'npm',
        name: options.name,
      })
      break

    case 'open':
      await openCommand(options.dir)
      break

    case 'upgrade':
    case 'self-update':
      await upgradeCommand()
      break

    default:
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
