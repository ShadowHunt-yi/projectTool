export interface ScriptsInfo {
  scripts: Record<string, string>
  // 识别出的主要命令（dev, test, build, start）
  detected: {
    dev?: string      // 开发启动脚本名
    test?: string     // 测试脚本名
    build?: string    // 构建脚本名
    start?: string    // 生产启动脚本名
  }
}

// 开发命令的常见名称（按优先级排序）
const DEV_PATTERNS = ['dev', 'serve', 'start:dev', 'develop', 'watch']

// 测试命令的常见名称
const TEST_PATTERNS = ['test', 'test:unit', 'test:all', 'spec']

// 构建命令的常见名称
const BUILD_PATTERNS = ['build', 'compile', 'bundle', 'dist']

// 生产启动命令的常见名称
const START_PATTERNS = ['start', 'serve', 'preview', 'production']

/**
 * 读取并分析 package.json 的 scripts 字段
 */
export async function analyzeScripts(projectDir: string): Promise<ScriptsInfo | null> {
  const packageJsonPath = `${projectDir}/package.json`

  try {
    const file = Bun.file(packageJsonPath)
    if (!await file.exists()) {
      return null
    }

    const packageJson = await file.json()
    const scripts = packageJson.scripts || {}

    // 智能识别主要命令
    const detected = {
      dev: findMatchingScript(scripts, DEV_PATTERNS),
      test: findMatchingScript(scripts, TEST_PATTERNS),
      build: findMatchingScript(scripts, BUILD_PATTERNS),
      start: findMatchingScript(scripts, START_PATTERNS),
    }

    return { scripts, detected }
  } catch {
    return null
  }
}

/**
 * 从 scripts 中找到匹配的脚本名
 * @param scripts package.json 的 scripts 对象
 * @param patterns 要匹配的模式列表（按优先级排序）
 */
function findMatchingScript(scripts: Record<string, string>, patterns: string[]): string | undefined {
  const scriptNames = Object.keys(scripts)

  // 按优先级检查每个模式
  for (const pattern of patterns) {
    // 精确匹配
    if (scripts[pattern]) {
      return pattern
    }
    // 模糊匹配（包含模式的脚本名）
    const fuzzyMatch = scriptNames.find(name =>
      name.toLowerCase().includes(pattern.toLowerCase())
    )
    if (fuzzyMatch) {
      return fuzzyMatch
    }
  }

  return undefined
}

/**
 * 获取所有可用的脚本列表
 */
export function getAvailableScripts(scriptsInfo: ScriptsInfo): string[] {
  return Object.keys(scriptsInfo.scripts)
}

/**
 * 检查脚本是否存在
 */
export function hasScript(scriptsInfo: ScriptsInfo, scriptName: string): boolean {
  return scriptName in scriptsInfo.scripts
}

/**
 * 获取脚本的实际命令内容
 */
export function getScriptCommand(scriptsInfo: ScriptsInfo, scriptName: string): string | undefined {
  return scriptsInfo.scripts[scriptName]
}
