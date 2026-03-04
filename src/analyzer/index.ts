import { readFile } from 'fs/promises'
import { join } from 'path'
import { detectPackageManager, type PackageManagerInfo } from './package-manager'
import { analyzeScripts, type ScriptsInfo } from './scripts'
import { checkDependencyStatus, type DependencyStatus } from './dependencies'
import { loadPrLocalConfig, type PrLocalConfig } from './local-config'
import { fileExists } from '../utils/fs'

export interface ProjectInfo {
  type: 'nodejs' | 'python' | 'unknown'
  packageManager: PackageManagerInfo
  scripts: ScriptsInfo | null
  dependencies: DependencyStatus
  localConfig: PrLocalConfig | null
  name?: string
  version?: string
  description?: string
}

export async function analyzeProject(projectDir: string): Promise<ProjectInfo> {
  const packageJsonPath = join(projectDir, 'package.json')
  const hasPackageJson = await fileExists(packageJsonPath)

  if (!hasPackageJson) {
    return {
      type: 'unknown',
      packageManager: { name: 'npm', source: 'default' },
      scripts: null,
      dependencies: { hasNodeModules: false, needsInstall: false },
      localConfig: null,
    }
  }

  let packageJson: any = {}
  try {
    const content = await readFile(packageJsonPath, 'utf-8')
    packageJson = JSON.parse(content.replace(/^\uFEFF/, ''))
  } catch {
    // Keep default empty package info when package.json cannot be parsed.
  }

  const [packageManager, dependencies, localConfig] = await Promise.all([
    detectPackageManager(projectDir, packageJson),
    checkDependencyStatus(projectDir),
    loadPrLocalConfig(projectDir),
  ])

  const scripts = analyzeScripts(packageJson, localConfig)

  return {
    type: 'nodejs',
    packageManager,
    scripts,
    dependencies,
    localConfig,
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
  }
}

export { detectPackageManager, type PackageManagerInfo } from './package-manager'
export { analyzeScripts, type ScriptsInfo, getAvailableScripts, hasScript } from './scripts'
export { checkDependencyStatus, type DependencyStatus } from './dependencies'
