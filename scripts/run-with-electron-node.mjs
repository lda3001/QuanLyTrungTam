import { spawn } from 'node:child_process'
import electron from 'electron'

const entry = process.argv[2]

if (!entry) {
  console.error('Usage: node scripts/run-with-electron-node.mjs <entry-file>')
  process.exit(1)
}

// better-sqlite3 is compiled for Electron's Node ABI. Running the web server
// through Electron in Node mode lets the Electron app and Express share the
// same native binary instead of rebuilding it every time modes are switched.
const child = spawn(electron, [entry, ...process.argv.slice(3)], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.on('error', (error) => {
  console.error('[server] Không thể khởi động Electron Node runtime:', error)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1)
})
