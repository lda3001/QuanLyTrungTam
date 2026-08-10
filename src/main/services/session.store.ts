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
  private desktopUser: AuthUser | null = null

  run<T>(user: AuthUser | null, callback: () => T): T {
    return this.context.run({ user }, callback)
  }

  set(user: AuthUser | null): void {
    const state = this.context.getStore()
    if (state) state.user = user
    else this.desktopUser = user
  }

  get(): AuthUser | null {
    const state = this.context.getStore()
    return state ? state.user : this.desktopUser
  }

  clear(): void {
    const state = this.context.getStore()
    if (state) state.user = null
    else this.desktopUser = null
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
