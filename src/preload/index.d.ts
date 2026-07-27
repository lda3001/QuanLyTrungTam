import type { AppApi } from '@shared/ipc/api'

/**
 * Khai báo `window.api` cho renderer.
 * Nhờ file này, gọi sai tên hàm hay sai kiểu tham số sẽ báo lỗi ngay lúc
 * biên dịch thay vì lúc chạy.
 */
declare global {
  interface Window {
    api: AppApi
  }
}

export {}
