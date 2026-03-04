import { appendFile, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { fileExists } from '../utils/fs'

export const LOCAL_CONFIG_FILENAME = '.pr.local.json'

export interface PrLocalConfig {
  entries?: string[]
  defaultEntry?: string
}

export async function loadPrLocalConfig(projectDir: string): Promise<PrLocalConfig | null> {
  const configPath = join(projectDir, LOCAL_CONFIG_FILENAME)
  if (!(await fileExists(configPath))) {
    return null
  }

  let parsed: any
  try {
    const content = await readFile(configPath, 'utf-8')
    parsed = JSON.parse(content.replace(/^\uFEFF/, ''))
  } catch {
    return null
  }

  await ensureLocalConfigGitignored(projectDir)

  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const config: PrLocalConfig = {}
  if (Array.isArray(parsed.entries)) {
    config.entries = parsed.entries
      .filter((item: unknown): item is string => typeof item === 'string')
      .map((item: string) => item.trim())
      .filter((item: string) => item.length > 0)
  }
  if (typeof parsed.defaultEntry === 'string' && parsed.defaultEntry.trim()) {
    config.defaultEntry = parsed.defaultEntry.trim()
  }

  return config
}

async function ensureLocalConfigGitignored(projectDir: string): Promise<void> {
  const gitignorePath = join(projectDir, '.gitignore')
  const ignoreEntry = LOCAL_CONFIG_FILENAME

  if (!(await fileExists(gitignorePath))) {
    await writeFile(gitignorePath, `${ignoreEntry}\n`, 'utf-8')
    return
  }

  const content = await readFile(gitignorePath, 'utf-8')
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.includes(ignoreEntry) || lines.includes(`/${ignoreEntry}`)) {
    return
  }

  const suffix = content.endsWith('\n') || content.length === 0 ? '' : '\n'
  await appendFile(gitignorePath, `${suffix}${ignoreEntry}\n`, 'utf-8')
}
