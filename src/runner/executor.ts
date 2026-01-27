import { spawn, ChildProcess } from 'child_process'
import { execLog } from '../utils/log'

let currentProcess: ChildProcess | null = null

/**
 * 执行命令
 * @param cmd 命令数组 ['npm', 'run', 'dev']
 * @param options 选项
 */
export async function execute(
  cmd: string[],
  options: {
    cwd?: string
    env?: Record<string, string>
    silent?: boolean
  } = {}
): Promise<number> {
  const { cwd = process.cwd(), env, silent = false } = options

  if (!silent) {
    execLog(cmd.join(' '))
  }

  return new Promise((resolve, reject) => {
    // 在 Windows 上需要使用 shell 来执行命令
    const isWindows = process.platform === 'win32'
    const command = cmd[0] || ''
    const args = cmd.slice(1)

    // 启动子进程
    currentProcess = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      shell: isWindows,
    })

    const proc = currentProcess

    proc.on('close', (code: number | null) => {
      currentProcess = null
      resolve(code ?? 0)
    })

    proc.on('error', (err: Error) => {
      currentProcess = null
      reject(err)
    })
  })
}

/**
 * 执行命令并返回输出
 */
export async function executeCapture(
  cmd: string[],
  options: {
    cwd?: string
    env?: Record<string, string>
  } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { cwd = process.cwd(), env } = options

  return new Promise((resolve, reject) => {
    const isWindows = process.platform === 'win32'
    const command = cmd[0] || ''
    const args = cmd.slice(1)

    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: isWindows,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code: number | null) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 })
    })

    proc.on('error', (err: Error) => {
      reject(err)
    })
  })
}

/**
 * 设置信号处理器
 */
export function setupSignalHandlers() {
  // Ctrl+C 处理
  process.on('SIGINT', () => {
    if (currentProcess) {
      currentProcess.kill()
    }
    process.exit(0)
  })

  // SIGTERM 处理
  process.on('SIGTERM', () => {
    if (currentProcess) {
      currentProcess.kill()
    }
    process.exit(0)
  })
}

/**
 * 获取当前运行的进程
 */
export function getCurrentProcess(): ChildProcess | null {
  return currentProcess
}
