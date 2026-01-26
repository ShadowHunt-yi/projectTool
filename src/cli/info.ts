import { analyzeProject } from '../analyzer'
import { colors } from '../utils/log'

/**
 * pr info 命令
 * 显示项目分析结果
 */
export async function infoCommand(projectDir: string) {
  const project = await analyzeProject(projectDir)

  if (project.type === 'unknown') {
    console.log(`${colors.red}✗${colors.reset} 未检测到项目类型`)
    console.log('  请确保当前目录包含 package.json 或其他项目配置文件')
    return
  }

  // 项目基本信息
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

  // 包管理器信息
  const pm = project.packageManager
  let pmInfo = pm.name
  if (pm.version) {
    pmInfo += `@${pm.version}`
  }
  pmInfo += ` ${colors.dim}(${pm.source})${colors.reset}`
  console.log(`${colors.bold}包管理器:${colors.reset} ${pmInfo}`)

  // 依赖状态
  const deps = project.dependencies
  const depsStatus = deps.needsInstall
    ? `${colors.yellow}需要安装${colors.reset} (${deps.reason})`
    : `${colors.green}已就绪${colors.reset}`
  console.log(`${colors.bold}依赖状态:${colors.reset} ${depsStatus}`)

  console.log()

  // Scripts 信息
  if (project.scripts) {
    const { scripts, detected } = project.scripts

    // 显示识别的主要命令
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

    // 显示所有可用脚本
    const allScripts = Object.keys(scripts)
    if (allScripts.length > 0) {
      console.log(`${colors.bold}所有脚本:${colors.reset}`)
      for (const name of allScripts) {
        const cmd = scripts[name]
        // 截断过长的命令
        const displayCmd = cmd.length > 40 ? cmd.slice(0, 40) + '...' : cmd
        console.log(`  ${colors.cyan}${name}${colors.reset} ${colors.dim}→ ${displayCmd}${colors.reset}`)
      }
    }
  }

  console.log()
}
