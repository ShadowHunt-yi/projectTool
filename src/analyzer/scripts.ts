export type StandardScriptType = 'dev' | 'test' | 'build' | 'start'

export interface ScriptsInfo {
  scripts: Record<string, string>
  detected: {
    dev?: string
    test?: string
    build?: string
    start?: string
  }
  mpa: {
    isMpa: boolean
    entries: string[]
    defaultEntry?: string
    source: 'local-config' | 'package-json' | 'scripts' | 'none'
    scriptsByType: Partial<Record<StandardScriptType, Record<string, string>>>
  }
}

const DEV_PATTERNS = ['dev', 'serve', 'start:dev', 'develop', 'watch']
const TEST_PATTERNS = ['test', 'test:unit', 'test:all', 'spec']
const BUILD_PATTERNS = ['build', 'compile', 'bundle', 'dist']
const START_PATTERNS = ['start', 'preview', 'production']
const STANDARD_TYPES: StandardScriptType[] = ['dev', 'test', 'build', 'start']

export function analyzeScripts(packageJson?: any, localConfig?: { entries?: string[]; defaultEntry?: string } | null): ScriptsInfo | null {
  if (!packageJson) {
    return null
  }

  try {
    const scripts = packageJson.scripts || {}
    const detected = {
      dev: findMatchingScript(scripts, DEV_PATTERNS),
      test: findMatchingScript(scripts, TEST_PATTERNS),
      build: findMatchingScript(scripts, BUILD_PATTERNS),
      start: findMatchingScript(scripts, START_PATTERNS),
    }

    const mpa = analyzeMpa(packageJson, scripts, localConfig)
    return { scripts, detected, mpa }
  } catch {
    return null
  }
}

function analyzeMpa(
  packageJson: any,
  scripts: Record<string, string>,
  localConfig?: { entries?: string[]; defaultEntry?: string } | null
): ScriptsInfo['mpa'] {
  const configuredEntriesFromLocal = normalizeEntryList(localConfig?.entries)
  const configuredEntriesFromPackage = normalizeEntryList(packageJson?.pr?.entries)
  const configuredEntries = configuredEntriesFromLocal.length > 0 ? configuredEntriesFromLocal : configuredEntriesFromPackage
  const scriptEntries = collectEntriesByPrefix(scripts, 'dev')

  let entries = configuredEntries.length > 0 ? configuredEntries : scriptEntries
  let source: ScriptsInfo['mpa']['source'] = 'scripts'
  if (configuredEntriesFromLocal.length > 0) {
    source = 'local-config'
  } else if (configuredEntriesFromPackage.length > 0) {
    source = 'package-json'
  }

  const defaultEntry = normalizeEntryName(localConfig?.defaultEntry ?? packageJson?.pr?.defaultEntry)
  if (defaultEntry && !entries.includes(defaultEntry) && scripts[`dev:${defaultEntry}`]) {
    entries = [...entries, defaultEntry]
  }

  entries = dedupe(entries)
  if (entries.length === 0) {
    source = 'none'
  }

  const scriptsByType: ScriptsInfo['mpa']['scriptsByType'] = {}
  for (const type of STANDARD_TYPES) {
    const mapping: Record<string, string> = {}
    for (const entry of entries) {
      const scriptName = `${type}:${entry}`
      if (scripts[scriptName]) {
        mapping[entry] = scriptName
      }
    }
    if (Object.keys(mapping).length > 0) {
      scriptsByType[type] = mapping
    }
  }

  return {
    isMpa: entries.length > 0,
    entries,
    defaultEntry: defaultEntry && entries.includes(defaultEntry) ? defaultEntry : undefined,
    source,
    scriptsByType,
  }
}

function normalizeEntryList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return dedupe(value.map(normalizeEntryName).filter((item): item is string => Boolean(item)))
}

function normalizeEntryName(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function collectEntriesByPrefix(scripts: Record<string, string>, prefix: StandardScriptType): string[] {
  const prefixWithColon = `${prefix}:`
  const entries: string[] = []

  for (const name of Object.keys(scripts)) {
    if (!name.startsWith(prefixWithColon)) {
      continue
    }
    const entry = name.slice(prefixWithColon.length).trim()
    if (!entry) {
      continue
    }
    entries.push(entry)
  }

  return dedupe(entries)
}

function findMatchingScript(scripts: Record<string, string>, patterns: string[]): string | undefined {
  const scriptNames = Object.keys(scripts)

  for (const pattern of patterns) {
    if (scripts[pattern]) {
      return pattern
    }
  }

  for (const pattern of patterns) {
    const fuzzyMatch = scriptNames.find((name) => {
      if (!name.toLowerCase().includes(pattern.toLowerCase())) {
        return false
      }
      const scriptContent = scripts[name]
      if (!scriptContent) {
        return false
      }
      const content = scriptContent.toLowerCase()
      if (
        content.includes('npm i') ||
        content.includes('npm install') ||
        content.includes('yarn install') ||
        content.includes('pnpm install') ||
        content.includes('bun install')
      ) {
        return false
      }
      return true
    })

    if (fuzzyMatch) {
      return fuzzyMatch
    }
  }

  return undefined
}

function dedupe(items: string[]): string[] {
  return [...new Set(items)]
}

export function getAvailableScripts(scriptsInfo: ScriptsInfo): string[] {
  return Object.keys(scriptsInfo.scripts)
}

export function hasScript(scriptsInfo: ScriptsInfo, scriptName: string): boolean {
  return scriptName in scriptsInfo.scripts
}

export function getScriptCommand(scriptsInfo: ScriptsInfo, scriptName: string): string | undefined {
  return scriptsInfo.scripts[scriptName]
}
