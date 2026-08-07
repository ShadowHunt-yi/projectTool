import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { fileExists, directoryExists } from '../utils/fs'
import { info, success, warn, error, colors, CliError } from '../utils/log'
import { executeCapture } from '../runner/executor'
import type { PackageManager } from '../analyzer/package-manager'

interface InitOptions {
  template?: string
  pm?: PackageManager
  name?: string
}

const TEMPLATES: Record<string, { description: string; packageJson: any; files: Record<string, string> }> = {
  vite: {
    description: 'Vite + TypeScript',
    packageJson: {
      name: 'my-app',
      version: '0.0.1',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
      },
      devDependencies: {
        vite: '^5.0.0',
        typescript: '^5.0.0',
      },
    },
    files: {
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}`,
      'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>My App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
      'src/main.ts': `console.log('Hello from Vite!')\n`,
    },
  },
  express: {
    description: 'Express server',
    packageJson: {
      name: 'my-server',
      version: '0.0.1',
      type: 'module',
      scripts: {
        dev: 'node --watch src/index.ts',
        start: 'node dist/index.js',
        build: 'tsc',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
      dependencies: {
        express: '^4.18.0',
      },
    },
    files: {
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src"]
}`,
      'src/index.ts': `import express from 'express'\nconst app = express()\napp.get('/', (req, res) => res.send('Hello!'))\napp.listen(3000, () => console.log('Server running on :3000'))\n`,
    },
  },
  cli: {
    description: 'Node CLI tool',
    packageJson: {
      name: 'my-cli',
      version: '0.0.1',
      type: 'module',
      bin: {
        'my-cli': 'dist/index.js',
      },
      scripts: {
        dev: 'node --watch src/index.ts',
        build: 'tsc',
        start: 'node dist/index.js',
      },
      devDependencies: {
        '@types/node': '^20.0.0',
        typescript: '^5.0.0',
      },
    },
    files: {
      'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src"]
}`,
      'src/index.ts': `#!/usr/bin/env node\nconsole.log('Hello from my-cli!')\n`,
    },
  },
  empty: {
    description: 'Empty project',
    packageJson: {
      name: 'my-project',
      version: '0.0.1',
      type: 'module',
      scripts: {
        dev: 'echo no dev script',
      },
    },
    files: {},
  },
}

export async function initCommand(projectDir: string, options: InitOptions = {}) {
  const { template = 'vite', pm = 'npm', name } = options

  const tpl = TEMPLATES[template]
  if (!tpl) {
    throw new CliError(`未知模板: ${template}。可用模板: ${Object.keys(TEMPLATES).join(', ')}`)
  }

  if (await fileExists(join(projectDir, 'package.json'))) {
    throw new CliError('当前目录已存在 package.json,无法初始化')
  }

  const projectName = name || projectDir.split('/').pop() || 'my-app'
  tpl.packageJson.name = projectName

  info(`模板: ${template} (${tpl.description})`)
  info(`包管理器: ${pm}`)
  info(`项目名: ${projectName}`)
  console.log()

  // 写入 package.json
  await writeFile(join(projectDir, 'package.json'), JSON.stringify(tpl.packageJson, null, 2) + '\n', 'utf-8')
  success('创建 package.json')

  // 写入模板文件
  for (const [filePath, content] of Object.entries(tpl.files)) {
    const fullPath = join(projectDir, filePath)
    const dir = join(fullPath, '..')
    if (!(await directoryExists(dir))) {
      await mkdir(dir, { recursive: true })
    }
    await writeFile(fullPath, content, 'utf-8')
    success(`创建 ${filePath}`)
  }

  // 安装依赖
  console.log()
  info('正在安装依赖...')
  const installCmd = getInstallCmdForPm(pm)
  const result = await executeCapture(installCmd, { cwd: projectDir, timeout: 120_000 })
  if (result.exitCode !== 0) {
    warn('依赖安装失败,请手动运行: ' + installCmd.join(' '))
  } else {
    success('依赖安装完成')
  }

  console.log()
  console.log(`  ${colors.green}✓${colors.reset} 项目已创建!`)
  console.log()
  console.log(`  ${colors.bold}下一步:${colors.reset}`)
  console.log(`    ${colors.cyan}pr run${colors.reset}  启动开发服务器`)
  console.log()
}

function getInstallCmdForPm(pm: PackageManager): string[] {
  switch (pm) {
    case 'bun':
      return ['bun', 'install']
    case 'pnpm':
      return ['pnpm', 'install']
    case 'yarn':
      return ['yarn', 'install']
    case 'npm':
    default:
      return ['npm', 'install']
  }
}

export function getTemplateNames(): string[] {
  return Object.keys(TEMPLATES)
}
