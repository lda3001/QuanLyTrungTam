import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { ProgressInfo, UpdateInfo } from 'electron-updater'
import { IPC } from '@shared/ipc/channels'
import type { UpdateStatus } from '@shared/types/update'

let initialized = false
let checking: Promise<UpdateStatus> | null = null
let downloading: Promise<UpdateStatus> | null = null
let installRequested = false

let status: UpdateStatus = {
  stage: 'idle',
  currentVersion: app.getVersion()
}

function publish(next: UpdateStatus): UpdateStatus {
  status = next
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(IPC.APP_UPDATE_STATUS, status)
  }
  return status
}

function base(stage: UpdateStatus['stage']): UpdateStatus {
  return {
    stage,
    currentVersion: app.getVersion(),
    availableVersion: status.availableVersion
  }
}

function onUpdateAvailable(info: UpdateInfo): void {
  publish({
    ...base('available'),
    availableVersion: info.version,
    message: `Phiên bản ${info.version} đã sẵn sàng.`
  })
}

function onDownloadProgress(progress: ProgressInfo): void {
  publish({
    ...base('downloading'),
    percent: Math.max(0, Math.min(100, progress.percent)),
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond
  })
}

/**
 * Khởi tạo updater một lần. Việc kiểm tra chỉ bắt đầu khi màn hình khởi động
 * gọi checkForUpdates, nhờ vậy login không xuất hiện trước kết quả kiểm tra.
 */
export function initializeAutoUpdater(): void {
  if (initialized) return
  initialized = true

  if (!app.isPackaged) {
    publish({
      ...base('disabled'),
      message: 'Chế độ phát triển không sử dụng trình cập nhật tự động.'
    })
    return
  }

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.autoRunAppAfterInstall = true

  autoUpdater.on('checking-for-update', () => {
    publish({ ...base('checking'), message: 'Đang kết nối máy chủ cập nhật…' })
  })

  autoUpdater.on('update-available', onUpdateAvailable)

  autoUpdater.on('update-not-available', () => {
    publish({
      ...base('not-available'),
      availableVersion: undefined,
      message: 'Bạn đang sử dụng phiên bản mới nhất.'
    })
  })

  autoUpdater.on('download-progress', onDownloadProgress)

  autoUpdater.on('update-downloaded', (info) => {
    publish({
      ...base('downloaded'),
      availableVersion: info.version,
      percent: 100,
      message: 'Bản cập nhật đã tải xong và sẵn sàng cài đặt.'
    })
  })

  autoUpdater.on('error', (error) => {
    const errorContext = status.stage === 'downloading' ? 'download' : 'check'
    console.error('[updater] Kiểm tra/cập nhật thất bại:', error)
    publish({
      ...base('error'),
      errorContext,
      message: error.message || 'Không thể kết nối đến máy chủ cập nhật.'
    })
  })
}

export function getUpdateStatus(): UpdateStatus {
  return status
}

export function checkForUpdates(): Promise<UpdateStatus> {
  initializeAutoUpdater()
  if (!app.isPackaged) return Promise.resolve(status)
  if (checking) return checking

  publish({ ...base('checking'), message: 'Đang kiểm tra phiên bản mới…' })
  checking = autoUpdater
    .checkForUpdates()
    .then(() => status)
    .catch((error: Error) => {
      if (status.stage !== 'error') {
        publish({
          ...base('error'),
          errorContext: 'check',
          message: error.message || 'Không thể kiểm tra bản cập nhật.'
        })
      }
      return status
    })
    .finally(() => {
      checking = null
    })

  return checking
}

export function downloadUpdate(): Promise<UpdateStatus> {
  initializeAutoUpdater()
  if (status.stage === 'downloaded') return Promise.resolve(status)
  if (!app.isPackaged) return Promise.resolve(status)
  if (downloading) return downloading
  if (status.stage !== 'available' && !(status.stage === 'error' && status.availableVersion)) {
    return Promise.reject(new Error('Chưa có bản cập nhật nào để tải xuống.'))
  }

  publish({ ...base('downloading'), percent: 0, message: 'Đang bắt đầu tải bản cập nhật…' })
  downloading = autoUpdater
    .downloadUpdate()
    .then(() => status)
    .catch((error: Error) => {
      if (status.stage !== 'error') {
        publish({
          ...base('error'),
          errorContext: 'download',
          message: error.message || 'Không thể tải bản cập nhật.'
        })
      }
      return status
    })
    .finally(() => {
      downloading = null
    })

  return downloading
}

export function installUpdate(): boolean {
  if (status.stage !== 'downloaded' || installRequested) return false
  installRequested = true
  publish({
    ...base('installing'),
    percent: 100,
    message: 'Ứng dụng đang khởi động lại để cài đặt bản cập nhật…'
  })

  // Cho renderer đủ thời gian vẽ trạng thái cuối trước khi đóng các cửa sổ.
  setTimeout(() => autoUpdater.quitAndInstall(false, true), 600)
  return true
}
