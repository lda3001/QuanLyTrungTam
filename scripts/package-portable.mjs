import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'release', 'QuanLyTrungTam-local')
const required = ['dist-web', 'dist-server', 'node_modules']

for (const directory of required) {
  if (!existsSync(join(root, directory))) {
    throw new Error(`Thiếu ${directory}. Hãy chạy "npm.cmd run build" trước.`)
  }
}

// This exact directory is generated output and is safe to recreate.
await rm(output, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 })
await mkdir(join(output, 'runtime'), { recursive: true })

for (const directory of required) {
  await cp(join(root, directory), join(output, directory), { recursive: true, dereference: true })
}

await cp(process.execPath, join(output, 'runtime', 'node.exe'))

await writeFile(
  join(output, 'start-local.cmd'),
  `@echo off
setlocal
cd /d "%~dp0"
set "NODE_ENV=production"
set "DATABASE_DIR=%~dp0data"

if not exist "%DATABASE_DIR%" mkdir "%DATABASE_DIR%"

start "Quan Ly Trung Tam server" /b "%~dp0runtime\\node.exe" "%~dp0dist-server\\index.mjs"

timeout /t 2 /nobreak > nul
start "" http://localhost:3001

endlocal
`.replace(/\n/g, '\r\n'),
  'utf8'
)
await writeFile(join(output, 'README.txt'), 'QUAN LY TRUNG TAM - BAN CHAY LOCAL\\r\\n\\r\\n1. Nhan dup file start-local.cmd.\\r\\n2. Ung dung mo trong trinh duyet tai http://localhost:3001.\\r\\n3. Du lieu duoc luu trong thu muc data\\\\center.db. Hay sao luu thu muc data truoc khi cap nhat.\\r\\n\\r\\nKhong can cai Node.js, npm hay SQLite.\\r\\n', 'utf8')

const size = await directorySize(output)
console.info(`Đã tạo bản portable: ${relative(root, output)} (${(size / 1024 / 1024).toFixed(1)} MB)`)

async function directorySize(directory) {
  let total = 0
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    total += entry.isDirectory() ? await directorySize(path) : (await stat(path)).size
  }
  return total
}
