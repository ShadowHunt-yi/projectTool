import { stat } from 'fs/promises'
import { join } from 'path'

export interface DependencyStatus {
  hasNodeModules: boolean
  needsInstall: boolean
  reason?: string
}

// Lockfile 列表
const LOCKFILES = [
  'bun.lockb',
  'bun.lock',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
]

/**
 * 检测项目的依赖状态
 * 判断是否需要执行 install
 */
export async function checkDependencyStatus(projectDir: string): Promise<DependencyStatus> {
  const nodeModulesPath = join(projectDir, 'node_modules')

  // 1. 检查 node_modules 是否存在
  const nodeModulesExists = await directoryExists(nodeModulesPath)
  if (!nodeModulesExists) {
    return {
      hasNodeModules: false,
      needsInstall: true,
      reason: 'node_modules 不存在',
    }
  }

  // 2. 检查 lockfile 是否比 node_modules 更新
  const lockfilePath = await findLockfile(projectDir)
  if (lockfilePath) {
    const lockfileMtime = await getModifiedTime(lockfilePath)
    const nodeModulesMtime = await getModifiedTime(nodeModulesPath)

    if (lockfileMtime && nodeModulesMtime && lockfileMtime > nodeModulesMtime) {
      return {
        hasNodeModules: true,
        needsInstall: true,
        reason: 'lockfile 已更新',
      }
    }
  }

  // 3. 检查 package.json 是否比 node_modules 更新
  const packageJsonPath = join(projectDir, 'package.json')
  const packageJsonMtime = await getModifiedTime(packageJsonPath)
  const nodeModulesMtime = await getModifiedTime(nodeModulesPath)

  if (packageJsonMtime && nodeModulesMtime && packageJsonMtime > nodeModulesMtime) {
    return {
      hasNodeModules: true,
      needsInstall: true,
      reason: 'package.json 已更新',
    }
  }

  // 依赖状态正常
  return {
    hasNodeModules: true,
    needsInstall: false,
  }
}

/**
 * 查找项目中的 lockfile
 */
async function findLockfile(projectDir: string): Promise<string | null> {
  for (const lockfile of LOCKFILES) {
    const lockfilePath = join(projectDir, lockfile)
    if (await fileExists(lockfilePath)) {
      return lockfilePath
    }
  }
  return null
}

/**
 * 获取文件/目录的修改时间
 */
async function getModifiedTime(path: string): Promise<number | null> {
  try {
    const stats = await stat(path)
    return stats.mtimeMs
  } catch {
    return null
  }
}

/**
 * 检查目录是否存在
 */
async function directoryExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}

/**
 * 检查文件是否存在
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path)
    return stats.isFile()
  } catch {
    return false
  }
}
