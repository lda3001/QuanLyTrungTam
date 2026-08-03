import { execFile } from 'node:child_process'
import { cp, mkdir, readFile, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const release = join(root, 'release', 'github-update')
const payload = join(release, 'payload')
const archive = join(release, 'quanlytrungtam-update.zip')
const npmCli = process.env['npm_execpath']
const shouldPublish = process.argv.includes('--publish')
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const tag = `v${packageJson.version}`
const repository = 'lda3001/QuanLyTrungTam'

if (!npmCli) throw new Error('Hãy chạy bằng npm.cmd run build:github-update.')
if (shouldPublish) await ensureGhAvailable()
await execFileAsync(process.execPath, [npmCli, 'run', 'build'], { cwd: root, maxBuffer: 20 * 1024 * 1024 })
await rm(release, { recursive: true, force: true })
await mkdir(payload, { recursive: true })
await cp(join(root, 'dist-web'), join(payload, 'dist-web'), { recursive: true })
await cp(join(root, 'dist-server'), join(payload, 'dist-server'), { recursive: true })
await execFileAsync('powershell.exe', [
  '-NoProfile', '-Command',
  `Compress-Archive -LiteralPath '${join(payload, 'dist-web').replaceAll("'", "''")}', '${join(payload, 'dist-server').replaceAll("'", "''")}' -DestinationPath '${archive.replaceAll("'", "''")}' -Force`
])
await rm(payload, { recursive: true, force: true })
console.info('Đã tạo release/github-update/quanlytrungtam-update.zip')

if (shouldPublish) {
  if (await releaseExists()) {
    console.info(`Release ${tag} đã tồn tại, đang cập nhật asset...`)
    await runGh(['release', 'upload', tag, archive, '--repo', repository, '--clobber'])
  } else {
    console.info(`Đang tạo GitHub Release ${tag}...`)
    await runGh(['release', 'create', tag, archive, '--repo', repository, '--title', tag, '--generate-notes'])
  }
  console.info(`Đã publish ${tag}: https://github.com/${repository}/releases/tag/${tag}`)
} else {
  console.info('Chạy npm.cmd run release:github để build và upload asset tự động.')
}

async function ensureGhAvailable() {
  try {
    await runGh(['auth', 'status'])
  } catch {
    throw new Error('Chưa đăng nhập GitHub CLI. Hãy cài gh và chạy: gh auth login')
  }
}

async function releaseExists() {
  try {
    await runGh(['release', 'view', tag, '--repo', repository])
    return true
  } catch {
    return false
  }
}

async function runGh(args) {
  const result = await execFileAsync('gh', args, { cwd: root, maxBuffer: 20 * 1024 * 1024 })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
}
