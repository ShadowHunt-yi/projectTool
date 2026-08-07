import { readFile } from 'fs/promises'
import { join } from 'path'
import { analyzeProject } from '../analyzer'
import { openBrowser, extractDevServerUrl } from '../utils/open-browser'
import { info, warn, success, colors, CliError } from '../utils/log'
import { fileExists } from '../utils/fs'

export async function openCommand(projectDir: string) {
  const project = await analyzeProject(projectDir)
  if (project.type === 'unknown') {
    throw new CliError('未检测到项目类型。请确保当前目录包含 package.json')
  }

  if (!project.scripts) {
    throw new CliError('无法读取 package.json 的 scripts')
  }

  // 尝试从 vite.config / next.config 等获取端口
  const port = await guessDevPort(projectDir)

  if (port) {
    const url = `http://localhost:${port}`
    info(`正在打开 ${url} ...`)
    openBrowser(url)
    success(`已在浏览器中打开 ${url}`)
  } else {
    // 默认尝试常见端口
    const defaultUrl = 'http://localhost:5173'
    warn('无法确定开发服务器端口,尝试默认 ' + defaultUrl)
    openBrowser(defaultUrl)
    info(`已在浏览器中打开 ${defaultUrl}`)
  }
}

async function guessDevPort(projectDir: string): Promise<number | null> {
  // vite.config: server.port
  const viteConfigPath = join(projectDir, 'vite.config.ts')
  if (await fileExists(viteConfigPath)) {
    try {
      const content = await readFile(viteConfigPath, 'utf-8')
      const portMatch = content.match(/port:\s*(\d+)/)
      if (portMatch) {
        return parseInt(portMatch[1], 10)
      }
    } catch {
      // ignore
    }
  }

  // vite.config.js
  const viteJsPath = join(projectDir, 'vite.config.js')
  if (await fileExists(viteJsPath)) {
    try {
      const content = await readFile(viteJsPath, 'utf-8')
      const portMatch = content.match(/port:\s*(\d+)/)
      if (portMatch) {
        return parseInt(portMatch[1], 10)
      }
    } catch {
      // ignore
    }
  }

  // next.config: 检查是否有 dev 脚本含 next
  const packageJsonPath = join(projectDir, 'package.json')
  if (await fileExists(packageJsonPath)) {
    try {
      const pkg = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
      const devScript = pkg.scripts?.dev || ''
      if (devScript.includes('next')) {
        return 3000
      }
      if (devScript.includes('webpack')) {
        return 8080
      }
      if (devScript.includes('vite')) {
        return 5173
      }
      if (devScript.includes('astro')) {
        return 4321
      }
      if (devScript.includes('sveltekit')) {
        return 5173
      }
      if (devScript.includes('express') || devScript.includes('fastify') || devScript.includes('koa')) {
        // 尝试从源码提取
        const portMatch = devScript.match(/PORT.*?(\d{4})/)
        if (portMatch) {
          return parseInt(portMatch[1], 10)
        }
        return 3000
      }
    } catch {
      // ignore
    }
  }

  return null
}

/**
 * 监控 dev server 输出并自动打开浏览器
 */
export function createAutoOpenHandler(opened: { value: boolean }) {
  return (line: string) => {
    if (!opened.value) {
      const url = extractDevServerUrl(line)
      if (url) {
        opened.value = true
        openBrowser(url)
        success(`已在浏览器中打开 ${url}`)
      }
    }
  }
}
