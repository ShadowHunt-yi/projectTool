import { createInterface } from 'node:readline/promises'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { executeCapture } from '../runner/executor'
import { info, warn, success, error, colors, CliError } from './log'
import type { PackageManager, PackageManagerInfo, ResolvedPackageManager } from '../analyzer/package-manager'

// 会话级缓存：PM 名称 → 是否可用
const availabilityCache = new Map<PackageManager, boolean>()
const YARN_CLASSIC_VERSION = '1.22.22'
let corepackAvailableCache: boolean | undefined
let voltaAvailableCache: boolean | undefined

interface PreferredPmVersion {
  version: string
  reason: string
}

/**
 * 检测包管理器是否已安装
 */
export async function isPmAvailable(pm: PackageManager): Promise<boolean> {
  if (availabilityCache.has(pm)) {
    return availabilityCache.get(pm)!
  }

  try {
    const result = await executeCapture([pm, '--version'])
    const available = result.exitCode === 0 && result.stdout.trim().length > 0
    availabilityCache.set(pm, available)
    return available
  } catch {
    // spawn ENOENT 或其他系统错误 → 不可用
    availabilityCache.set(pm, false)
    return false
  }
}

/**
 * 确保包管理器可用
 * 如果不可用，交互环境下提示用户选择；非交互环境自动回退到 npm
 * 返回实际使用的包管理器名称（可能与输入不同）
 */
export async function ensurePmAvailable(pm: PackageManager): Promise<PackageManager> {
  // npm 随 Node.js 自带，直接跳过
  if (pm === 'npm') {
    return pm
  }

  const available = await isPmAvailable(pm)
  if (available) {
    return pm
  }

  // PM 不可用
  warn(`包管理器 ${pm} 未安装`)

  if (!process.stdin.isTTY) {
    // 非交互环境（CI/CD、管道输入等）：自动回退
    warn('非交互环境，自动回退到 npm')
    return 'npm'
  }

  // 交互环境：提示用户选择
  return await promptPmResolution(pm)
}

/**
 * 解析项目实际应使用的包管理器运行时
 */
export async function resolvePmRuntime(
  projectDir: string,
  pmInfo: PackageManagerInfo
): Promise<ResolvedPackageManager> {
  const preferredVersion = await getPreferredPmVersion(projectDir, pmInfo)

  if (pmInfo.nodeVersion) {
    if (await isVoltaAvailable()) {
      const commandPrefix = buildVoltaCommandPrefix(pmInfo, preferredVersion?.version)

      return {
        name: pmInfo.name,
        version: preferredVersion?.version,
        commandPrefix,
        source: 'volta',
        reason: [
          `检测到 volta.node=${pmInfo.nodeVersion}，通过 Volta 切换 Node 运行项目命令`,
          preferredVersion?.reason,
        ].filter(Boolean).join('；'),
      }
    }

    warn(`检测到 volta.node=${pmInfo.nodeVersion}，但未找到 volta 命令，无法自动切换 Node 版本`)
  }

  if (preferredVersion && supportsCorepack(pmInfo.name) && await isCorepackAvailable()) {
    return {
      name: pmInfo.name,
      version: preferredVersion.version,
      commandPrefix: ['corepack', `${pmInfo.name}@${preferredVersion.version}`],
      env: {
        COREPACK_ENABLE_AUTO_PIN: '0',
      },
      source: 'corepack',
      reason: preferredVersion.reason,
    }
  }

  const resolvedPm = await ensurePmAvailable(pmInfo.name)

  return {
    name: resolvedPm,
    commandPrefix: [resolvedPm],
    source: 'native',
  }
}

function buildVoltaCommandPrefix(pmInfo: PackageManagerInfo, pmVersion?: string): string[] {
  const commandPrefix = ['volta', 'run', '--node', pmInfo.nodeVersion!]
  const versionFlag = getVoltaPackageManagerFlag(pmInfo.name)

  if (versionFlag && pmVersion) {
    commandPrefix.push(versionFlag, pmVersion)
  }

  commandPrefix.push(pmInfo.name)
  return commandPrefix
}

/**
 * 交互式提示，让用户选择处理方式
 */
async function promptPmResolution(pm: PackageManager): Promise<PackageManager> {
  console.log()
  console.log(`  检测到项目使用 ${colors.cyan}${pm}${colors.reset}，但系统未安装。`)
  console.log()
  console.log(`  ${colors.bold}请选择操作:${colors.reset}`)
  console.log(`    ${colors.cyan}1${colors.reset}) 自动安装 ${pm} ${colors.dim}(npm install -g ${pm})${colors.reset}`)
  console.log(`    ${colors.cyan}2${colors.reset}) 使用 npm 代替`)
  console.log(`    ${colors.cyan}3${colors.reset}) 退出，手动处理`)
  console.log()

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  try {
    const answer = await rl.question(`  请输入选项 ${colors.dim}[1/2/3]${colors.reset}: `)
    const choice = answer.trim()

    switch (choice) {
      case '1':
        return await autoInstallPm(pm)

      case '2':
        warn(`使用 npm 代替 ${pm}`)
        return 'npm'

      case '3':
      default:
        throw new CliError(`请先安装 ${pm}: npm install -g ${pm}`)
    }
  } finally {
    rl.close()
  }
}

/**
 * 通过 npm 全局安装缺失的包管理器
 */
async function autoInstallPm(pm: PackageManager): Promise<PackageManager> {
  info(`正在安装 ${pm}...`)
  console.log()

  try {
    const result = await executeCapture(['npm', 'install', '-g', pm])

    if (result.exitCode !== 0) {
      error(`安装 ${pm} 失败`)
      if (result.stderr.trim()) {
        console.error(result.stderr.trim())
      }
      throw new CliError(`无法自动安装 ${pm}，请手动运行: npm install -g ${pm}`)
    }
  } catch (err) {
    if (err instanceof CliError) throw err
    throw new CliError(`安装 ${pm} 时出错，请手动运行: npm install -g ${pm}`)
  }

  // 清除缓存，重新验证
  availabilityCache.delete(pm)
  const nowAvailable = await isPmAvailable(pm)

  if (!nowAvailable) {
    throw new CliError(`${pm} 已安装但无法执行。请检查 PATH 或重新打开终端后重试。`)
  }

  success(`${pm} 安装完成`)
  console.log()
  return pm
}

async function isCorepackAvailable(): Promise<boolean> {
  if (corepackAvailableCache !== undefined) {
    return corepackAvailableCache
  }

  try {
    const result = await executeCapture(['corepack', '--version'])
    corepackAvailableCache = result.exitCode === 0 && result.stdout.trim().length > 0
  } catch {
    corepackAvailableCache = false
  }

  return corepackAvailableCache
}

async function isVoltaAvailable(): Promise<boolean> {
  if (voltaAvailableCache !== undefined) {
    return voltaAvailableCache
  }

  try {
    const result = await executeCapture(['volta', '--version'])
    voltaAvailableCache = result.exitCode === 0 && result.stdout.trim().length > 0
  } catch {
    voltaAvailableCache = false
  }

  return voltaAvailableCache
}

async function getPreferredPmVersion(projectDir: string, pmInfo: PackageManagerInfo): Promise<PreferredPmVersion | undefined> {
  if (pmInfo.version) {
    return {
      version: pmInfo.version,
      reason: `检测到 ${pmInfo.source} 指定的 ${pmInfo.name}@${pmInfo.version}，优先使用对应版本`,
    }
  }

  if (pmInfo.name !== 'yarn' || pmInfo.source !== 'lockfile') {
    return undefined
  }

  const yarnLockKind = await detectYarnLockKind(projectDir)
  if (yarnLockKind !== 'classic') {
    return undefined
  }

  return {
    version: YARN_CLASSIC_VERSION,
    reason: `检测到 yarn.lock v1，优先使用 Yarn Classic ${YARN_CLASSIC_VERSION} 以避免全局 Yarn Berry 自动迁移`,
  }
}

async function detectYarnLockKind(projectDir: string): Promise<'classic' | 'berry' | 'unknown'> {
  try {
    const content = await readFile(join(projectDir, 'yarn.lock'), 'utf-8')
    const header = content.slice(0, 512)

    if (header.includes('yarn lockfile v1')) {
      return 'classic'
    }

    if (content.includes('__metadata:')) {
      return 'berry'
    }
  } catch {
    return 'unknown'
  }

  return 'unknown'
}

function supportsCorepack(pm: PackageManager): boolean {
  return pm === 'npm' || pm === 'pnpm' || pm === 'yarn'
}

function getVoltaPackageManagerFlag(pm: PackageManager): string | undefined {
  switch (pm) {
    case 'npm':
      return '--npm'
    case 'pnpm':
      return '--pnpm'
    case 'yarn':
      return '--yarn'
    default:
      return undefined
  }
}
