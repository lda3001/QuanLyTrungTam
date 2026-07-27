import { registerHandler } from './handler-factory'
import { IPC } from '@shared/ipc/channels'
import { authService } from '../services/auth.service'
import type { ChangePasswordInput, LoginInput, ResetPasswordInput } from '@shared/types/dto'

export function registerAuthHandlers(): void {
  // `public: true` — chưa đăng nhập thì đương nhiên chưa có phiên để kiểm tra
  registerHandler(IPC.AUTH_LOGIN, { public: true }, (input: LoginInput) => authService.login(input))

  registerHandler(IPC.AUTH_LOGOUT, { public: true }, () => authService.logout())

  registerHandler(IPC.AUTH_ME, { public: true }, () => authService.me())

  registerHandler(IPC.AUTH_CHANGE_PASSWORD, {}, (input: ChangePasswordInput) =>
    authService.changePassword(input)
  )

  registerHandler(IPC.AUTH_SECURITY_QUESTION, { public: true }, (username: string) =>
    authService.securityQuestion(username)
  )

  registerHandler(IPC.AUTH_RESET_PASSWORD, { public: true }, (input: ResetPasswordInput) =>
    authService.resetPassword(input)
  )
}
