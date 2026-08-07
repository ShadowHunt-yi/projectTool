import { rm } from 'fs/promises'
import { join } from 'path'
import { analyzeProject } from '../analyzer'
import { getInstallCommand, getCleanCacheCommand } from '../analyzer/package-manager'
import { execute } from '../runner/executor'
import { log, info, success, warn, newline, CliError } from '../utils/log'
import { resolvePmRuntime } from '../utils/pm-availability'
import { directoryExists } from '../utils/fs'

const CLEAN_TARGETS = [
  'node_modules',
  'dist',
  'out',
  '.cache',
  '.parcel-cache',
  'coverage',
  '.eslintcache',
  '.turbo',
  '.vite',
]

interface CleanOptions {
  cache?: boolean
  reinstall?: boolean
}

export async function cleanCommand(projectDir: string, options: CleanOptions = {}) {
  const { cache = false, reinstall = false } = options

  const project = await analyzeProject(projectDir)
  if (project.type === 'unknown') {
    throw new CliError('未检测到项目类型。请确保当前目录包含 package.json')
  }

  info('正在清理项目...')

  let cleaned = 0
  for (const target of CLEAN_TARGETS) {
    const targetPath = join(projectDir, target)
    if (await directoryExists(targetPath)) {
      log(`删除 ${target}/`)
      await rm(targetPath, { recursive: true, force: true })
      cleaned++
    }
  }

  if (cleaned === 0) {
    info('没有需要清理的目录')
  } else {
    success(`已清理 ${cleaned} 个目录`)
  }

  if (cache) {
    newline()
    info('清理包管理器缓存...')
    const resolvedPm = await resolvePmRuntime(projectDir, project.packageManager)
    const cacheCmd = getCleanCacheCommand(resolvedPm)
    const exitCode = await execute(cacheCmd, { cwd: projectDir, env: resolvedPm.env })
    if (exitCode !== 0) {
      warn('缓存清理失败,继续执行')
    }
  }

  if (reinstall) {
    newline()
    info('重新安装依赖...')
    const resolvedPm = await resolvePmRuntime(projectDir, project.packageManager)
    const installCmd = getInstallCommand(resolvedPm)
    const exitCode = await execute(installCmd, { cwd: projectDir, env: resolvedPm.env })
    if (exitCode !== 0) {
      throw new CliError('依赖安装失败', exitCode)
    }
    success('依赖安装完成')
  }

  newline()
  success('清理完成')
}
