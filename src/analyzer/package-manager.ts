import { join } from 'path'
import { fileExists } from '../utils/fs'

// 包管理器类型
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

// 包管理器检测来源
export type DetectionSource = 'packageManager' | 'volta' | 'lockfile' | 'default'

export interface PackageManagerInfo {
  name: PackageManager
  version?: string
  nodeVersion?: string
  source: DetectionSource
}

export interface ResolvedPackageManager {
  name: PackageManager
  version?: string
  commandPrefix: string[]
  env?: Record<string, string>
  source: 'native' | 'corepack' | 'volta'
  reason?: string
}

// Lockfile 检测映射
const LOCKFILE_MAP: Record<string, PackageManager> = {
  'bun.lockb': 'bun',
  'bun.lock': 'bun',
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'package-lock.json': 'npm',
}

/**
 * 检测项目使用的包管理器
 * 优先级: packageManager 字段 > volta 字段 > lockfile
 */
export async function detectPackageManager(projectDir: string, packageJson?: any): Promise<PackageManagerInfo> {
  if (!packageJson) {
    return { name: 'npm', source: 'default' }
  }

  const nodeVersion = getVoltaNodeVersion(packageJson)

  // 1. 检查 packageManager 字段 (corepack)
  if (packageJson.packageManager) {
    const match = packageJson.packageManager.match(/^(npm|yarn|pnpm|bun)@(.+)$/)
    if (match) {
      return withNodeVersion({
        name: match[1] as PackageManager,
        version: match[2],
        source: 'packageManager',
      }, nodeVersion)
    }
  }

  // 2. 检查 volta 字段
  if (packageJson.volta) {
    for (const pm of ['pnpm', 'yarn', 'npm'] as PackageManager[]) {
      if (packageJson.volta[pm]) {
        return withNodeVersion({
          name: pm,
          version: packageJson.volta[pm],
          source: 'volta',
        }, nodeVersion)
      }
    }
  }

  // 3. 检测 lockfile
  for (const [lockfile, pm] of Object.entries(LOCKFILE_MAP)) {
    const exists = await fileExists(join(projectDir, lockfile))
    if (exists) {
      return withNodeVersion({ name: pm, source: 'lockfile' }, nodeVersion)
    }
  }

  // 默认使用 npm
  return withNodeVersion({ name: 'npm', source: 'default' }, nodeVersion)
}

function getVoltaNodeVersion(packageJson: any): string | undefined {
  const nodeVersion = packageJson?.volta?.node
  return typeof nodeVersion === 'string' && nodeVersion.trim() ? nodeVersion.trim() : undefined
}

function withNodeVersion(info: PackageManagerInfo, nodeVersion?: string): PackageManagerInfo {
  if (!nodeVersion) {
    return info
  }

  return {
    ...info,
    nodeVersion,
  }
}

/**
 * 获取包管理器的运行命令
 */
export function getRunCommand(pm: PackageManager | ResolvedPackageManager, script: string): string[] {
  const resolvedPm = normalizeResolvedPm(pm)

  switch (resolvedPm.name) {
    case 'bun':
      return [...resolvedPm.commandPrefix, 'run', script]
    case 'pnpm':
      return [...resolvedPm.commandPrefix, script]
    case 'yarn':
      return [...resolvedPm.commandPrefix, script]
    case 'npm':
    default:
      return [...resolvedPm.commandPrefix, 'run', script]
  }
}

/**
 * 获取包管理器的安装命令
 */
export function getInstallCommand(pm: PackageManager | ResolvedPackageManager): string[] {
  const resolvedPm = normalizeResolvedPm(pm)

  switch (resolvedPm.name) {
    case 'bun':
      return [...resolvedPm.commandPrefix, 'install']
    case 'pnpm':
      return [...resolvedPm.commandPrefix, 'install']
    case 'yarn':
      return [...resolvedPm.commandPrefix, 'install']
    case 'npm':
    default:
      return [...resolvedPm.commandPrefix, 'install']
  }
}

function normalizeResolvedPm(pm: PackageManager | ResolvedPackageManager): ResolvedPackageManager {
  if (typeof pm === 'string') {
    return {
      name: pm,
      commandPrefix: [pm],
      source: 'native',
    }
  }

  return pm
}
