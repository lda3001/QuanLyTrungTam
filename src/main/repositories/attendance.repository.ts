import { BaseRepository } from './base.repository'
import { AppError } from '../utils/errors'
import { likeParam, normalizePage, toPageResult } from '../utils/pagination'
import type { PageResult } from '@shared/types/common'
import type { Attendance, AttendanceDetail } from '@shared/types/entities'
import type { AttendanceHistoryQuery, AttendanceHistoryRow, MarkAttendanceInput } from '@shared/types/dto'

export class AttendanceRepository extends BaseRepository<Attendance> {
  protected readonly tableName = 'attendance'
  protected readonly selectColumns = `
    id, session_id AS sessionId, student_id AS studentId, status, note,
    marked_by AS markedBy, marked_at AS markedAt,
    created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  /**
   * Bảng điểm danh của một buổi.
   *
   * Trả về TẤT CẢ học viên đang theo học của lớp (LEFT JOIN từ enrollments),
   * kể cả người chưa được điểm danh — giáo viên mở lên là thấy đủ danh sách,
   * mặc định trạng thái "có mặt" ở phía UI.
   */
  bySession(sessionId: number): AttendanceDetail[] {
    const session = this.sqlite
      .prepare(`SELECT class_id AS classId FROM class_sessions WHERE id = ? AND deleted_at IS NULL`)
      .get(sessionId) as { classId: number } | undefined
    if (!session) throw AppError.notFound('Buổi học')

    return this.sqlite
      .prepare(
        `SELECT
           COALESCE(a.id, 0) AS id,
           ? AS sessionId,
           s.id AS studentId,
           COALESCE(a.status, 'present') AS status,
           a.note,
           a.marked_by AS markedBy,
           COALESCE(a.marked_at, 0) AS markedAt,
           COALESCE(a.created_at, 0) AS createdAt,
           COALESCE(a.updated_at, 0) AS updatedAt,
           NULL AS deletedAt,
           s.code AS studentCode,
           s.full_name AS studentName
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         LEFT JOIN attendance a ON a.student_id = s.id AND a.session_id = ? AND a.deleted_at IS NULL
         WHERE e.class_id = ? AND e.deleted_at IS NULL AND e.status = 'studying'
         ORDER BY s.full_name`
      )
      .all(sessionId, sessionId, session.classId) as AttendanceDetail[]
  }

  /**
   * Ghi điểm danh. Dùng UPSERT theo cặp (session_id, student_id) nên điểm danh
   * lại nhiều lần vẫn chỉ có một dòng — lịch sử sửa nằm ở bảng logs.
   */
  mark(input: MarkAttendanceInput, markedBy: number | null): number {
    return this.transaction(() => {
      const session = this.sqlite
        .prepare(`SELECT id, status FROM class_sessions WHERE id = ? AND deleted_at IS NULL`)
        .get(input.sessionId) as { id: number; status: string } | undefined
      if (!session) throw AppError.notFound('Buổi học')
      if (session.status === 'cancelled') {
        throw AppError.conflict('Buổi học đã bị huỷ, không thể điểm danh.')
      }

      const now = Date.now()
      const upsert = this.sqlite.prepare(
        `INSERT INTO attendance
          (session_id, student_id, status, note, marked_by, marked_at, created_at, updated_at, deleted_at)
         VALUES (?,?,?,?,?,?,?,?,NULL)
         ON CONFLICT(session_id, student_id) DO UPDATE SET
           status = excluded.status,
           note = excluded.note,
           marked_by = excluded.marked_by,
           marked_at = excluded.marked_at,
           updated_at = excluded.updated_at,
           deleted_at = NULL`
      )

      for (const item of input.items) {
        upsert.run(
          input.sessionId,
          item.studentId,
          item.status,
          item.note?.trim() || null,
          markedBy,
          now,
          now,
          now
        )
      }

      // Điểm danh xong nghĩa là buổi học đã diễn ra
      this.sqlite
        .prepare(`UPDATE class_sessions SET status = 'done', updated_at = ? WHERE id = ? AND status = 'scheduled'`)
        .run(now, input.sessionId)

      return input.items.length
    })
  }

  history(query: AttendanceHistoryQuery): PageResult<AttendanceHistoryRow> {
    const p = normalizePage(query)
    const where: string[] = ['a.deleted_at IS NULL']
    const params: unknown[] = []

    const kw = likeParam(query.keyword)
    if (kw) {
      where.push(`(s.code LIKE ? ESCAPE '\\' OR s.full_name LIKE ? ESCAPE '\\' OR cl.name LIKE ? ESCAPE '\\')`)
      params.push(kw, kw, kw)
    }
    if (query.studentId) {
      where.push('a.student_id = ?')
      params.push(query.studentId)
    }
    if (query.classId) {
      where.push('cs.class_id = ?')
      params.push(query.classId)
    }
    if (query.status) {
      where.push('a.status = ?')
      params.push(query.status)
    }
    if (query.from) {
      where.push('cs.session_date >= ?')
      params.push(query.from)
    }
    if (query.to) {
      where.push('cs.session_date <= ?')
      params.push(query.to)
    }

    const whereSql = where.join(' AND ')
    const fromSql = `
      FROM attendance a
      JOIN class_sessions cs ON cs.id = a.session_id
      JOIN classes cl ON cl.id = cs.class_id
      JOIN courses co ON co.id = cl.course_id
      JOIN students s ON s.id = a.student_id
      LEFT JOIN users u ON u.id = a.marked_by
      WHERE ${whereSql}`

    const total = (
      this.sqlite.prepare(`SELECT COUNT(*) AS c ${fromSql}`).get(...(params as never[])) as { c: number }
    ).c

    const items = this.sqlite
      .prepare(
        `SELECT
           a.id, a.session_id AS sessionId, cs.session_date AS sessionDate,
           cs.start_time AS startTime, cs.end_time AS endTime,
           cl.name AS className, co.name AS courseName,
           a.student_id AS studentId, s.code AS studentCode, s.full_name AS studentName,
           a.status, a.note, u.full_name AS markedByName, a.marked_at AS markedAt
         ${fromSql}
         ORDER BY cs.session_date DESC, cs.start_time DESC, s.full_name
         LIMIT ? OFFSET ?`
      )
      .all(...(params as never[]), p.limit, p.offset) as AttendanceHistoryRow[]

    return toPageResult(items, total, p)
  }

  studentSummary(studentId: number): {
    present: number
    excused: number
    absent: number
    late: number
    total: number
  } {
    const row = this.sqlite
      .prepare(
        `SELECT
           SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present,
           SUM(CASE WHEN status = 'excused' THEN 1 ELSE 0 END) AS excused,
           SUM(CASE WHEN status = 'absent'  THEN 1 ELSE 0 END) AS absent,
           SUM(CASE WHEN status = 'late'    THEN 1 ELSE 0 END) AS late,
           COUNT(*) AS total
         FROM attendance WHERE student_id = ? AND deleted_at IS NULL`
      )
      .get(studentId) as {
      present: number | null
      excused: number | null
      absent: number | null
      late: number | null
      total: number
    }

    return {
      present: row.present ?? 0,
      excused: row.excused ?? 0,
      absent: row.absent ?? 0,
      late: row.late ?? 0,
      total: row.total ?? 0
    }
  }
}

export const attendanceRepository = new AttendanceRepository()
