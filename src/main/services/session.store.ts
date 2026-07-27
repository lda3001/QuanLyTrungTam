import type { AuthUser } from '@shared/types/entities'
import type { Permission } from '@shared/constants/permissions'

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
  private currentUser: AuthUser | null = null

  set(user: AuthUser | null): void {
    this.currentUser = user
  }

  get(): AuthUser | null {
    return this.currentUser
  }

  clear(): void {
    this.currentUser = null
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null
  }

  has(permission: Permission): boolean {
    if (!this.currentUser) return false
    // Admin bỏ qua kiểm tra chi tiết — luôn toàn quyền
    if (this.currentUser.roleCode === 'admin') return true
    return this.currentUser.permissions.includes(permission)
  }

  userId(): number | null {
    return this.currentUser?.id ?? null
  }

  username(): string | null {
    return this.currentUser?.username ?? null
  }
}

export const sessionStore = new SessionStore()
