import { readFile } from 'fs/promises'
import { join } from 'path'
import { fileExists } from './fs'

export interface NodeVersionRequirement {
  source: 'engines' | 'nvmrc' | 'node-version' | 'volta'
  version: string
  raw?: string
}

/**
 * 检测项目要求的 Node 版本
 * 检查来源: .nvmrc, .node-version, package.json#engines.node, package.json#volta.node
 */
export async function detectNodeVersion(projectDir: string, packageJson?: any): Promise<NodeVersionRequirement | null> {
  // 1. .nvmrc
  const nvmrcPath = join(projectDir, '.nvmrc')
  if (await fileExists(nvmrcPath)) {
    try {
      const content = (await readFile(nvmrcPath, 'utf-8')).trim()
      if (content) {
        return { source: 'nvmrc', version: content, raw: content }
      }
    } catch {
      // ignore
    }
  }

  // 2. .node-version
  const nodeVersionPath = join(projectDir, '.node-version')
  if (await fileExists(nodeVersionPath)) {
    try {
      const content = (await readFile(nodeVersionPath, 'utf-8')).trim()
      if (content) {
        return { source: 'node-version', version: content, raw: content }
      }
    } catch {
      // ignore
    }
  }

  // 3. package.json#engines.node
  if (packageJson?.engines?.node) {
    return { source: 'engines', version: packageJson.engines.node, raw: packageJson.engines.node }
  }

  // 4. package.json#volta.node
  if (packageJson?.volta?.node) {
    return { source: 'volta', version: packageJson.volta.node, raw: packageJson.volta.node }
  }

  return null
}

/**
 * 获取当前运行的 Node 版本
 */
export function getCurrentNodeVersion(): string {
  return process.versions.node
}

interface SemverParts {
  major: number
  minor?: number
  patch?: number
}

function parseSemver(version: string): SemverParts | null {
  const match = version.trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/)
  if (!match) return null
  return {
    major: parseInt(match[1], 10),
    minor: match[2] ? parseInt(match[2], 10) : undefined,
    patch: match[3] ? parseInt(match[3], 10) : undefined,
  }
}

function compareSemver(a: SemverParts, b: SemverParts): number {
  if (a.major !== b.major) return a.major > b.major ? 1 : -1
  const aMinor = a.minor ?? 0
  const bMinor = b.minor ?? 0
  if (aMinor !== bMinor) return aMinor > bMinor ? 1 : -1
  const aPatch = a.patch ?? 0
  const bPatch = b.patch ?? 0
  if (aPatch !== bPatch) return aPatch > bPatch ? 1 : -1
  return 0
}

export function isNodeVersionSatisfied(current: string, required: string): boolean {
  const currentParts = parseSemver(current)
  if (!currentParts) return true

  const range = required.trim()

  const gteMatch = range.match(/^>=?\s*(\d+(?:\.\d+)?(?:\.\d+)?)/)
  if (gteMatch) {
    const req = parseSemver(gteMatch[1])
    if (!req) return true
    return compareSemver(currentParts, req) >= 0
  }

  const caretMatch = range.match(/^\^(\d+(?:\.\d+)?(?:\.\d+)?)/)
  if (caretMatch) {
    const req = parseSemver(caretMatch[1])
    if (!req) return true
    if (currentParts.major !== req.major) return false
    return compareSemver(currentParts, req) >= 0
  }

  const tildeMatch = range.match(/^~(\d+(?:\.\d+)?(?:\.\d+)?)/)
  if (tildeMatch) {
    const req = parseSemver(tildeMatch[1])
    if (!req) return true
    if (currentParts.major !== req.major) return false
    if (req.minor !== undefined && currentParts.minor !== undefined && currentParts.minor !== req.minor) return false
    return compareSemver(currentParts, req) >= 0
  }

  const exactMatch = range.match(/^(\d+(?:\.\d+)?(?:\.\d+)?)/)
  if (exactMatch) {
    const req = parseSemver(exactMatch[1])
    if (!req) return true
    return compareSemver(currentParts, req) === 0
  }

  return true
}
