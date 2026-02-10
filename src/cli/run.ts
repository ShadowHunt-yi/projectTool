import { analyzeProject, type ProjectInfo } from '../analyzer'
import { getRunCommand, getInstallCommand } from '../analyzer/package-manager'
import { execute } from '../runner/executor'
import { log, error, warn, success, info, newline, CliError } from '../utils/log'
import { ensurePmAvailable } from '../utils/pm-availability'

type ScriptType = 'dev' | 'test' | 'build' | 'start'

interface RunOptions {
  noInstall?: boolean
  forceInstall?: boolean
  scriptType?: ScriptType
}

/**
 * pr run 命令
 * 完整流程：检测 → install → 启动
 */
export async function runCommand(projectDir: string, options: RunOptions = {}) {
  const { noInstall = false, forceInstall = false, scriptType = 'dev' } = options

  // 1. 分析项目
  log('正在分析项目...')
  const project = await analyzeProject(projectDir)

  if (project.type === 'unknown') {
    throw new CliError('未检测到项目类型。请确保当前目录包含 package.json')
  }

  // 2. 输出检测结果
  log(`项目类型: ${project.type}`)
  log(`包管理器: ${project.packageManager.name} (from ${project.packageManager.source})`)

  if (!project.scripts) {
    throw new CliError('无法读取 package.json 的 scripts')
  }

  // 3. 确定要执行的脚本
  const scriptName = findScript(project, scriptType)

  if (!scriptName) {
    showAvailableScripts(project)
    throw new CliError(`未找到 ${scriptType} 相关的脚本`)
  }

  log(`将执行脚本: ${scriptName}`)

  // 4. 确保包管理器可用
  const resolvedPm = await ensurePmAvailable(project.packageManager.name)
  if (resolvedPm !== project.packageManager.name) {
    log(`使用 ${resolvedPm} 代替 ${project.packageManager.name}`)
  }

  // 5. 检查依赖状态，决定是否需要 install
  const shouldInstall = !noInstall && (forceInstall || project.dependencies.needsInstall)

  if (shouldInstall) {
    if (forceInstall) {
      log('强制安装依赖...')
    } else {
      log(`依赖状态: ${project.dependencies.reason || '需要安装'}`)
    }
    newline()

    // 执行 install
    const installCmd = getInstallCommand(resolvedPm)
    const installExitCode = await execute(installCmd, { cwd: projectDir })

    if (installExitCode !== 0) {
      throw new CliError('依赖安装失败', installExitCode)
    }

    success('依赖安装完成')
    newline()
  } else if (!noInstall) {
    log('依赖状态: 已是最新')
  }

  // 6. 执行脚本
  const runCmd = getRunCommand(resolvedPm, scriptName)
  const exitCode = await execute(runCmd, { cwd: projectDir })

  if (exitCode !== 0) {
    throw new CliError('脚本执行失败', exitCode)
  }
}

/**
 * 根据脚本类型找到对应的脚本名
 */
function findScript(project: ProjectInfo, scriptType: ScriptType): string | undefined {
  const scripts = project.scripts
  if (!scripts) return undefined

  // 使用智能检测的结果
  const detected = scripts.detected[scriptType]
  if (detected) {
    return detected
  }

  // 如果没有检测到，尝试精确匹配
  if (scripts.scripts[scriptType]) {
    return scriptType
  }

  return undefined
}

/**
 * 显示可用的脚本列表
 */
function showAvailableScripts(project: ProjectInfo) {
  if (!project.scripts) return

  const scriptNames = Object.keys(project.scripts.scripts)
  if (scriptNames.length === 0) {
    warn('package.json 中没有定义任何 scripts')
    return
  }

  info('可用的脚本:')
  for (const name of scriptNames) {
    console.log(`  - ${name}`)
  }
  console.log()
  info('使用 pr <script> 运行任意脚本')
}
