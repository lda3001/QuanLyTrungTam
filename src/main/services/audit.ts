import { logRepository } from '../repositories/log.repository'
import { sessionStore } from './session.store'

/**
 * Ghi nhật ký kèm thông tin người đang đăng nhập.
 * Tách riêng để service không phải lặp lại việc lấy user từ session mỗi lần.
 */
export function audit(
  action: string,
  entity: string,
  entityId: number | null,
  description: string,
  metadata?: unknown
): void {
  const user = sessionStore.get()
  logRepository.write({
    userId: user?.id ?? null,
    username: user?.username ?? null,
    action,
    entity,
    entityId,
    description,
    metadata
  })
}
