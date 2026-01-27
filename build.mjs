import * as esbuild from 'esbuild'
import { readdir, mkdir, copyFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function build() {
  console.log('Building project-runner...')

  // Bundle all TypeScript files into a single JavaScript file
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'dist/index.js',
    banner: {
      js: '#!/usr/bin/env node',
    },
    external: [],
  })

  console.log('Build complete! Output: dist/index.js')
}

build().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
