import { spawn, type Subprocess } from 'bun'
import { execLog } from '../utils/log'

let currentProcess: Subprocess | null = null

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

  // 启动子进程
  currentProcess = spawn({
    cmd,
    cwd,
    env: { ...process.env, ...env },
    stdio: ['inherit', 'inherit', 'inherit'],
  })

  // 等待进程结束
  const exitCode = await currentProcess.exited
  currentProcess = null

  return exitCode
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

  const proc = spawn({
    cmd,
    cwd,
    env: { ...process.env, ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  return { stdout, stderr, exitCode }
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
export function getCurrentProcess(): Subprocess | null {
  return currentProcess
}
