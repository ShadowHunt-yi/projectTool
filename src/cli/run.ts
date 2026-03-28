import { createInterface } from 'node:readline/promises'
import { analyzeProject, type ProjectInfo } from '../analyzer'
import { getRunCommand, getInstallCommand } from '../analyzer/package-manager'
import type { StandardScriptType } from '../analyzer/scripts'
import { execute } from '../runner/executor'
import { log, warn, success, info, newline, CliError } from '../utils/log'
import { resolvePmRuntime } from '../utils/pm-availability'

interface RunOptions {
  noInstall?: boolean
  forceInstall?: boolean
  scriptType?: StandardScriptType
  entry?: string
}

export async function runCommand(projectDir: string, options: RunOptions = {}) {
  const { noInstall = false, forceInstall = false, scriptType = 'dev', entry } = options

  log('正在分析项目...')
  const project = await analyzeProject(projectDir)

  if (project.type === 'unknown') {
    throw new CliError('未检测到项目类型。请确保当前目录包含 package.json')
  }

  log(`项目类型: ${project.type}`)
  log(`包管理器: ${project.packageManager.name} (from ${project.packageManager.source})`)

  if (!project.scripts) {
    throw new CliError('无法读取 package.json 的 scripts')
  }

  const resolvedEntry = await resolveEntry(project, scriptType, entry)
  const scriptName = findScript(project, scriptType, resolvedEntry)

  if (!scriptName) {
    showAvailableScripts(project, scriptType, resolvedEntry)
    throw new CliError(`未找到 ${scriptType}${resolvedEntry ? `:${resolvedEntry}` : ''} 相关的脚本`)
  }

  if (resolvedEntry) {
    log(`入口: ${resolvedEntry}`)
  }
  log(`将执行脚本: ${scriptName}`)

  const resolvedPm = await resolvePmRuntime(projectDir, project.packageManager)
  if (resolvedPm.name !== project.packageManager.name) {
    log(`使用 ${resolvedPm.name} 代替 ${project.packageManager.name}`)
  } else if (resolvedPm.source === 'corepack' && resolvedPm.version) {
    log(`使用 corepack 运行 ${resolvedPm.name}@${resolvedPm.version}`)
  }
  if (resolvedPm.reason) {
    log(resolvedPm.reason)
  }

  const shouldInstall = !noInstall && (forceInstall || project.dependencies.needsInstall)
  if (shouldInstall) {
    if (forceInstall) {
      log('强制安装依赖...')
    } else {
      log(`依赖状态: ${project.dependencies.reason || '需要安装'}`)
    }
    newline()

    const installCmd = getInstallCommand(resolvedPm)
    const installExitCode = await execute(installCmd, {
      cwd: projectDir,
      env: resolvedPm.env,
    })
    if (installExitCode !== 0) {
      throw new CliError('依赖安装失败', installExitCode)
    }

    success('依赖安装完成')
    newline()
  } else if (!noInstall) {
    log('依赖状态: 已是最新')
  }

  const runCmd = getRunCommand(resolvedPm, scriptName)
  const exitCode = await execute(runCmd, {
    cwd: projectDir,
    env: resolvedPm.env,
  })
  if (exitCode !== 0) {
    throw new CliError('脚本执行失败', exitCode)
  }
}

function findScript(project: ProjectInfo, scriptType: StandardScriptType, entry?: string): string | undefined {
  const scripts = project.scripts
  if (!scripts) return undefined

  if (entry) {
    const entryScript = `${scriptType}:${entry}`
    if (scripts.scripts[entryScript]) {
      return entryScript
    }
  }

  const detected = scripts.detected[scriptType]
  if (detected) {
    return detected
  }

  if (scripts.scripts[scriptType]) {
    return scriptType
  }

  return undefined
}

async function resolveEntry(project: ProjectInfo, scriptType: StandardScriptType, entry?: string): Promise<string | undefined> {
  if (!project.scripts) {
    return entry
  }

  if (entry) {
    validateEntry(project, scriptType, entry)
    return entry
  }

  if (scriptType !== 'dev') {
    return undefined
  }

  const { mpa } = project.scripts
  if (!mpa.isMpa || mpa.entries.length === 0) {
    return undefined
  }

  if (mpa.entries.length === 1) {
    const onlyEntry = mpa.entries[0]
    if (onlyEntry) {
      return onlyEntry
    }
    return undefined
  }

  const envEntry = process.env.PR_ENTRY?.trim()
  if (envEntry) {
    validateEntry(project, scriptType, envEntry)
    return envEntry
  }

  const defaultEntry = mpa.defaultEntry && hasEntryScript(project, scriptType, mpa.defaultEntry)
    ? mpa.defaultEntry
    : undefined

  if (!process.stdin.isTTY) {
    if (defaultEntry) {
      return defaultEntry
    }
    throw new CliError(
      `检测到 MPA 入口: ${mpa.entries.join(', ')}。非交互环境请使用 --entry <name> 或设置 PR_ENTRY。`
    )
  }

  return promptSelectEntry(project, scriptType, defaultEntry)
}

function validateEntry(project: ProjectInfo, scriptType: StandardScriptType, entry: string) {
  if (!hasEntryScript(project, scriptType, entry)) {
    const available = getAvailableEntriesByType(project, scriptType)
    if (available.length > 0) {
      throw new CliError(`入口 "${entry}" 不存在。可选入口: ${available.join(', ')}`)
    }
    throw new CliError(`入口 "${entry}" 不存在，且未找到 ${scriptType}:<entry> 脚本`)
  }
}

function hasEntryScript(project: ProjectInfo, scriptType: StandardScriptType, entry: string): boolean {
  const scripts = project.scripts
  if (!scripts) return false
  return Boolean(scripts.scripts[`${scriptType}:${entry}`])
}

function getAvailableEntriesByType(project: ProjectInfo, scriptType: StandardScriptType): string[] {
  const scripts = project.scripts
  if (!scripts) return []
  const mapping = scripts.mpa.scriptsByType[scriptType]
  if (!mapping) return []
  return Object.keys(mapping)
}

async function promptSelectEntry(
  project: ProjectInfo,
  scriptType: StandardScriptType,
  defaultEntry?: string
): Promise<string> {
  const entries = getAvailableEntriesByType(project, scriptType)
  if (entries.length === 0) {
    throw new CliError(`未找到 ${scriptType}:<entry> 脚本，无法选择 MPA 入口`)
  }

  const defaultResolved = defaultEntry && entries.includes(defaultEntry) ? defaultEntry : entries[0]
  if (!defaultResolved) {
    throw new CliError('未找到可用入口，无法继续执行')
  }
  info('检测到 MPA 项目，请选择启动入口：')
  entries.forEach((item, index) => {
    const marker = item === defaultResolved ? ' (默认)' : ''
    console.log(`  ${index + 1}) ${item}${marker}`)
  })
  console.log()

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(`请输入序号 [1-${entries.length}]，回车默认 ${defaultResolved}: `)
    const trimmed = answer.trim()
    if (!trimmed) {
      return defaultResolved
    }

    const number = Number(trimmed)
    if (Number.isInteger(number) && number >= 1 && number <= entries.length) {
      const selectedByNumber = entries[number - 1]
      if (selectedByNumber) {
        return selectedByNumber
      }
    }

    if (entries.includes(trimmed)) {
      return trimmed
    }
  } finally {
    rl.close()
  }

  throw new CliError('无效的入口选择，请重新运行并输入正确序号')
}

function showAvailableScripts(project: ProjectInfo, scriptType: StandardScriptType, entry?: string) {
  if (!project.scripts) return

  if (entry) {
    const availableEntries = getAvailableEntriesByType(project, scriptType)
    if (availableEntries.length > 0) {
      info(`可选 ${scriptType} 入口: ${availableEntries.join(', ')}`)
      return
    }
  }

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
