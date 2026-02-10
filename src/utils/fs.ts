import { stat } from 'fs/promises'

/**
 * 检查文件是否存在
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path)
    return stats.isFile()
  } catch {
    return false
  }
}

/**
 * 检查目录是否存在
 */
export async function directoryExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path)
    return stats.isDirectory()
  } catch {
    return false
  }
}
