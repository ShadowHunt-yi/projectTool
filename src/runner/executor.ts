import { spawn, ChildProcess } from 'child_process'
import { constants as osConstants } from 'os'
import { execLog, CliError } from '../utils/log'

let currentProcess: ChildProcess | null = null

const DEFAULT_CAPTURE_TIMEOUT_MS = 10_000

function signalToExitCode(signal: NodeJS.Signals): number {
  const num = osConstants.signals[signal as string]
  return typeof num === 'number' ? 128 + num : 1
}

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
    onStdout?: (line: string) => void
  } = {}
): Promise<number> {
  const { cwd = process.cwd(), env, silent = false, onStdout } = options

  if (!silent) {
    execLog(cmd.join(' '))
  }

  return new Promise((resolve, reject) => {
    // 在 Windows 上需要使用 shell 来执行命令
    const isWindows = process.platform === 'win32'
    const command = cmd[0] || ''
    const args = cmd.slice(1)

    // 启动子进程
    const usePipe = !!onStdout
    currentProcess = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: usePipe ? ['pipe', 'pipe', 'inherit'] : 'inherit',
      shell: isWindows,
    })

    const proc = currentProcess

    if (usePipe && proc.stdout) {
      let buffer = ''
      proc.stdout.on('data', (data: Buffer) => {
        buffer += data.toString()
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        for (const line of lines) {
          onStdout!(line)
        }
      })
    }

    proc.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      currentProcess = null
      if (signal) {
        resolve(signalToExitCode(signal))
      } else {
        resolve(code ?? 0)
      }
    })

    proc.on('error', (err: NodeJS.ErrnoException) => {
      currentProcess = null
      if (err.code === 'ENOENT') {
        reject(new CliError(`命令 "${command}" 不存在,请确认是否已安装`))
      } else {
        reject(err)
      }
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
    timeout?: number
  } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { cwd = process.cwd(), env, timeout = DEFAULT_CAPTURE_TIMEOUT_MS } = options

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
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGKILL')
    }, timeout)

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    proc.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
      clearTimeout(timer)
      if (timedOut) {
        resolve({ stdout, stderr, exitCode: 124 })
      } else if (signal) {
        resolve({ stdout, stderr, exitCode: signalToExitCode(signal) })
      } else {
        resolve({ stdout, stderr, exitCode: code ?? 0 })
      }
    })

    proc.on('error', (err: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      if (err.code === 'ENOENT') {
        resolve({ stdout, stderr, exitCode: 127 })
      } else {
        reject(err)
      }
    })
  })
}

/**
 * 设置信号处理器
 */
export function setupSignalHandlers() {
  process.on('SIGINT', () => {
    if (currentProcess) {
      // With stdio: 'inherit', the child already received SIGINT from the terminal.
      // Clear the reference so a second Ctrl+C forces immediate exit.
      currentProcess = null
    } else {
      process.exit(130)
    }
  })

  process.on('SIGTERM', () => {
    if (currentProcess) {
      currentProcess.kill('SIGTERM')
      currentProcess = null
    } else {
      process.exit(143)
    }
  })
}
