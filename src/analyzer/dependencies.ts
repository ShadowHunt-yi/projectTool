import { stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { fileExists, directoryExists } from '../utils/fs'

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

const INSTALL_MARKERS = [
  '.pr-install-stamp',
  '.yarn-integrity',
  '.package-lock.json',
  '.modules.yaml',
]

const MTIME_TOLERANCE_MS = 1000

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

  // 使用安装基线时间判断依赖是否过期。仅看 node_modules 根目录的 mtime
  // 容易被 lockfile 写入顺序和文件系统毫秒级偏差误判。
  const installBaselineMtime = await getInstallBaselineTime(projectDir)

  // 2. 检查 lockfile 是否比 node_modules 更新
  const lockfilePath = await findLockfile(projectDir)
  if (lockfilePath) {
    const lockfileMtime = await getModifiedTime(lockfilePath)

    if (lockfileMtime && installBaselineMtime && lockfileMtime - installBaselineMtime > MTIME_TOLERANCE_MS) {
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

  if (packageJsonMtime && installBaselineMtime && packageJsonMtime - installBaselineMtime > MTIME_TOLERANCE_MS) {
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

export async function markDependenciesInstalled(projectDir: string): Promise<void> {
  const stampPath = join(projectDir, 'node_modules', '.pr-install-stamp')

  try {
    await writeFile(stampPath, `${Date.now()}\n`, 'utf-8')
  } catch {
    // 安装已成功时，标记写入失败不应阻塞主流程。
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

async function getInstallBaselineTime(projectDir: string): Promise<number | null> {
  const nodeModulesPath = join(projectDir, 'node_modules')
  const markerPaths = INSTALL_MARKERS.map((marker) => join(nodeModulesPath, marker))
  const candidates = await Promise.all([
    getModifiedTime(nodeModulesPath),
    ...markerPaths.map((path) => getModifiedTime(path)),
  ])

  const validTimes = candidates.filter((time): time is number => time !== null)
  if (validTimes.length === 0) {
    return null
  }

  return Math.max(...validTimes)
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
