// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
}

// 全局 verbose 状态
let isVerbose = false

export function setVerbose(verbose: boolean) {
  isVerbose = verbose
}

export function getVerbose(): boolean {
  return isVerbose
}

/**
 * 日志函数（仅在 verbose 模式下输出）
 */
export function log(message: string) {
  if (isVerbose) {
    console.log(`${colors.cyan}[pr]${colors.reset} ${message}`)
  }
}

/**
 * 信息日志（始终输出）
 */
export function info(message: string) {
  console.log(`${colors.cyan}[pr]${colors.reset} ${message}`)
}

/**
 * 成功日志
 */
export function success(message: string) {
  console.log(`${colors.green}✓${colors.reset} ${message}`)
}

/**
 * 警告日志
 */
export function warn(message: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`)
}

/**
 * 错误日志
 */
export function error(message: string) {
  console.error(`${colors.red}✗${colors.reset} ${message}`)
}

/**
 * 执行命令的日志
 */
export function execLog(command: string) {
  console.log(`${colors.dim}>${colors.reset} ${colors.bold}${command}${colors.reset}`)
}

/**
 * 输出空行
 */
export function newline() {
  console.log()
}

/**
 * 输出带颜色的文本
 */
export function colorize(text: string, color: keyof typeof colors): string {
  return `${colors[color]}${text}${colors.reset}`
}

export { colors }
