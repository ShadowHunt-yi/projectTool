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

/**
 * 获取包管理器的添加依赖命令
 */
export function getAddCommand(pm: PackageManager | ResolvedPackageManager, packages: string[], options?: { dev?: boolean; global?: boolean }): string[] {
  const resolvedPm = normalizeResolvedPm(pm)
  const { dev = false, global = false } = options || {}

  switch (resolvedPm.name) {
    case 'bun':
      return [...resolvedPm.commandPrefix, 'add', ...(dev ? ['-d'] : []), ...packages]
    case 'pnpm':
      return [...resolvedPm.commandPrefix, 'add', ...(dev ? ['-D'] : []), ...(global ? ['-g'] : []), ...packages]
    case 'yarn':
      if (global) return [...resolvedPm.commandPrefix, 'global', 'add', ...packages]
      return [...resolvedPm.commandPrefix, 'add', ...(dev ? ['--dev'] : []), ...packages]
    case 'npm':
    default:
      return [...resolvedPm.commandPrefix, 'install', ...(dev ? ['--save-dev'] : ['--save']), ...(global ? ['-g'] : []), ...packages]
  }
}

/**
 * 获取包管理器的移除依赖命令
 */
export function getRemoveCommand(pm: PackageManager | ResolvedPackageManager, packages: string[], options?: { global?: boolean }): string[] {
  const resolvedPm = normalizeResolvedPm(pm)
  const { global = false } = options || {}

  switch (resolvedPm.name) {
    case 'bun':
      return [...resolvedPm.commandPrefix, 'remove', ...packages]
    case 'pnpm':
      return [...resolvedPm.commandPrefix, 'remove', ...(global ? ['-g'] : []), ...packages]
    case 'yarn':
      if (global) return [...resolvedPm.commandPrefix, 'global', 'remove', ...packages]
      return [...resolvedPm.commandPrefix, 'remove', ...packages]
    case 'npm':
    default:
      return [...resolvedPm.commandPrefix, 'uninstall', ...(global ? ['-g'] : []), ...packages]
  }
}

/**
 * 获取包管理器的清理缓存命令
 */
export function getCleanCacheCommand(pm: PackageManager | ResolvedPackageManager): string[] {
  const resolvedPm = normalizeResolvedPm(pm)

  switch (resolvedPm.name) {
    case 'bun':
      return [...resolvedPm.commandPrefix, 'pm', 'cache', 'rm']
    case 'pnpm':
      return [...resolvedPm.commandPrefix, 'store', 'prune']
    case 'yarn':
      return [...resolvedPm.commandPrefix, 'cache', 'clean']
    case 'npm':
    default:
      return [...resolvedPm.commandPrefix, 'cache', 'clean', '--force']
  }
}

/**
 * 获取包管理器的审计命令
 */
export function getAuditCommand(pm: PackageManager | ResolvedPackageManager): string[] {
  const resolvedPm = normalizeResolvedPm(pm)

  switch (resolvedPm.name) {
    case 'bun':
      return [...resolvedPm.commandPrefix, 'audit']
    case 'pnpm':
      return [...resolvedPm.commandPrefix, 'audit']
    case 'yarn':
      return [...resolvedPm.commandPrefix, 'audit']
    case 'npm':
    default:
      return [...resolvedPm.commandPrefix, 'audit']
  }
}

/**
 * 获取包管理器的 outdated 命令
 */
export function getOutdatedCommand(pm: PackageManager | ResolvedPackageManager): string[] {
  const resolvedPm = normalizeResolvedPm(pm)

  switch (resolvedPm.name) {
    case 'bun':
      return [...resolvedPm.commandPrefix, 'outdated']
    case 'pnpm':
      return [...resolvedPm.commandPrefix, 'outdated']
    case 'yarn':
      return [...resolvedPm.commandPrefix, 'outdated']
    case 'npm':
    default:
      return [...resolvedPm.commandPrefix, 'outdated']
  }
}

/**
 * 获取包管理器的 workspace 过滤执行命令
 */
export function getWorkspaceRunCommand(pm: PackageManager | ResolvedPackageManager, script: string, filter?: string): { cmd: string[]; cwd: string } {
  const resolvedPm = normalizeResolvedPm(pm)

  if (!filter) {
    return { cmd: getRunCommand(resolvedPm, script), cwd: '' }
  }

  switch (resolvedPm.name) {
    case 'pnpm':
      return { cmd: [...resolvedPm.commandPrefix, '--filter', filter, script], cwd: '' }
    case 'yarn':
      return { cmd: [...resolvedPm.commandPrefix, 'workspace', filter, script], cwd: '' }
    case 'npm':
      return { cmd: [...resolvedPm.commandPrefix, 'run', script, '-w', filter], cwd: '' }
    case 'bun':
    default:
      return { cmd: [...resolvedPm.commandPrefix, 'run', script, '--filter', filter], cwd: '' }
  }
}

/**
 * 获取包管理器的 workspace 全量执行命令
 */
export function getWorkspaceAllCommand(pm: PackageManager | ResolvedPackageManager, script: string): { cmd: string[]; cwd: string } | null {
  const resolvedPm = normalizeResolvedPm(pm)

  switch (resolvedPm.name) {
    case 'pnpm':
      return { cmd: [...resolvedPm.commandPrefix, '-r', script], cwd: '' }
    case 'yarn':
      return { cmd: [...resolvedPm.commandPrefix, 'workspaces', 'foreach', 'run', script], cwd: '' }
    case 'npm':
      return { cmd: [...resolvedPm.commandPrefix, 'run', script, '--workspaces'], cwd: '' }
    case 'bun':
      return { cmd: [...resolvedPm.commandPrefix, 'run', script, '--all'], cwd: '' }
    default:
      return null
  }
}

export interface WorkspaceInfo {
  isWorkspace: boolean
  pm: PackageManager
  packages: { name: string; path: string }[]
  root: string
}

/**
 * 检测是否为 monorepo/workspace 项目
 */
export async function detectWorkspace(projectDir: string, packageJson?: any): Promise<WorkspaceInfo | null> {
  const pm = await detectPackageManager(projectDir, packageJson)

  // pnpm-workspace.yaml
  const pnpmWorkspacePath = join(projectDir, 'pnpm-workspace.yaml')
  if (await fileExists(pnpmWorkspacePath)) {
    try {
      const content = await readFile(pnpmWorkspacePath, 'utf-8')
      const globs = content
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('#'))
        .map((l) => l.replace(/^-\s+/, ''))

      const packages = await resolveWorkspaceGlobs(projectDir, globs)
      if (packages.length > 0) {
        return { isWorkspace: true, pm: pm.name, packages, root: projectDir }
      }
    } catch {
      // ignore
    }
  }

  // package.json workspaces
  if (packageJson?.workspaces) {
    const globs = Array.isArray(packageJson.workspaces)
      ? packageJson.workspaces
      : Array.isArray(packageJson.workspaces.packages)
        ? packageJson.workspaces.packages
        : []
    const packages = await resolveWorkspaceGlobs(projectDir, globs)
    if (packages.length > 0) {
      return { isWorkspace: true, pm: pm.name, packages, root: projectDir }
    }
  }

  return null
}

async function resolveWorkspaceGlobs(root: string, globs: string[]): Promise<{ name: string; path: string }[]> {
  const { glob } = await import('fs/promises')
  const results: { name: string; path: string }[] = []

  for (const pattern of globs) {
    // Simple glob: packages/*
    const base = pattern.replace(/\/\*$/, '')
    const fullBase = join(root, base)
    if (!(await directoryExists(fullBase))) continue

    try {
      const entries = await glob(join(fullBase, '*/package.json').replace(/\\/g, '/'))
      for (const pkgJsonPath of entries) {
        try {
          const pkgContent = await readFile(pkgJsonPath, 'utf-8')
          const pkg = JSON.parse(pkgContent)
          if (pkg.name) {
            results.push({ name: pkg.name, path: join(pkgJsonPath, '..') })
          }
        } catch {
          // skip invalid
        }
      }
    } catch {
      // glob not available, fallback
    }
  }

  return results
}
