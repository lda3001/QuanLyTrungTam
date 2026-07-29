import { attendanceRepository } from '../repositories/attendance.repository'
import { sessionStore } from './session.store'
import { audit } from './audit'
import { AppError } from '../utils/errors'
import type { PageResult } from '@shared/types/common'
import type { AttendanceDetail } from '@shared/types/entities'
import type {
  AttendanceGridQuery,
  AttendanceGridResult,
  AttendanceHistoryQuery,
  AttendanceHistoryRow,
  MarkAttendanceInput,
  MarkMultiAttendanceInput
} from '@shared/types/dto'
import { AttendanceStatus } from '@shared/constants/enums'

const VALID_STATUS = new Set<string>(Object.values(AttendanceStatus))

export class AttendanceService {
  bySession(sessionId: number): AttendanceDetail[] {
    return attendanceRepository.bySession(sessionId)
  }

  mark(input: MarkAttendanceInput): number {
    if (!input.items?.length) throw AppError.validation('Danh sách điểm danh rỗng.')

    for (const item of input.items) {
      if (!VALID_STATUS.has(item.status)) {
        throw AppError.validation(`Trạng thái điểm danh không hợp lệ: ${item.status}`)
      }
    }

    const count = attendanceRepository.mark(input, sessionStore.userId())
    audit('mark', 'attendance', input.sessionId, `Điểm danh ${count} học viên (buổi #${input.sessionId})`, {
      summary: summarize(input)
    })
    return count
  }

  history(query: AttendanceHistoryQuery): PageResult<AttendanceHistoryRow> {
    return attendanceRepository.history(query ?? {})
  }

  grid(query: AttendanceGridQuery): AttendanceGridResult {
    if (!query?.classId) throw AppError.validation('Chưa chọn lớp học.')
    return attendanceRepository.grid(query)
  }

  markMulti(input: MarkMultiAttendanceInput): number {
    if (!input.sessions?.length) throw AppError.validation('Không có buổi nào để điểm danh.')
    for (const sess of input.sessions) {
      for (const item of sess.items) {
        if (!VALID_STATUS.has(item.status)) {
          throw AppError.validation(`Trạng thái không hợp lệ: ${item.status}`)
        }
      }
    }
    const count = attendanceRepository.markMulti(input, sessionStore.userId())
    audit('mark', 'attendance', null, `Điểm danh nhiều buổi: ${input.sessions.length} buổi, ${count} bản ghi`)
    return count
  }

  studentSummary(studentId: number): { present: number; excused: number; absent: number; late: number; total: number } {
    return attendanceRepository.studentSummary(studentId)
  }
}

function summarize(input: MarkAttendanceInput): Record<string, number> {
  const acc: Record<string, number> = {}
  for (const i of input.items) acc[i.status] = (acc[i.status] ?? 0) + 1
  return acc
}

export const attendanceService = new AttendanceService()
