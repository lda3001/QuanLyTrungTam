import { join } from 'node:path'
import { BrowserWindow, app, session, shell } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { closeDatabase, initDatabase } from './database/connection'
import { registerAllIpcHandlers } from './ipc'
import { initializeAutoUpdater } from './services/auto-update.service'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    show: false, // hiện sau khi render xong để tránh nháy trắng
    autoHideMenuBar: true,
    backgroundColor: '#f5f7fb',
    title: 'Quản Lý Trung Tâm',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),

      /* ---- Bộ ba cấu hình bảo mật bắt buộc ---- */
      contextIsolation: true, // renderer và preload chạy ở context tách biệt
      nodeIntegration: false, // renderer KHÔNG chạm được Node API
      sandbox: false, // preload cần require('electron'); vẫn an toàn nhờ contextIsolation
      webSecurity: true,
      allowRunningInsecureContent: false,

      spellcheck: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('[renderer] Không tải được trang:', { code, description, url })
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[renderer] Renderer process đã dừng:', details)
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const log = level >= 2 ? console.error : console.log
    log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })

  // Mọi liên kết ra ngoài mở bằng trình duyệt hệ thống, không mở cửa sổ Electron mới
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // Chặn điều hướng khỏi ứng dụng — phòng trường hợp một liên kết lạ lọt vào UI
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    const allowed = devUrl ? url.startsWith(devUrl) : url.startsWith('file://')
    if (!allowed) {
      event.preventDefault()
      if (url.startsWith('http')) void shell.openExternal(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * Content-Security-Policy đặt ở tầng HTTP header — mạnh hơn thẻ <meta> vì
 * áp dụng cho cả tài nguyên nạp trước khi HTML được phân tích.
 *
 * 'unsafe-inline' cho style là bắt buộc: Ant Design sinh CSS-in-JS lúc chạy.
 * Script thì tuyệt đối không nới lỏng.
 */
function applyContentSecurityPolicy(): void {
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const connectSrc = is.dev && devUrl ? `'self' ${devUrl} ws://localhost:*` : `'self'`

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            `default-src 'self'`,
            // Vite's React Fast Refresh injects an inline preamble in dev.
            // Production remains strict and does not allow inline scripts.
            `script-src 'self'${is.dev ? " 'unsafe-eval' 'unsafe-inline'" : ''}`,
            `style-src 'self' 'unsafe-inline'`,
            `img-src 'self' data: blob:`,
            `font-src 'self' data:`,
            `connect-src ${connectSrc}`,
            `object-src 'none'`,
            `base-uri 'self'`,
            `form-action 'none'`
          ].join('; ')
        ]
      }
    })
  })

  // Từ chối mọi yêu cầu quyền hệ thống (camera, vị trí...) — app này không cần
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
}

// Chỉ cho phép một phiên bản ứng dụng chạy: hai tiến trình cùng mở một file
// SQLite là công thức gây khoá database và lệch dữ liệu.
const gotLock = app.requestSingleInstanceLock()

if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  void app.whenReady().then(() => {
    electronApp.setAppUserModelId('vn.center.quanlytrungtam')

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    applyContentSecurityPolicy()

    try {
      initDatabase()
      registerAllIpcHandlers()
    } catch (err) {
      console.error('[app] Không khởi tạo được database:', err)
      // Vẫn mở cửa sổ để người dùng thấy thông báo lỗi thay vì app im lặng chết
    }

    createWindow()
    initializeAutoUpdater()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Đóng kết nối SQLite sạch sẽ trước khi thoát, tránh để lại file -wal mồ côi
app.on('before-quit', () => {
  closeDatabase()
})
