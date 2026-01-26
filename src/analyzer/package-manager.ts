// 包管理器类型
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun'

// 包管理器检测来源
export type DetectionSource = 'packageManager' | 'volta' | 'lockfile' | 'default'

export interface PackageManagerInfo {
  name: PackageManager
  version?: string
  source: DetectionSource
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
export async function detectPackageManager(projectDir: string): Promise<PackageManagerInfo> {
  const packageJsonPath = `${projectDir}/package.json`

  // 读取 package.json
  const packageJson = await readPackageJson(packageJsonPath)
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
    const exists = await Bun.file(`${projectDir}/${lockfile}`).exists()
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
export function getRunCommand(pm: PackageManager, script: string): string[] {
  switch (pm) {
    case 'bun':
      return ['bun', 'run', script]
    case 'pnpm':
      return ['pnpm', script]
    case 'yarn':
      return ['yarn', script]
    case 'npm':
    default:
      return ['npm', 'run', script]
  }
}

/**
 * 获取包管理器的安装命令
 */
export function getInstallCommand(pm: PackageManager): string[] {
  switch (pm) {
    case 'bun':
      return ['bun', 'install']
    case 'pnpm':
      return ['pnpm', 'install']
    case 'yarn':
      return ['yarn', 'install']
    case 'npm':
    default:
      return ['npm', 'install']
  }
}

/**
 * 读取 package.json
 */
async function readPackageJson(path: string): Promise<any | null> {
  try {
    const file = Bun.file(path)
    if (await file.exists()) {
      return await file.json()
    }
  } catch {
    // 忽略错误
  }
  return null
}
