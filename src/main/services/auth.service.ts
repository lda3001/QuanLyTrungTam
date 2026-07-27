import { userRepository } from '../repositories/user.repository'
import { logRepository } from '../repositories/log.repository'
import { sessionStore } from './session.store'
import { AppError } from '../utils/errors'
import { hashSecurityAnswer, verifyPassword, verifySecurityAnswer } from '../utils/crypto'
import type { AuthUser } from '@shared/types/entities'
import type { ChangePasswordInput, LoginInput, ResetPasswordInput } from '@shared/types/dto'
import { ALL_PERMISSIONS } from '@shared/constants/permissions'

/**
 * Chống dò mật khẩu: khoá tạm tài khoản sau nhiều lần sai liên tiếp.
 * Bộ đếm nằm trong RAM — đủ cho ứng dụng desktop dùng nội bộ, và tự xoá khi
 * khởi động lại app.
 */
const MAX_ATTEMPTS = 5
const LOCK_MS = 5 * 60 * 1000
const attempts = new Map<string, { count: number; lockedUntil: number }>()

export class AuthService {
  login(input: LoginInput): AuthUser {
    const username = input.username.trim().toLowerCase()

    const record = attempts.get(username)
    if (record && record.lockedUntil > Date.now()) {
      const minutes = Math.ceil((record.lockedUntil - Date.now()) / 60000)
      throw AppError.unauthorized(`Tài khoản tạm khoá do nhập sai nhiều lần. Thử lại sau ${minutes} phút.`)
    }

    const user = userRepository.findByUsernameWithSecrets(username)

    // Thông báo giống nhau cho "sai tên" và "sai mật khẩu" — không tiết lộ
    // tài khoản nào có tồn tại.
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      this.recordFailure(username)
      throw AppError.unauthorized('Tên đăng nhập hoặc mật khẩu không đúng.')
    }
    if (!user.isActive) {
      throw AppError.forbidden('Tài khoản đã bị vô hiệu hoá. Liên hệ quản trị viên.')
    }

    attempts.delete(username)
    userRepository.touchLastLogin(user.id)

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      avatar: user.avatar,
      roleId: user.roleId,
      roleCode: user.roleCode,
      roleName: user.roleName,
      teacherId: user.teacherId,
      permissions:
        user.roleCode === 'admin' ? ALL_PERMISSIONS : userRepository.permissionsOfRole(user.roleId)
    }

    sessionStore.set(authUser)
    logRepository.write({
      userId: authUser.id,
      username: authUser.username,
      action: 'login',
      entity: 'users',
      entityId: authUser.id,
      description: `${authUser.fullName} đăng nhập hệ thống`
    })

    return authUser
  }

  private recordFailure(username: string): void {
    const rec = attempts.get(username) ?? { count: 0, lockedUntil: 0 }
    rec.count++
    if (rec.count >= MAX_ATTEMPTS) {
      rec.lockedUntil = Date.now() + LOCK_MS
      rec.count = 0
    }
    attempts.set(username, rec)
  }

  logout(): boolean {
    const user = sessionStore.get()
    if (user) {
      logRepository.write({
        userId: user.id,
        username: user.username,
        action: 'logout',
        entity: 'users',
        entityId: user.id,
        description: `${user.fullName} đăng xuất`
      })
    }
    sessionStore.clear()
    return true
  }

  me(): AuthUser | null {
    return sessionStore.get()
  }

  changePassword(input: ChangePasswordInput): boolean {
    const current = sessionStore.get()
    if (!current) throw AppError.unauthorized()

    const user = userRepository.findByIdWithSecrets(current.id)
    if (!user) throw AppError.notFound('Tài khoản')

    if (!verifyPassword(input.currentPassword, user.passwordHash)) {
      throw AppError.validation('Mật khẩu hiện tại không đúng.')
    }
    if (input.newPassword.length < 6) {
      throw AppError.validation('Mật khẩu mới phải có ít nhất 6 ký tự.')
    }
    if (verifyPassword(input.newPassword, user.passwordHash)) {
      throw AppError.validation('Mật khẩu mới phải khác mật khẩu hiện tại.')
    }

    userRepository.updatePassword(current.id, input.newPassword)
    logRepository.write({
      userId: current.id,
      username: current.username,
      action: 'change-password',
      entity: 'users',
      entityId: current.id,
      description: 'Đổi mật khẩu'
    })
    return true
  }

  /** Bước 1 của "quên mật khẩu nội bộ": lấy câu hỏi bảo mật của tài khoản */
  securityQuestion(username: string): string | null {
    const user = userRepository.findByUsernameWithSecrets(username.trim().toLowerCase())
    if (!user || !user.securityAnswerHash) return null
    return user.securityQuestion
  }

  /** Bước 2: trả lời đúng câu hỏi thì được đặt lại mật khẩu */
  resetPassword(input: ResetPasswordInput): boolean {
    const user = userRepository.findByUsernameWithSecrets(input.username.trim().toLowerCase())
    if (!user || !user.securityAnswerHash) {
      throw AppError.validation('Tài khoản chưa thiết lập câu hỏi bảo mật. Liên hệ quản trị viên.')
    }
    if (!verifySecurityAnswer(input.securityAnswer, user.securityAnswerHash)) {
      throw AppError.validation('Câu trả lời bảo mật không đúng.')
    }
    if (input.newPassword.length < 6) {
      throw AppError.validation('Mật khẩu mới phải có ít nhất 6 ký tự.')
    }

    userRepository.updatePassword(user.id, input.newPassword)
    logRepository.write({
      userId: user.id,
      username: user.username,
      action: 'reset-password',
      entity: 'users',
      entityId: user.id,
      description: 'Đặt lại mật khẩu qua câu hỏi bảo mật'
    })
    return true
  }

  /** Quản trị viên đặt lại mật khẩu hộ nhân viên */
  adminResetPassword(userId: number, newPassword: string): boolean {
    if (newPassword.length < 6) throw AppError.validation('Mật khẩu mới phải có ít nhất 6 ký tự.')

    const target = userRepository.detail(userId)
    userRepository.updatePassword(userId, newPassword)

    const actor = sessionStore.get()
    logRepository.write({
      userId: actor?.id ?? null,
      username: actor?.username ?? null,
      action: 'reset-password',
      entity: 'users',
      entityId: userId,
      description: `Đặt lại mật khẩu cho tài khoản ${target.username}`
    })
    return true
  }

  /** Dùng khi tạo tài khoản mới có câu hỏi bảo mật */
  static hashAnswer(answer: string): string {
    return hashSecurityAnswer(answer)
  }
}

export const authService = new AuthService()
