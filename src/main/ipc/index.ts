import { registerAuthHandlers } from './auth.handler'
import {
  registerAttendanceHandlers,
  registerClassHandlers,
  registerCourseHandlers,
  registerSessionHandlers,
  registerStudentHandlers,
  registerTeacherHandlers
} from './academic.handler'
import {
  registerPaymentHandlers,
  registerReportHandlers,
  registerSystemHandlers,
  registerUserHandlers
} from './system.handler'

/**
 * Gọi đúng một lần sau khi database sẵn sàng và trước khi mở cửa sổ.
 * Đăng ký trùng kênh sẽ khiến Electron ném lỗi ngay — nên lỗi lặp không thể lọt.
 */
export function registerAllIpcHandlers(): void {
  registerAuthHandlers()
  registerStudentHandlers()
  registerTeacherHandlers()
  registerCourseHandlers()
  registerClassHandlers()
  registerSessionHandlers()
  registerAttendanceHandlers()
  registerPaymentHandlers()
  registerUserHandlers()
  registerReportHandlers()
  registerSystemHandlers()

  console.info('[ipc] Đã đăng ký toàn bộ handler.')
}
