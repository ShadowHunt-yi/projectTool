import * as esbuild from 'esbuild'
import { readFile } from 'fs/promises'

async function build() {
  console.log('Building project-runner...')

  const pkg = JSON.parse(await readFile('package.json', 'utf-8'))

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
    define: {
      __VERSION__: JSON.stringify(pkg.version),
    },
    external: [],
  })

  console.log('Build complete! Output: dist/index.js')
}

build().catch((err) => {
  console.error('Build failed:', err)
  process.exit(1)
})
