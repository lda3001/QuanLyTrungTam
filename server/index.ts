import cors from 'cors'
import express from 'express'
import session from 'express-session'
import { resolve } from 'node:path'
import { initDatabase } from '../src/main/database/connection'
import { closeDatabase } from '../src/main/database/connection'
import { apiRouter } from './routes'

const app = express()
const port = Number(process.env['PORT'] ?? 3001)

app.use(cors({ origin: process.env['CLIENT_ORIGIN'] ?? 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '10mb' }))
app.use(
  session({
    secret: process.env['SESSION_SECRET'] ?? 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    // `auto` keeps cookies usable on local HTTP while marking them Secure when
    // the application is served through HTTPS (including a trusted proxy).
    cookie: { httpOnly: true, sameSite: 'lax', secure: 'auto', maxAge: 8 * 60 * 60 * 1000 }
  })
)

initDatabase()
app.use('/api', apiRouter)

if (process.env['NODE_ENV'] === 'production') {
  app.use(express.static(resolve('dist-web')))
  // Express 5 requires a named wildcard. This includes `/`, unlike `/*splat`.
  app.get('/{*splat}', (_req, res) => res.sendFile(resolve('dist-web', 'index.html')))
}

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled error:', err)
  res.status(500).json({ ok: false, error: { code: 'UNKNOWN', message: 'Đã xảy ra lỗi hệ thống.' } })
})

const server = app.listen(port, () => console.info(`[server] http://localhost:${port}`))

// Keep the HTTP listener referenced. This is normally Node's default, but
// explicitly retaining it prevents the development server from ending while
// Vite is still proxying API requests.
server.ref()
server.on('close', () => console.info('[server] ÄÃ£ dá»«ng.'))
server.on('error', (error) => {
  console.error('[server] KhÃ´ng thá»ƒ khá»Ÿi Ä‘á»™ng:', error)
  process.exitCode = 1
})

function shutdown(): void { server.close(() => closeDatabase()) }
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
