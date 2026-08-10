import { app, BrowserWindow, dialog, type MessageBoxOptions, type MessageBoxReturnValue } from 'electron'
import { autoUpdater } from 'electron-updater'

let initialized = false

function showMessage(
  parent: BrowserWindow | null,
  options: MessageBoxOptions
): Promise<MessageBoxReturnValue> {
  return parent ? dialog.showMessageBox(parent, options) : dialog.showMessageBox(options)
}

/**
 * Check GitHub Releases for a newer NSIS build.
 * Development builds are intentionally skipped because they do not contain
 * app-update.yml and cannot safely exercise the installer flow.
 */
export function initializeAutoUpdater(parent: () => BrowserWindow | null): void {
  if (initialized || !app.isPackaged) return
  initialized = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('error', (error) => {
    // Update failures must never prevent the centre-management app from opening.
    console.error('[updater] Kiểm tra/cập nhật thất bại:', error)
  })

  autoUpdater.on('update-available', async (info) => {
    const result = await showMessage(parent(), {
      type: 'info',
      title: 'Có bản cập nhật mới',
      message: `Đã có phiên bản ${info.version}`,
      detail: 'Bạn có muốn tải bản cập nhật ngay bây giờ không? Ứng dụng vẫn có thể được sử dụng trong khi tải.',
      buttons: ['Tải cập nhật', 'Để sau'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    })

    if (result.response === 0) {
      try {
        await autoUpdater.downloadUpdate()
      } catch (error) {
        console.error('[updater] Không tải được bản cập nhật:', error)
      }
    }
  })

  autoUpdater.on('update-downloaded', async (info) => {
    const result = await showMessage(parent(), {
      type: 'info',
      title: 'Cập nhật đã sẵn sàng',
      message: `Phiên bản ${info.version} đã tải xong`,
      detail: 'Khởi động lại ứng dụng để hoàn tất cập nhật. Dữ liệu SQLite hiện tại được giữ nguyên.',
      buttons: ['Khởi động lại và cập nhật', 'Cập nhật khi thoát'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    })

    if (result.response === 0) autoUpdater.quitAndInstall(false, true)
  })

  // Let the main window become responsive before making the network request.
  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error) => {
      console.error('[updater] Không thể kết nối GitHub Releases:', error)
    })
  }, 5_000)
}
