import { spawn } from 'child_process'

/**
 * 打开浏览器到指定 URL
 */
export function openBrowser(url: string): void {
  let command: string
  let args: string[]

  switch (process.platform) {
    case 'darwin':
      command = 'open'
      args = [url]
      break
    case 'win32':
      command = 'rundll32'
      args = ['url.dll,FileProtocolHandler', url]
      break
    default:
      // Linux / others
      command = 'xdg-open'
      args = [url]
      break
  }

 try {
    const proc = spawn(command, args, { detached: true, stdio: 'ignore' })
    proc.unref()
  } catch {
    // Silently fail — browser opening is best-effort
  }
}

const URL_REGEX = /https?:\/\/localhost:(\d+)/

/**
 * 从输出行中提取本地开发服务器 URL
 */
export function extractDevServerUrl(line: string): string | null {
  const match = line.match(URL_REGEX)
  return match ? match[0] : null
}

/**
 * 从输出行中提取端口号
 */
export function extractDevServerPort(line: string): number | null {
  const match = line.match(URL_REGEX)
  return match ? parseInt(match[1], 10) : null
}
