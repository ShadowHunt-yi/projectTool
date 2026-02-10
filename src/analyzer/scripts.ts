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
const START_PATTERNS = ['start', 'preview', 'production']

/**
 * 读取并分析 package.json 的 scripts 字段
 */
export function analyzeScripts(packageJson?: any): ScriptsInfo | null {
  if (!packageJson) {
    return null
  }

  try {
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

  // 第一轮：按优先级检查精确匹配
  for (const pattern of patterns) {
    if (scripts[pattern]) {
      return pattern
    }
  }

  // 第二轮：模糊匹配（包含模式的脚本名）
  // 排除包含 install 命令的组合脚本
  for (const pattern of patterns) {
    const fuzzyMatch = scriptNames.find(name => {
      if (!name.toLowerCase().includes(pattern.toLowerCase())) {
        return false
      }
      // 检查脚本内容是否包含 install 命令（组合脚本）
      const scriptContent = scripts[name].toLowerCase()
      if (scriptContent.includes('npm i') ||
          scriptContent.includes('npm install') ||
          scriptContent.includes('yarn install') ||
          scriptContent.includes('pnpm install') ||
          scriptContent.includes('bun install')) {
        return false
      }
      return true
    })
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
