import { analyzeProject } from '../analyzer'
import { getRunCommand } from '../analyzer/package-manager'
import { execute } from '../runner/executor'
import { log, info, CliError } from '../utils/log'
import { ensurePmAvailable } from '../utils/pm-availability'

/**
 * 运行任意 package.json 脚本
 */
export async function scriptCommand(projectDir: string, scriptName: string) {
  // 分析项目
  const project = await analyzeProject(projectDir)

  if (project.type === 'unknown') {
    throw new CliError('未检测到项目类型。请确保当前目录包含 package.json')
  }

  if (!project.scripts) {
    throw new CliError('无法读取 package.json 的 scripts')
  }

  // 检查脚本是否存在
  const scripts = project.scripts.scripts
  if (!(scriptName in scripts)) {
    showAvailableScripts(scripts)
    throw new CliError(`脚本 "${scriptName}" 不存在`)
  }

  log(`包管理器: ${project.packageManager.name}`)
  log(`执行脚本: ${scriptName}`)

  // 确保包管理器可用
  const resolvedPm = await ensurePmAvailable(project.packageManager.name)

  // 执行脚本
  const runCmd = getRunCommand(resolvedPm, scriptName)
  const exitCode = await execute(runCmd, { cwd: projectDir })

  if (exitCode !== 0) {
    throw new CliError('脚本执行失败', exitCode)
  }
}

/**
 * 显示可用脚本列表
 */
function showAvailableScripts(scripts: Record<string, string>) {
  const scriptNames = Object.keys(scripts)

  if (scriptNames.length === 0) {
    info('package.json 中没有定义任何脚本')
    return
  }

  info('可用的脚本:')
  for (const name of scriptNames) {
    console.log(`  - ${name}`)
  }
}
