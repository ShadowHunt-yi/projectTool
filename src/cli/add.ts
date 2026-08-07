import { analyzeProject } from '../analyzer'
import { getAddCommand, getRemoveCommand } from '../analyzer/package-manager'
import { execute } from '../runner/executor'
import { log, info, CliError } from '../utils/log'
import { resolvePmRuntime } from '../utils/pm-availability'

interface AddOptions {
  dev?: boolean
  global?: boolean
}

export async function addCommand(projectDir: string, packages: string[], options: AddOptions = {}) {
  const { dev = false, global = false } = options

  if (packages.length === 0) {
    throw new CliError('请指定要安装的包名,例如: pr add lodash')
  }

  const project = await analyzeProject(projectDir)
  if (project.type === 'unknown' && !global) {
    throw new CliError('未检测到项目类型。请确保当前目录包含 package.json')
  }

  const resolvedPm = await resolvePmRuntime(projectDir, project.packageManager)
  const addCmd = getAddCommand(resolvedPm, packages, { dev, global })

  log(`包管理器: ${resolvedPm.name}`)
  const scope = global ? '全局' : dev ? 'devDependencies' : 'dependencies'
  log(`安装到: ${scope}`)
  log(`安装包: ${packages.join(' ')}`)

  const exitCode = await execute(addCmd, { cwd: projectDir, env: resolvedPm.env })
  if (exitCode !== 0) {
    throw new CliError('安装失败', exitCode)
  }
}

export async function removeCommand(projectDir: string, packages: string[], options: AddOptions = {}) {
  const { global = false } = options

  if (packages.length === 0) {
    throw new CliError('请指定要移除的包名,例如: pr remove lodash')
  }

  const project = await analyzeProject(projectDir)
  if (project.type === 'unknown' && !global) {
    throw new CliError('未检测到项目类型。请确保当前目录包含 package.json')
  }

  const resolvedPm = await resolvePmRuntime(projectDir, project.packageManager)
  const removeCmd = getRemoveCommand(resolvedPm, packages, { global })

  log(`包管理器: ${resolvedPm.name}`)
  const scope = global ? '全局' : '项目依赖'
  log(`移除范围: ${scope}`)
  log(`移除包: ${packages.join(' ')}`)

  const exitCode = await execute(removeCmd, { cwd: projectDir, env: resolvedPm.env })
  if (exitCode !== 0) {
    throw new CliError('移除失败', exitCode)
  }
}
