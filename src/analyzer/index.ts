import { detectPackageManager, type PackageManagerInfo } from './package-manager'
import { analyzeScripts, type ScriptsInfo } from './scripts'
import { checkDependencyStatus, type DependencyStatus } from './dependencies'

export interface ProjectInfo {
  type: 'nodejs' | 'python' | 'unknown'
  packageManager: PackageManagerInfo
  scripts: ScriptsInfo | null
  dependencies: DependencyStatus
  name?: string
  version?: string
  description?: string
}

/**
 * 分析项目，获取完整的项目信息
 */
export async function analyzeProject(projectDir: string): Promise<ProjectInfo> {
  // 检测项目类型（目前仅支持 Node.js）
  const packageJsonPath = `${projectDir}/package.json`
  const hasPackageJson = await Bun.file(packageJsonPath).exists()

  if (!hasPackageJson) {
    return {
      type: 'unknown',
      packageManager: { name: 'npm', source: 'default' },
      scripts: null,
      dependencies: { hasNodeModules: false, needsInstall: false },
    }
  }

  // 读取 package.json 基本信息
  const packageJson = await Bun.file(packageJsonPath).json().catch(() => ({}))

  // 并行执行检测
  const [packageManager, scripts, dependencies] = await Promise.all([
    detectPackageManager(projectDir),
    analyzeScripts(projectDir),
    checkDependencyStatus(projectDir),
  ])

  return {
    type: 'nodejs',
    packageManager,
    scripts,
    dependencies,
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
  }
}

// 导出子模块
export { detectPackageManager, type PackageManagerInfo } from './package-manager'
export { analyzeScripts, type ScriptsInfo, getAvailableScripts, hasScript } from './scripts'
export { checkDependencyStatus, type DependencyStatus } from './dependencies'
