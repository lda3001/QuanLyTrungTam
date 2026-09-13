import { BaseRepository } from './base.repository'
import { AppError } from '../utils/errors'
import type { ClassSession, ClassSessionDetail } from '@shared/types/entities'
import type {
  GenerateSessionsInput,
  MoveSessionInput,
  SessionInput,
  SessionQuery
} from '@shared/types/dto'

const SESSION_COLUMNS = `
  cs.id, cs.class_id AS classId, cs.session_date AS sessionDate,
  cs.start_time AS startTime, cs.end_time AS endTime, cs.room,
  cs.teacher_id AS teacherId, cs.topic, cs.status, cs.note,
  cs.created_at AS createdAt, cs.updated_at AS updatedAt, cs.deleted_at AS deletedAt,
  cl.name AS className, co.name AS courseName,
  COALESCE(t.full_name, tc.full_name) AS teacherName,
  (SELECT COUNT(*) FROM attendance a
    WHERE a.session_id = cs.id AND a.deleted_at IS NULL AND a.status IN ('present','late')) AS attendedCount,
  (SELECT COUNT(*) FROM enrollments e
    WHERE e.class_id = cs.class_id
      AND e.deleted_at IS NULL
      AND (
        e.status = 'studying'
        OR (
          cl.status = 'finished'
          AND (
            e.status = 'completed'
            OR EXISTS (
              SELECT 1 FROM attendance old_a
              WHERE old_a.session_id = cs.id
                AND old_a.student_id = e.student_id
                AND old_a.deleted_at IS NULL
            )
          )
        )
      )) AS totalStudents`

export class SessionRepository extends BaseRepository<ClassSession> {
  protected readonly tableName = 'class_sessions'
  protected readonly selectColumns = `
    id, class_id AS classId, session_date AS sessionDate, start_time AS startTime,
    end_time AS endTime, room, teacher_id AS teacherId, topic, status, note,
    created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  /**
   * Lịch học theo khoảng ngày. Không phân trang: lịch tuần/tháng luôn bị chặn
   * bởi khoảng thời gian nên số dòng đã tự giới hạn.
   */
  list(query: SessionQuery): ClassSessionDetail[] {
    const where: string[] = ['cs.deleted_at IS NULL']
    const params: unknown[] = []

    if (query.classId) {
      where.push('cs.class_id = ?')
      params.push(query.classId)
    }
    if (query.teacherId) {
      // Buổi lẻ có thể đổi giáo viên; nếu không đổi thì lấy theo giáo viên của lớp
      where.push('COALESCE(cs.teacher_id, cl.teacher_id) = ?')
      params.push(query.teacherId)
    }
    if (query.from) {
      where.push('cs.session_date >= ?')
      params.push(query.from)
    }
    if (query.to) {
      where.push('cs.session_date <= ?')
      params.push(query.to)
    }
    if (query.status) {
      where.push('cs.status = ?')
      params.push(query.status)
    }

    return this.sqlite
      .prepare(
        `SELECT ${SESSION_COLUMNS}
         FROM class_sessions cs
         JOIN classes cl ON cl.id = cs.class_id
         JOIN courses co ON co.id = cl.course_id
         LEFT JOIN teachers t ON t.id = cs.teacher_id
         LEFT JOIN teachers tc ON tc.id = cl.teacher_id
         WHERE ${where.join(' AND ')}
         ORDER BY cs.session_date, cs.start_time`
      )
      .all(...(params as never[])) as ClassSessionDetail[]
  }

  detail(id: number): ClassSessionDetail {
    const row = this.sqlite
      .prepare(
        `SELECT ${SESSION_COLUMNS}
         FROM class_sessions cs
         JOIN classes cl ON cl.id = cs.class_id
         JOIN courses co ON co.id = cl.course_id
         LEFT JOIN teachers t ON t.id = cs.teacher_id
         LEFT JOIN teachers tc ON tc.id = cl.teacher_id
         WHERE cs.id = ? AND cs.deleted_at IS NULL`
      )
      .get(id) as ClassSessionDetail | undefined

    if (!row) throw AppError.notFound('Buổi học')
    return row
  }

  create(input: SessionInput): ClassSession {
    if (input.startTime >= input.endTime) {
      throw AppError.validation('Giờ kết thúc phải sau giờ bắt đầu.')
    }
    this.assertNoRoomConflict(input.room ?? null, input.sessionDate, input.startTime, input.endTime)

    const now = Date.now()
    const res = this.sqlite
      .prepare(
        `INSERT INTO class_sessions
          (class_id, session_date, start_time, end_time, room, teacher_id, topic, status, note,
           created_at, updated_at, deleted_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,NULL)`
      )
      .run(
        input.classId,
        input.sessionDate,
        input.startTime,
        input.endTime,
        input.room?.trim() || null,
        input.teacherId ?? null,
        input.topic?.trim() || null,
        input.status,
        input.note?.trim() || null,
        now,
        now
      )

    return this.findByIdOrFail(Number(res.lastInsertRowid), 'Buổi học')
  }

  update(id: number, input: SessionInput): ClassSession {
    this.findByIdOrFail(id, 'Buổi học')
    if (input.startTime >= input.endTime) {
      throw AppError.validation('Giờ kết thúc phải sau giờ bắt đầu.')
    }
    this.assertNoRoomConflict(
      input.room ?? null,
      input.sessionDate,
      input.startTime,
      input.endTime,
      id
    )

    this.sqlite
      .prepare(
        `UPDATE class_sessions SET
           class_id = ?, session_date = ?, start_time = ?, end_time = ?, room = ?,
           teacher_id = ?, topic = ?, status = ?, note = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(
        input.classId,
        input.sessionDate,
        input.startTime,
        input.endTime,
        input.room?.trim() || null,
        input.teacherId ?? null,
        input.topic?.trim() || null,
        input.status,
        input.note?.trim() || null,
        Date.now(),
        id
      )

    return this.findByIdOrFail(id, 'Buổi học')
  }

  /** Kéo–thả trên lịch: chỉ đổi ngày giờ, giữ nguyên các thông tin khác */
  move(input: MoveSessionInput): ClassSession {
    const current = this.findByIdOrFail(input.id, 'Buổi học')

    if (current.status === 'done') {
      throw AppError.conflict('Buổi học đã dạy xong, không thể dời lịch.')
    }
    if (input.startTime >= input.endTime) {
      throw AppError.validation('Giờ kết thúc phải sau giờ bắt đầu.')
    }
    this.assertNoRoomConflict(
      current.room,
      input.sessionDate,
      input.startTime,
      input.endTime,
      input.id
    )

    this.sqlite
      .prepare(
        `UPDATE class_sessions SET session_date = ?, start_time = ?, end_time = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(input.sessionDate, input.startTime, input.endTime, Date.now(), input.id)

    return this.findByIdOrFail(input.id, 'Buổi học')
  }

  /**
   * Hai lớp không thể dùng chung một phòng vào khung giờ chồng lấn.
   * Điều kiện chồng lấn: start < otherEnd AND end > otherStart.
   */
  private assertNoRoomConflict(
    room: string | null,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: number
  ): void {
    if (!room) return

    const params: unknown[] = [room, date, endTime, startTime]
    let exclude = ''
    if (excludeId) {
      exclude = 'AND id <> ?'
      params.push(excludeId)
    }

    const conflict = this.sqlite
      .prepare(
        `SELECT id FROM class_sessions
         WHERE deleted_at IS NULL AND status <> 'cancelled'
           AND room = ? AND session_date = ?
           AND start_time < ? AND end_time > ?
           ${exclude}
         LIMIT 1`
      )
      .get(...(params as never[])) as { id: number } | undefined

    if (conflict) {
      throw AppError.conflict(`Phòng ${room} đã có lớp khác trong khung giờ này.`)
    }
  }

  assertDeletable(id: number): void {
    const row = this.sqlite
      .prepare(`SELECT COUNT(*) AS c FROM attendance WHERE session_id = ? AND deleted_at IS NULL`)
      .get(id) as { c: number }

    if (row.c > 0) {
      throw AppError.conflict('Buổi học đã có dữ liệu điểm danh, không thể xoá.')
    }
  }

  /**
   * Sinh các buổi học từ khung giờ hằng tuần của lớp, trải từ ngày bắt đầu tới
   * ngày kết thúc, dừng khi đủ số buổi của khoá học.
   */
  generate(input: GenerateSessionsInput): number {
    return this.transaction(() => {
      const cls = this.sqlite
        .prepare(
          `SELECT cl.id, cl.start_date AS startDate, cl.end_date AS endDate,
                  cl.room, cl.teacher_id AS teacherId, co.total_sessions AS totalSessions
           FROM classes cl JOIN courses co ON co.id = cl.course_id
           WHERE cl.id = ? AND cl.deleted_at IS NULL`
        )
        .get(input.classId) as
        | {
            id: number
            startDate: string | null
            endDate: string | null
            room: string | null
            teacherId: number | null
            totalSessions: number
          }
        | undefined

      if (!cls) throw AppError.notFound('Lớp học')
      if (!cls.startDate) throw AppError.validation('Lớp chưa có ngày bắt đầu.')

      const schedules = this.sqlite
        .prepare(
          `SELECT weekday, start_time AS startTime, end_time AS endTime, room
           FROM class_schedules WHERE class_id = ? AND deleted_at IS NULL
           ORDER BY weekday`
        )
        .all(input.classId) as {
        weekday: number
        startTime: string
        endTime: string
        room: string | null
      }[]

      if (schedules.length === 0) {
        throw AppError.validation('Lớp chưa khai báo khung giờ học hằng tuần.')
      }

      const now = Date.now()

      if (input.replaceExisting) {
        // Chỉ xoá buổi CHƯA điểm danh — dữ liệu điểm danh là bằng chứng, không được mất
        this.sqlite
          .prepare(
            `UPDATE class_sessions SET deleted_at = ?, updated_at = ?
             WHERE class_id = ? AND deleted_at IS NULL
               AND NOT EXISTS (
                 SELECT 1 FROM attendance a WHERE a.session_id = class_sessions.id AND a.deleted_at IS NULL
               )`
          )
          .run(now, now, input.classId)
      }

      const existing = new Set(
        (
          this.sqlite
            .prepare(
              `SELECT session_date AS d, start_time AS t FROM class_sessions
               WHERE class_id = ? AND deleted_at IS NULL`
            )
            .all(input.classId) as { d: string; t: string }[]
        ).map((r) => `${r.d}|${r.t}`)
      )

      const insert = this.sqlite.prepare(
        `INSERT INTO class_sessions
          (class_id, session_date, start_time, end_time, room, teacher_id, topic, status, note,
           created_at, updated_at, deleted_at)
         VALUES (?,?,?,?,?,?,?,'scheduled',NULL,?,?,NULL)`
      )

      const target = cls.totalSessions > 0 ? cls.totalSessions : 999
      const hardStop = cls.endDate ? new Date(`${cls.endDate}T00:00:00`) : null
      const cursor = new Date(`${cls.startDate}T00:00:00`)
      const todayCut = new Date(cursor)
      todayCut.setFullYear(todayCut.getFullYear() + 2) // chốt an toàn: tối đa 2 năm

      let created = 0
      let index = existing.size

      while (index < target && cursor <= todayCut) {
        if (hardStop && cursor > hardStop) break

        const weekday = cursor.getDay()
        const matched = schedules.filter((s) => s.weekday === weekday)

        for (const s of matched) {
          if (index >= target) break
          const dateStr = formatDate(cursor)
          const key = `${dateStr}|${s.startTime}`
          if (existing.has(key)) continue

          insert.run(
            input.classId,
            dateStr,
            s.startTime,
            s.endTime,
            s.room ?? cls.room,
            cls.teacherId,
            `Buổi ${index + 1}`,
            now,
            now
          )
          existing.add(key)
          created++
          index++
        }

        cursor.setDate(cursor.getDate() + 1)
      }

      return created
    })
  }
}

function formatDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export const sessionRepository = new SessionRepository()
