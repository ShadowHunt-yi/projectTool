import { readFile } from 'fs/promises'
import { join } from 'path'
import { analyzeProject } from '../analyzer'
import { getAuditCommand } from '../analyzer/package-manager'
import { execute, executeCapture } from '../runner/executor'
import { log, info, success, warn, error, newline, colors, CliError } from '../utils/log'
import { resolvePmRuntime } from '../utils/pm-availability'
import { detectNodeVersion, getCurrentNodeVersion, isNodeVersionSatisfied } from '../utils/node-version'
import { fileExists } from '../utils/fs'

interface CheckResult {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

export async function doctorCommand(projectDir: string) {
  const project = await analyzeProject(projectDir)

  if (project.type === 'unknown') {
    throw new CliError('未检测到项目类型。请确保当前目录包含 package.json')
  }

  console.log()
  console.log(`${colors.cyan}${colors.bold}pr - 项目诊断${colors.reset}`)
  console.log('─'.repeat(40))
  console.log()

  const results: CheckResult[] = []

  // 1. Node 版本检查
  results.push(await checkNodeVersion(projectDir, project))

  // 2. 包管理器一致性
  results.push(await checkPmConsistency(projectDir, project))

  // 3. 依赖状态
  results.push(checkDependencies(project))

  // 4. Lockfile 一致性
  results.push(await checkLockfileConsistency(projectDir, project))

  // 5. 安全审计
  results.push(await checkSecurityAudit(projectDir, project))

  // 输出结果
  for (const result of results) {
    const icon = result.status === 'pass' ? colors.green + '✓' : result.status === 'warn' ? colors.yellow + '⚠' : colors.red + '✗'
    const label = result.name.padEnd(20)
    console.log(`  ${icon}${colors.reset} ${colors.bold}${label}${colors.reset} ${result.message}`)
  }

  // 总结
  const fails = results.filter((r) => r.status === 'fail')
  const warns = results.filter((r) => r.status === 'warn')
  console.log()
  if (fails.length > 0) {
    error(`${fails.length} 项检查未通过`)
    process.exit(1)
  } else if (warns.length > 0) {
    warn(`${warns.length} 项检查需要注意`)
  } else {
    success('所有检查通过')
  }
}

async function checkNodeVersion(projectDir: string, project: any): Promise<CheckResult> {
  const packageJsonPath = join(projectDir, 'package.json')
  let packageJson: any = {}
  try {
    packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8'))
  } catch {
    // ignore
  }

  const required = await detectNodeVersion(projectDir, packageJson)
  if (!required) {
    return { name: 'Node 版本', status: 'pass', message: '未指定版本要求' }
  }

  const current = getCurrentNodeVersion()
  const satisfied = isNodeVersionSatisfied(current, required.version)

  if (satisfied) {
    return { name: 'Node 版本', status: 'pass', message: `当前 v${current} 满足 ${required.source} 要求 (${required.version})` }
  }
  return { name: 'Node 版本', status: 'fail', message: `当前 v${current} 不满足 ${required.source} 要求 (${required.version})` }
}

async function checkPmConsistency(projectDir: string, project: any): Promise<CheckResult> {
  const pm = project.packageManager
  const resolvedPm = await resolvePmRuntime(projectDir, pm)
  if (resolvedPm.name !== pm.name) {
    return { name: '包管理器', status: 'warn', message: `检测到 ${pm.name} 但实际使用 ${resolvedPm.name}` }
  }
  return { name: '包管理器', status: 'pass', message: `${pm.name} (${pm.source})` }
}

function checkDependencies(project: any): CheckResult {
  const deps = project.dependencies
  if (deps.needsInstall) {
    return { name: '依赖状态', status: 'warn', message: `${deps.reason || '需要安装依赖'}` }
  }
  return { name: '依赖状态', status: 'pass', message: '已就绪' }
}

async function checkLockfileConsistency(projectDir: string, project: any): Promise<CheckResult> {
  const lockfiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb']
  const found: string[] = []
  for (const lf of lockfiles) {
    if (await fileExists(join(projectDir, lf))) {
      found.push(lf)
    }
  }

  if (found.length === 0) {
    return { name: 'Lockfile', status: 'warn', message: '未找到 lockfile' }
  }
  if (found.length > 1) {
    return { name: 'Lockfile', status: 'fail', message: `检测到多个 lockfile: ${found.join(', ')}` }
  }
  return { name: 'Lockfile', status: 'pass', message: found[0] || '' }
}

async function checkSecurityAudit(projectDir: string, project: any): Promise<CheckResult> {
  const resolvedPm = await resolvePmRuntime(projectDir, project.packageManager)
  const auditCmd = getAuditCommand(resolvedPm)

  try {
    const result = await executeCapture(auditCmd, { cwd: projectDir, env: resolvedPm.env, timeout: 30_000 })
    if (result.exitCode === 0) {
      return { name: '安全审计', status: 'pass', message: '无已知漏洞' }
    }
    const vulnCount = result.stdout.match(/(\d+)\s+vulnerabilit/) || result.stdout.match(/vulnerabilit.*?(\d+)/i)
    if (vulnCount) {
      return { name: '安全审计', status: 'warn', message: `发现 ${vulnCount[1]} 个漏洞` }
    }
    return { name: '安全审计', status: 'warn', message: '发现安全问题,请查看详情' }
  } catch {
    return { name: '安全审计', status: 'warn', message: '无法执行审计' }
  }
}
