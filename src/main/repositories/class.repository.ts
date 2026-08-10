import { BaseRepository } from './base.repository'
import { AppError } from '../utils/errors'
import { generateCode } from '../utils/code-generator'
import { likeParam, normalizePage, safeSort, toPageResult } from '../utils/pagination'
import type { PageResult, SelectOption } from '@shared/types/common'
import type { ClassRoom, ClassRoomDetail, ClassSchedule, EnrollmentDetail, Student } from '@shared/types/entities'
import type { ClassInput, ClassQuery, EnrollImportInput, EnrollInput, ImportResult } from '@shared/types/dto'

const SORTABLE: Record<string, string> = {
  code: 'cl.code',
  name: 'cl.name',
  startDate: 'cl.start_date',
  createdAt: 'cl.created_at',
  status: 'cl.status'
}

/**
 * Cột dùng chung cho truy vấn lớp học.
 *
 * `studentCount` tính bằng sub-select thay vì JOIN + GROUP BY: giữ được
 * COUNT(*) tổng chính xác cho phân trang, và SQLite tối ưu tốt nhờ index
 * enrollments_class_idx.
 */
const CLASS_COLUMNS = `
  cl.id, cl.code, cl.name, cl.course_id AS courseId, cl.teacher_id AS teacherId,
  cl.room, cl.start_date AS startDate, cl.end_date AS endDate,
  cl.max_students AS maxStudents, cl.status, cl.note,
  cl.created_at AS createdAt, cl.updated_at AS updatedAt, cl.deleted_at AS deletedAt,
  co.name AS courseName, co.tuition_fee AS courseFee,
  t.full_name AS teacherName,
  (SELECT COUNT(*) FROM enrollments e
    WHERE e.class_id = cl.id AND e.deleted_at IS NULL) AS studentCount`

export class ClassRepository extends BaseRepository<ClassRoom> {
  protected readonly tableName = 'classes'
  protected readonly selectColumns = `
    id, code, name, course_id AS courseId, teacher_id AS teacherId, room,
    start_date AS startDate, end_date AS endDate, max_students AS maxStudents,
    status, note, created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  list(query: ClassQuery): PageResult<ClassRoomDetail> {
    const p = normalizePage(query)
    const where: string[] = ['cl.deleted_at IS NULL']
    const params: unknown[] = []

    const kw = likeParam(query.keyword)
    if (kw) {
      where.push(`(cl.code LIKE ? ESCAPE '\\' OR cl.name LIKE ? ESCAPE '\\' OR cl.room LIKE ? ESCAPE '\\')`)
      params.push(kw, kw, kw)
    }
    if (query.status) {
      where.push('cl.status = ?')
      params.push(query.status)
    }
    if (query.courseId) {
      where.push('cl.course_id = ?')
      params.push(query.courseId)
    }
    if (query.teacherId) {
      where.push('cl.teacher_id = ?')
      params.push(query.teacherId)
    }

    const whereSql = where.join(' AND ')
    const orderBy = safeSort(query.sortBy, query.sortOrder, SORTABLE, 'cl.created_at')

    const total = (
      this.sqlite
        .prepare(`SELECT COUNT(*) AS c FROM classes cl WHERE ${whereSql}`)
        .get(...(params as never[])) as { c: number }
    ).c

    const rows = this.sqlite
      .prepare(
        `SELECT ${CLASS_COLUMNS}
         FROM classes cl
         JOIN courses co ON co.id = cl.course_id
         LEFT JOIN teachers t ON t.id = cl.teacher_id
         WHERE ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`
      )
      .all(...(params as never[]), p.limit, p.offset) as Omit<ClassRoomDetail, 'schedules'>[]

    // Nạp khung giờ cho toàn bộ lớp trong trang bằng MỘT truy vấn (tránh N+1)
    const schedulesByClass = this.schedulesFor(rows.map((r) => r.id))
    const items: ClassRoomDetail[] = rows.map((r) => ({
      ...r,
      schedules: schedulesByClass.get(r.id) ?? []
    }))

    return toPageResult(items, total, p)
  }

  detail(id: number): ClassRoomDetail {
    const row = this.sqlite
      .prepare(
        `SELECT ${CLASS_COLUMNS}
         FROM classes cl
         JOIN courses co ON co.id = cl.course_id
         LEFT JOIN teachers t ON t.id = cl.teacher_id
         WHERE cl.id = ? AND cl.deleted_at IS NULL`
      )
      .get(id) as Omit<ClassRoomDetail, 'schedules'> | undefined

    if (!row) throw AppError.notFound('Lớp học')
    return { ...row, schedules: this.schedulesFor([id]).get(id) ?? [] }
  }

  private schedulesFor(classIds: number[]): Map<number, ClassSchedule[]> {
    const map = new Map<number, ClassSchedule[]>()
    if (classIds.length === 0) return map

    const placeholders = classIds.map(() => '?').join(',')
    const rows = this.sqlite
      .prepare(
        `SELECT id, class_id AS classId, weekday, start_time AS startTime,
                end_time AS endTime, room,
                created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt
         FROM class_schedules
         WHERE class_id IN (${placeholders}) AND deleted_at IS NULL
         ORDER BY weekday, start_time`
      )
      .all(...classIds) as ClassSchedule[]

    for (const r of rows) {
      const arr = map.get(r.classId) ?? []
      arr.push(r)
      map.set(r.classId, arr)
    }
    return map
  }

  create(input: ClassInput): ClassRoomDetail {
    return this.transaction(() => {
      const code = input.code?.trim() || generateCode(this.sqlite, 'classes', 'L', 3)
      if (this.isDuplicate('code', code)) {
        throw AppError.duplicate(`Mã lớp "${code}" đã tồn tại.`)
      }

      const now = Date.now()
      const res = this.sqlite
        .prepare(
          `INSERT INTO classes
            (code, name, course_id, teacher_id, room, start_date, end_date,
             max_students, status, note, created_at, updated_at, deleted_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NULL)`
        )
        .run(
          code,
          input.name.trim(),
          input.courseId,
          input.teacherId ?? null,
          input.room?.trim() || null,
          input.startDate ?? null,
          input.endDate ?? null,
          Math.max(1, Math.round(input.maxStudents || 30)),
          input.status,
          input.note?.trim() || null,
          now,
          now
        )

      const classId = Number(res.lastInsertRowid)
      this.replaceSchedules(classId, input.schedules)
      return this.detail(classId)
    })
  }

  update(id: number, input: ClassInput): ClassRoomDetail {
    return this.transaction(() => {
      const current = this.findByIdOrFail(id, 'Lớp học')
      const code = input.code?.trim() || current.code
      if (code !== current.code && this.isDuplicate('code', code, id)) {
        throw AppError.duplicate(`Mã lớp "${code}" đã tồn tại.`)
      }

      // Không cho hạ sĩ số xuống dưới số học viên đã xếp lớp
      const enrolled = (
        this.sqlite
          .prepare(`SELECT COUNT(*) AS c FROM enrollments WHERE class_id = ? AND deleted_at IS NULL`)
          .get(id) as { c: number }
      ).c
      if (input.maxStudents < enrolled) {
        throw AppError.validation(`Lớp đang có ${enrolled} học viên, sĩ số tối đa không thể nhỏ hơn.`)
      }

      this.sqlite
        .prepare(
          `UPDATE classes SET
             code = ?, name = ?, course_id = ?, teacher_id = ?, room = ?,
             start_date = ?, end_date = ?, max_students = ?, status = ?, note = ?, updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`
        )
        .run(
          code,
          input.name.trim(),
          input.courseId,
          input.teacherId ?? null,
          input.room?.trim() || null,
          input.startDate ?? null,
          input.endDate ?? null,
          Math.max(1, Math.round(input.maxStudents || 30)),
          input.status,
          input.note?.trim() || null,
          Date.now(),
          id
        )

      this.replaceSchedules(id, input.schedules)
      return this.detail(id)
    })
  }

  /** Xoá mềm toàn bộ khung giờ cũ rồi ghi mới — đơn giản và luôn nhất quán */
  private replaceSchedules(classId: number, schedules: ClassInput['schedules']): void {
    const now = Date.now()
    this.sqlite
      .prepare(`UPDATE class_schedules SET deleted_at = ?, updated_at = ? WHERE class_id = ? AND deleted_at IS NULL`)
      .run(now, now, classId)

    const insert = this.sqlite.prepare(
      `INSERT INTO class_schedules
        (class_id, weekday, start_time, end_time, room, created_at, updated_at, deleted_at)
       VALUES (?,?,?,?,?,?,?,NULL)`
    )

    for (const s of schedules ?? []) {
      if (s.startTime >= s.endTime) {
        throw AppError.validation('Giờ kết thúc phải sau giờ bắt đầu.')
      }
      insert.run(classId, s.weekday, s.startTime, s.endTime, s.room?.trim() || null, now, now)
    }
  }

  assertDeletable(id: number): void {
    const row = this.sqlite
      .prepare(`SELECT COUNT(*) AS c FROM enrollments WHERE class_id = ? AND deleted_at IS NULL`)
      .get(id) as { c: number }

    if (row.c > 0) {
      throw AppError.conflict(`Lớp đang có ${row.c} học viên. Hãy gỡ học viên khỏi lớp trước khi xoá.`)
    }
  }

  options(): SelectOption[] {
    const rows = this.sqlite
      .prepare(
        `SELECT cl.id, cl.code, cl.name FROM classes cl
         WHERE cl.deleted_at IS NULL AND cl.status IN ('planned','ongoing')
         ORDER BY cl.name`
      )
      .all() as { id: number; code: string; name: string }[]
    return rows.map((r) => ({ label: `${r.code} — ${r.name}`, value: r.id }))
  }

  /* ----------------------- Ghi danh ----------------------- */

  studentsOfClass(classId: number): EnrollmentDetail[] {
    return this.sqlite
      .prepare(
        `SELECT
           e.id, e.student_id AS studentId, e.class_id AS classId,
           e.enroll_date AS enrollDate, e.status, e.agreed_fee AS agreedFee,
           e.fee_type AS feeType, e.custom_fee AS customFee,
           e.discount, e.surcharge, e.payable_override AS payableOverride, e.note,
           e.created_at AS createdAt, e.updated_at AS updatedAt, e.deleted_at AS deletedAt,
           s.code AS studentCode, s.full_name AS studentName, s.phone AS studentPhone,
           cl.name AS className, co.name AS courseName,
           et.default_fee AS defaultFee, et.calculated_fee AS calculatedFee,
           et.payable AS payableAmount,
           et.eligible_session_count AS eligibleSessionCount,
           et.total_session_count AS totalSessionCount,
           et.billable_month_count AS billableMonthCount,
           COALESCE(pay.paid, 0) AS paidAmount,
           (et.payable - COALESCE(pay.paid, 0)) AS remainingAmount
         FROM enrollments e
         JOIN students s ON s.id = e.student_id
         JOIN classes cl ON cl.id = e.class_id
         JOIN courses co ON co.id = cl.course_id
         JOIN enrollment_tuition et ON et.enrollment_id = e.id
         LEFT JOIN (
           SELECT enrollment_id, SUM(amount) AS paid FROM payments
           WHERE deleted_at IS NULL AND status <> 'refunded'
           GROUP BY enrollment_id
         ) pay ON pay.enrollment_id = e.id
         WHERE e.class_id = ? AND e.deleted_at IS NULL
         ORDER BY last_name(s.full_name), s.full_name`
      )
      .all(classId) as EnrollmentDetail[]
  }

  /** Học viên đang hoạt động và CHƯA có trong lớp này */
  availableStudents(classId: number, keyword?: string): Student[] {
    const kw = likeParam(keyword)
    const params: unknown[] = [classId]
    let filter = ''
    if (kw) {
      filter = `AND (s.code LIKE ? ESCAPE '\\' OR search_text(s.full_name) LIKE ? ESCAPE '\\' OR s.phone LIKE ? ESCAPE '\\')`
      params.push(kw, kw, kw)
    }

    return this.sqlite
      .prepare(
        `SELECT s.id, s.code, s.full_name AS fullName, s.gender, s.birth_date AS birthDate,
                s.email, s.phone, s.address, s.guardian_name AS guardianName,
                s.guardian_phone AS guardianPhone, s.note, s.status, s.avatar,
                s.created_at AS createdAt, s.updated_at AS updatedAt, s.deleted_at AS deletedAt
         FROM students s
         WHERE s.deleted_at IS NULL AND s.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM enrollments e
             WHERE e.student_id = s.id AND e.class_id = ? AND e.deleted_at IS NULL
           )
           ${filter}
         ORDER BY last_name(s.full_name), s.full_name
         LIMIT 100`
      )
      .all(...(params as never[])) as Student[]
  }

  /**
   * Xếp nhiều học viên vào lớp trong một transaction.
   * Học phí được chốt từ giá khoá học tại thời điểm ghi danh.
   */
  enroll(input: EnrollInput): number {
    return this.transaction(() => {
      const cls = this.sqlite
        .prepare(
          `SELECT cl.id, cl.max_students AS maxStudents, co.tuition_fee AS fee
           FROM classes cl JOIN courses co ON co.id = cl.course_id
           WHERE cl.id = ? AND cl.deleted_at IS NULL`
        )
        .get(input.classId) as { id: number; maxStudents: number; fee: number } | undefined
      if (!cls) throw AppError.notFound('Lớp học')

      const currentCount = (
        this.sqlite
          .prepare(`SELECT COUNT(*) AS c FROM enrollments WHERE class_id = ? AND deleted_at IS NULL`)
          .get(input.classId) as { c: number }
      ).c

      const ids = [...new Set(input.studentIds)]
      if (currentCount + ids.length > cls.maxStudents) {
        throw AppError.validation(
          `Vượt sĩ số tối đa (${cls.maxStudents}). Lớp còn ${cls.maxStudents - currentCount} chỗ.`
        )
      }

      const now = Date.now()
      const insert = this.sqlite.prepare(
        `INSERT INTO enrollments
          (student_id, class_id, enroll_date, status, agreed_fee, discount, note,
           created_at, updated_at, deleted_at)
         VALUES (?,?,?,'studying',?,?,?,?,?,NULL)
         ON CONFLICT(student_id, class_id) DO UPDATE SET
           deleted_at = NULL, status = 'studying', updated_at = excluded.updated_at`
      )

      let inserted = 0
      for (const studentId of ids) {
        const res = insert.run(
          studentId,
          input.classId,
          input.enrollDate,
          cls.fee,
          Math.max(0, Math.round(input.discount || 0)),
          input.note?.trim() || null,
          now,
          now
        )
        if (res.changes > 0) inserted++
      }
      return inserted
    })
  }

  /**
   * Xếp học viên vào lớp hàng loạt từ file Excel.
   *
   * Chỉ khớp học viên ĐÃ tồn tại và đang hoạt động, theo thứ tự ưu tiên
   * Mã HV → SĐT → Họ tên. Mỗi dòng xử lý độc lập: dòng lỗi được ghi lại kèm
   * số dòng trong file để người dùng sửa đúng chỗ, không làm hỏng cả mẻ.
   *
   * Sĩ số được kiểm liên tục trong lúc chạy — khi đầy lớp, các dòng còn lại
   * đều báo "vượt sĩ số" thay vì âm thầm bỏ qua.
   */
  enrollImport(input: EnrollImportInput): ImportResult {
    const result: ImportResult = { total: input.rows.length, inserted: 0, failed: 0, errors: [] }
    if (input.rows.length > 2000) {
      throw AppError.validation('Mỗi lần chỉ nhập tối đa 2.000 dòng.')
    }

    return this.transaction(() => {
      const cls = this.sqlite
        .prepare(
          `SELECT cl.id, cl.max_students AS maxStudents, co.tuition_fee AS fee
           FROM classes cl JOIN courses co ON co.id = cl.course_id
           WHERE cl.id = ? AND cl.deleted_at IS NULL`
        )
        .get(input.classId) as { id: number; maxStudents: number; fee: number } | undefined
      if (!cls) throw AppError.notFound('Lớp học')

      let currentCount = (
        this.sqlite
          .prepare(`SELECT COUNT(*) AS c FROM enrollments WHERE class_id = ? AND deleted_at IS NULL`)
          .get(input.classId) as { c: number }
      ).c

      const studentCols = `id, code, full_name AS fullName`
      const findByCode = this.sqlite.prepare(
        `SELECT ${studentCols} FROM students WHERE deleted_at IS NULL AND status = 'active' AND code = ? LIMIT 2`
      )
      const findByPhone = this.sqlite.prepare(
        `SELECT ${studentCols} FROM students WHERE deleted_at IS NULL AND status = 'active' AND phone = ? LIMIT 2`
      )
      const findByName = this.sqlite.prepare(
        `SELECT ${studentCols} FROM students WHERE deleted_at IS NULL AND status = 'active' AND full_name = ? LIMIT 2`
      )
      const stateStmt = this.sqlite.prepare(
        `SELECT deleted_at AS deletedAt FROM enrollments WHERE class_id = ? AND student_id = ?`
      )
      const insert = this.sqlite.prepare(
        `INSERT INTO enrollments
          (student_id, class_id, enroll_date, status, agreed_fee, discount, note,
           created_at, updated_at, deleted_at)
         VALUES (?,?,?,'studying',?,?,?,?,?,NULL)
         ON CONFLICT(student_id, class_id) DO UPDATE SET
           deleted_at = NULL, status = 'studying', updated_at = excluded.updated_at`
      )

      const now = Date.now()
      const seen = new Set<number>() // tránh cùng một học viên xuất hiện hai lần trong file

      type Match = { id: number; code: string; fullName: string }

      input.rows.forEach((row, index) => {
        // +2 vì hàng 1 là tiêu đề và Excel đánh số từ 1
        const rowNumber = index + 2
        try {
          const code = row.code?.toString().trim()
          const phone = row.phone?.toString().trim()
          const name = row.fullName?.toString().trim()
          if (!code && !phone && !name) {
            throw new Error('Thiếu thông tin nhận diện (cần Mã HV, SĐT hoặc Họ tên)')
          }

          let matches: Match[] = []
          if (code) matches = findByCode.all(code) as Match[]
          if (matches.length === 0 && phone) matches = findByPhone.all(phone) as Match[]
          if (matches.length === 0 && name) matches = findByName.all(name) as Match[]

          if (matches.length === 0) throw new Error('Không tìm thấy học viên đang hoạt động khớp dữ liệu')
          if (matches.length > 1) throw new Error('Khớp nhiều học viên — hãy điền Mã HV để chính xác')

          const student = matches[0]
          if (seen.has(student.id)) throw new Error('Học viên bị lặp trong file')

          const state = stateStmt.get(input.classId, student.id) as { deletedAt: number | null } | undefined
          if (state && state.deletedAt === null) throw new Error('Học viên đã có trong lớp')

          if (currentCount + 1 > cls.maxStudents) {
            throw new Error(`Vượt sĩ số tối đa (${cls.maxStudents})`)
          }

          const res = insert.run(
            student.id,
            input.classId,
            input.enrollDate,
            cls.fee,
            parseMoney(row.discount),
            row.note?.toString().trim() || null,
            now,
            now
          )
          if (res.changes === 0) throw new Error('Không ghi danh được học viên này')

          result.inserted++
          currentCount++
          seen.add(student.id)
        } catch (err) {
          result.failed++
          result.errors.push({
            row: rowNumber,
            message: err instanceof Error ? err.message : String(err)
          })
        }
      })

      return result
    })
  }

  unenroll(enrollmentId: number): boolean {
    const paid = this.sqlite
      .prepare(
        `SELECT COALESCE(SUM(amount),0) AS total FROM payments
         WHERE enrollment_id = ? AND deleted_at IS NULL AND status <> 'refunded'`
      )
      .get(enrollmentId) as { total: number }

    if (paid.total > 0) {
      throw AppError.conflict(
        'Học viên đã đóng học phí cho lớp này. Hãy xử lý hoàn tiền hoặc chuyển trạng thái sang "Đã rút" thay vì gỡ khỏi lớp.'
      )
    }

    const res = this.sqlite
      .prepare(`DELETE FROM enrollments WHERE id = ? AND deleted_at IS NULL`)
      .run(enrollmentId)
    return res.changes > 0
  }

  /** Danh sách học viên của lớp — dùng khi sinh bảng điểm danh */
  studentIdsOfClass(classId: number): number[] {
    const rows = this.sqlite
      .prepare(
        `SELECT student_id AS studentId FROM enrollments
         WHERE class_id = ? AND deleted_at IS NULL AND status = 'studying'`
      )
      .all(classId) as { studentId: number }[]
    return rows.map((r) => r.studentId)
  }
}

/**
 * Chuẩn hoá ô "Giảm học phí" từ Excel về số nguyên không âm.
 * Chấp nhận cả số lẫn chuỗi kiểu Việt Nam ("1.000.000", "500.000 ₫").
 */
function parseMoney(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  const digits = String(value).replace(/[^\d]/g, '')
  if (!digits) return 0
  const n = Number(digits)
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0
}

export const classRepository = new ClassRepository()
