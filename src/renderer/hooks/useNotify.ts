import { App } from 'antd'
import { useCallback } from 'react'
import { ApiError } from '@/services/ipc-client'

/**
 * Thông báo dùng chung.
 *
 * Dùng `App.useApp()` thay vì import tĩnh `message`/`notification`: bản static
 * KHÔNG đọc được ConfigProvider, nên ở Dark Mode nó vẫn hiện nền trắng và
 * không dùng đúng token màu.
 */
export function useNotify() {
  const { message, notification, modal } = App.useApp()

  const success = useCallback((content: string) => message.success(content), [message])
  const info = useCallback((content: string) => message.info(content), [message])
  const warning = useCallback((content: string) => message.warning(content), [message])

  /**
   * Hiển thị lỗi. Với lỗi nghiệp vụ (ApiError) thì thông báo đã bằng tiếng Việt
   * và đủ ngữ cảnh; với lỗi lạ thì hiện thông điệp chung, tránh dội chuỗi
   * kỹ thuật vào mặt người dùng.
   */
  const error = useCallback(
    (err: unknown, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.') => {
      if (err instanceof ApiError) {
        if (err.code === 'FORBIDDEN' || err.code === 'UNAUTHORIZED') {
          notification.warning({ message: 'Không có quyền', description: err.message, placement: 'topRight' })
          return
        }
        notification.error({ message: 'Không thực hiện được', description: err.message, placement: 'topRight' })
        return
      }
      notification.error({ message: 'Lỗi', description: fallback, placement: 'topRight' })
      console.error(err)
    },
    [notification]
  )

  /**
   * Hộp thoại xác nhận xoá — luôn hỏi trước khi thao tác không hoàn tác được.
   *
   * `onOk` nhận hàm trả về BẤT KỲ giá trị gì (thường là `mutateAsync` trả về
   * số bản ghi đã xoá). Ta nuốt giá trị đó tại đây; nếu không, mọi nơi gọi
   * đều phải tự bọc thêm một arrow function chỉ để ép kiểu về void.
   * Promise vẫn được await để nút OK giữ trạng thái loading cho tới khi xong.
   */
  const confirmDelete = useCallback(
    (options: { title?: string; content: string; onOk: () => unknown }) =>
      modal.confirm({
        title: options.title ?? 'Xác nhận xoá',
        content: options.content,
        okText: 'Xoá',
        okButtonProps: { danger: true },
        cancelText: 'Huỷ',
        centered: true,
        onOk: async () => {
          await options.onOk()
        }
      }),
    [modal]
  )

  const confirm = useCallback(
    (options: { title: string; content: string; okText?: string; onOk: () => unknown }) =>
      modal.confirm({
        title: options.title,
        content: options.content,
        okText: options.okText ?? 'Đồng ý',
        cancelText: 'Huỷ',
        centered: true,
        onOk: async () => {
          await options.onOk()
        }
      }),
    [modal]
  )

  return { success, info, warning, error, confirmDelete, confirm, message, notification, modal }
}
