import { api, call } from './ipc-client'
import type { AuthUser } from '@shared/types/entities'
import type { ChangePasswordInput, LoginInput, ResetPasswordInput } from '@shared/types/dto'

/**
 * Tầng service của renderer chỉ làm một việc: gọi IPC và bóc kết quả.
 * Không chứa logic nghiệp vụ — logic nằm ở main process, nơi không sửa được
 * từ DevTools.
 */
export const authService = {
  login: (input: LoginInput): Promise<AuthUser> => call(api().auth.login(input)),
  logout: (): Promise<boolean> => call(api().auth.logout()),
  me: (): Promise<AuthUser | null> => call(api().auth.me()),
  changePassword: (input: ChangePasswordInput): Promise<boolean> => call(api().auth.changePassword(input)),
  securityQuestion: (username: string): Promise<string | null> => call(api().auth.securityQuestion(username)),
  resetPassword: (input: ResetPasswordInput): Promise<boolean> => call(api().auth.resetPassword(input))
}
