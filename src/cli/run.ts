import { analyzeProject, type ProjectInfo } from '../analyzer'
import { getRunCommand, getInstallCommand } from '../analyzer/package-manager'
import { execute } from '../runner/executor'
import { log, error, warn, success, info, newline } from '../utils/log'

type ScriptType = 'dev' | 'test' | 'build' | 'start'

interface RunOptions {
  noInstall?: boolean
  forceInstall?: boolean
  scriptType?: ScriptType
}

/**
 * qy run 命令
 * 完整流程：检测 → install → 启动
 */
export async function runCommand(projectDir: string, options: RunOptions = {}) {
  const { noInstall = false, forceInstall = false, scriptType = 'dev' } = options

  // 1. 分析项目
  log('正在分析项目...')
  const project = await analyzeProject(projectDir)

  if (project.type === 'unknown') {
    error('未检测到项目类型。请确保当前目录包含 package.json')
    process.exit(1)
  }

  // 2. 输出检测结果
  log(`项目类型: ${project.type}`)
  log(`包管理器: ${project.packageManager.name} (from ${project.packageManager.source})`)

  if (!project.scripts) {
    error('无法读取 package.json 的 scripts')
    process.exit(1)
  }

  // 3. 确定要执行的脚本
  const scriptName = findScript(project, scriptType)

  if (!scriptName) {
    error(`未找到 ${scriptType} 相关的脚本`)
    showAvailableScripts(project)
    process.exit(1)
  }

  log(`将执行脚本: ${scriptName}`)

  // 4. 检查依赖状态，决定是否需要 install
  const shouldInstall = !noInstall && (forceInstall || project.dependencies.needsInstall)

  if (shouldInstall) {
    if (forceInstall) {
      log('强制安装依赖...')
    } else {
      log(`依赖状态: ${project.dependencies.reason || '需要安装'}`)
    }
    newline()

    // 执行 install
    const installCmd = getInstallCommand(project.packageManager.name)
    const installExitCode = await execute(installCmd, { cwd: projectDir })

    if (installExitCode !== 0) {
      error('依赖安装失败')
      process.exit(installExitCode)
    }

    success('依赖安装完成')
    newline()
  } else if (!noInstall) {
    log('依赖状态: 已是最新')
  }

  // 5. 执行脚本
  const runCmd = getRunCommand(project.packageManager.name, scriptName)
  const exitCode = await execute(runCmd, { cwd: projectDir })

  if (exitCode !== 0) {
    process.exit(exitCode)
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
  info('使用 qy <script> 运行任意脚本')
}
