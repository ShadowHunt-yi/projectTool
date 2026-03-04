import { analyzeProject } from '../analyzer'
import { colors } from '../utils/log'
import { isPmAvailable } from '../utils/pm-availability'

export async function infoCommand(projectDir: string) {
  const project = await analyzeProject(projectDir)

  if (project.type === 'unknown') {
    console.log(`${colors.red}×${colors.reset} 未检测到项目类型`)
    console.log('  请确认当前目录包含 package.json')
    return
  }

  console.log()
  console.log(`${colors.cyan}${colors.bold}pr - 项目分析结果${colors.reset}`)
  console.log('─'.repeat(40))

  if (project.name) {
    console.log(`${colors.bold}项目名称:${colors.reset} ${project.name}`)
  }
  if (project.version) {
    console.log(`${colors.bold}版本:${colors.reset}     ${project.version}`)
  }
  if (project.description) {
    console.log(`${colors.bold}描述:${colors.reset}     ${project.description}`)
  }

  console.log(`${colors.bold}项目类型:${colors.reset} ${project.type}`)

  const pm = project.packageManager
  let pmInfo = pm.name
  if (pm.version) {
    pmInfo += `@${pm.version}`
  }
  pmInfo += ` ${colors.dim}(${pm.source})${colors.reset}`
  const pmAvailable = await isPmAvailable(pm.name)
  const pmStatus = pmAvailable
    ? `${colors.green}已安装${colors.reset}`
    : `${colors.red}未安装${colors.reset}`
  console.log(`${colors.bold}包管理器:${colors.reset} ${pmInfo} [${pmStatus}]`)

  const deps = project.dependencies
  const depsStatus = deps.needsInstall
    ? `${colors.yellow}需要安装${colors.reset} (${deps.reason})`
    : `${colors.green}已就绪${colors.reset}`
  console.log(`${colors.bold}依赖状态:${colors.reset} ${depsStatus}`)

  if (project.scripts) {
    const { mpa } = project.scripts
    if (mpa.isMpa) {
      const sourceLabel =
        mpa.source === 'local-config'
          ? '.pr.local.json'
          : mpa.source === 'package-json'
            ? 'package.json#pr'
            : 'scripts'
      console.log(`${colors.bold}MPA 模式:${colors.reset} 是 ${colors.dim}(${sourceLabel})${colors.reset}`)
      console.log(`${colors.bold}可选入口:${colors.reset} ${mpa.entries.join(', ')}`)
      if (mpa.defaultEntry) {
        console.log(`${colors.bold}默认入口:${colors.reset} ${mpa.defaultEntry}`)
      }
      if (project.localConfig) {
        console.log(`${colors.bold}本地配置:${colors.reset} .pr.local.json ${colors.dim}(自动加入 .gitignore)${colors.reset}`)
      }
    } else {
      console.log(`${colors.bold}MPA 模式:${colors.reset} 否`)
    }
  }

  console.log()

  if (project.scripts) {
    const { scripts, detected } = project.scripts
    console.log(`${colors.bold}识别的命令:${colors.reset}`)
    if (detected.dev) {
      console.log(`  ${colors.green}pr run${colors.reset}   → ${pm.name} ${detected.dev}`)
    }
    if (detected.test) {
      console.log(`  ${colors.green}pr test${colors.reset}  → ${pm.name} ${detected.test}`)
    }
    if (detected.build) {
      console.log(`  ${colors.green}pr build${colors.reset} → ${pm.name} ${detected.build}`)
    }
    if (detected.start) {
      console.log(`  ${colors.green}pr start${colors.reset} → ${pm.name} ${detected.start}`)
    }

    console.log()

    const allScripts = Object.keys(scripts)
    if (allScripts.length > 0) {
      console.log(`${colors.bold}所有脚本:${colors.reset}`)
      for (const name of allScripts) {
        const cmd = scripts[name]
        if (!cmd) {
          continue
        }
        const displayCmd = cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd
        console.log(`  ${colors.cyan}${name}${colors.reset} ${colors.dim}→ ${displayCmd}${colors.reset}`)
      }
    }
  }

  console.log()
}
