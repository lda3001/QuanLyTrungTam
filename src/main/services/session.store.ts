import type { AuthUser } from '@shared/types/entities'
import type { Permission } from '@shared/constants/permissions'
import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Phiên đăng nhập, lưu trong bộ nhớ của main process.
 *
 * Vì sao không lưu ở renderer? Renderer có thể bị sửa qua DevTools. Nếu quyền
 * do renderer tự khai báo thì ai cũng "tự phong" admin được. Main process giữ
 * bản duy nhất và tự kiểm tra trước mỗi thao tác.
 *
 * Đóng app là mất phiên — đúng mong đợi với phần mềm quản lý dùng tại quầy.
 */
class SessionStore {
  private readonly context = new AsyncLocalStorage<{ user: AuthUser | null }>()

  run<T>(user: AuthUser | null, callback: () => T): T {
    return this.context.run({ user }, callback)
  }

  private get state(): { user: AuthUser | null } {
    const state = this.context.getStore()
    if (!state) throw new Error('Session context chưa được khởi tạo.')
    return state
  }

  set(user: AuthUser | null): void {
    this.state.user = user
  }

  get(): AuthUser | null {
    return this.context.getStore()?.user ?? null
  }

  clear(): void {
    this.state.user = null
  }

  isAuthenticated(): boolean {
    return this.get() !== null
  }

  has(permission: Permission): boolean {
    const currentUser = this.get()
    if (!currentUser) return false
    // Admin bỏ qua kiểm tra chi tiết — luôn toàn quyền
    if (currentUser.roleCode === 'admin') return true
    return currentUser.permissions.includes(permission)
  }

  userId(): number | null {
    return this.get()?.id ?? null
  }

  username(): string | null {
    return this.get()?.username ?? null
  }
}

export const sessionStore = new SessionStore()
