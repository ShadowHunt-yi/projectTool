import { join } from 'path'
import { fileExists } from '../utils/fs'

// 包管理器类型
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

// 包管理器检测来源
export type DetectionSource = 'packageManager' | 'volta' | 'lockfile' | 'default'

export interface PackageManagerInfo {
  name: PackageManager
  version?: string
  source: DetectionSource
}

export interface ResolvedPackageManager {
  name: PackageManager
  version?: string
  commandPrefix: string[]
  env?: Record<string, string>
  source: 'native' | 'corepack'
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

  // 1. 检查 packageManager 字段 (corepack)
  if (packageJson.packageManager) {
    const match = packageJson.packageManager.match(/^(npm|yarn|pnpm|bun)@(.+)$/)
    if (match) {
      return {
        name: match[1] as PackageManager,
        version: match[2],
        source: 'packageManager',
      }
    }
  }

  // 2. 检查 volta 字段
  if (packageJson.volta) {
    for (const pm of ['pnpm', 'yarn', 'npm'] as PackageManager[]) {
      if (packageJson.volta[pm]) {
        return {
          name: pm,
          version: packageJson.volta[pm],
          source: 'volta',
        }
      }
    }
  }

  // 3. 检测 lockfile
  for (const [lockfile, pm] of Object.entries(LOCKFILE_MAP)) {
    const exists = await fileExists(join(projectDir, lockfile))
    if (exists) {
      return { name: pm, source: 'lockfile' }
    }
  }

  // 默认使用 npm
  return { name: 'npm', source: 'default' }
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
