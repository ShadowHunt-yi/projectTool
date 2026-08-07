import { executeCapture } from '../runner/executor'
import { info, success, warn, error, newline, colors, CliError } from '../utils/log'

const PACKAGE_NAME = 'project-runner'

export async function upgradeCommand() {
  info('正在检查 ' + PACKAGE_NAME + ' 版本...')

  let latestVersion: string | null = null

  try {
    const result = await executeCapture(['npm', 'view', PACKAGE_NAME, 'version'], { timeout: 15_000 })
    if (result.exitCode === 0) {
      latestVersion = result.stdout.trim()
    }
  } catch {
    // network or spawn error
  }

  if (!latestVersion) {
    throw new CliError('无法获取最新版本信息,请检查网络后重试')
  }

  const currentVersion = getCurrentVersion()
  const isLatest = currentVersion === latestVersion

  console.log()
  console.log(`  ${colors.bold}当前版本:${colors.reset} ${currentVersion}`)
  console.log(`  ${colors.bold}最新版本:${colors.reset} ${latestVersion}`)

  if (isLatest) {
    console.log()
    success(`已是最新版本 (${currentVersion})`)
    return
  }

  console.log()
  info(`正在升级 ${PACKAGE_NAME} 到 ${latestVersion}...`)
  newline()

  try {
    const result = await executeCapture(['npm', 'install', '-g', `${PACKAGE_NAME}@${latestVersion}`], { timeout: 60_000 })
    if (result.exitCode !== 0) {
      error('升级失败')
      if (result.stderr.trim()) {
        console.error(result.stderr.trim())
      }
      throw new CliError('自动升级失败,请手动运行: npm install -g ' + PACKAGE_NAME + '@latest')
    }
  } catch (err) {
    if (err instanceof CliError) throw err
    throw new CliError('自动升级失败,请手动运行: npm install -g ' + PACKAGE_NAME + '@latest')
  }

  console.log()
  success(`已升级到 ${latestVersion}`)
  console.log()
  console.log(`  ${colors.dim}请重新打开终端使新版本生效${colors.reset}`)
}

function getCurrentVersion(): string {
  try {
    const pkg = require('../../../package.json')
    return pkg.version || 'unknown'
  } catch {
    return 'unknown'
  }
}
