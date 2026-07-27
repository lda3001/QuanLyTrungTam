import { BaseRepository } from './base.repository'
import type {
  AttendanceReportRow,
  DashboardData,
  DashboardSummary,
  PaymentRatioRow,
  ReportRange,
  RevenueByMonthRow,
  RevenueReport,
  RevenueReportRow,
  StudentReportRow,
  StudentsByCourseRow,
  TeacherReportRow,
  TodaySessionRow,
  TuitionReportRow
} from '@shared/types/dto'
import type { PaymentMethod } from '@shared/constants/enums'

/**
 * Repository chuyên cho thống kê & báo cáo.
 *
 * Toàn bộ mốc thời gian ('hôm nay', 'tháng này') được tính bằng JavaScript rồi
 * truyền vào SQL dưới dạng tham số. Không dùng date('now') của SQLite vì hàm đó
 * chạy theo UTC — máy ở Việt Nam (UTC+7) sẽ lệch ngày vào buổi tối.
 */
export class AnalyticsRepository extends BaseRepository<{ id: number }> {
  protected readonly tableName = 'payments'
  protected readonly selectColumns = 'id'

  dashboard(today: string, monthKey: string, prevMonthKey: string, months: string[]): DashboardData {
    return {
      summary: this.summary(today, monthKey, prevMonthKey),
      revenueByMonth: this.revenueByMonth(months),
      studentsByCourse: this.studentsByCourse(),
      paymentRatio: this.paymentRatio(),
      todaySessions: this.todaySessions(today),
      recentPayments: this.recentPayments()
    }
  }

  private summary(today: string, monthKey: string, prevMonthKey: string): DashboardSummary {
    const one = <T>(sql: string, ...params: unknown[]): T =>
      this.sqlite.prepare(sql).get(...(params as never[])) as T

    const students = one<{ total: number; active: number }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
       FROM students WHERE deleted_at IS NULL`
    )

    const teachers = one<{ c: number }>(
      `SELECT COUNT(*) AS c FROM teachers WHERE deleted_at IS NULL AND status = 'active'`
    )

    const classes = one<{ total: number; ongoing: number }>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) AS ongoing
       FROM classes WHERE deleted_at IS NULL`
    )

    const revenue = one<{ amount: number }>(
      `SELECT COALESCE(SUM(amount),0) AS amount FROM payments
       WHERE deleted_at IS NULL AND status <> 'refunded' AND substr(paid_date,1,7) = ?`,
      monthKey
    )

    const prevRevenue = one<{ amount: number }>(
      `SELECT COALESCE(SUM(amount),0) AS amount FROM payments
       WHERE deleted_at IS NULL AND status <> 'refunded' AND substr(paid_date,1,7) = ?`,
      prevMonthKey
    )

    // Công nợ toàn hệ thống: tổng phần còn thiếu của mọi lần ghi danh chưa rút
    const debt = one<{ amount: number; c: number }>(
      `SELECT
         COALESCE(SUM(MAX(0, e.agreed_fee - e.discount - COALESCE(pay.paid,0))), 0) AS amount,
         COUNT(*) AS c
       FROM enrollments e
       LEFT JOIN (
         SELECT enrollment_id, SUM(amount) AS paid FROM payments
         WHERE deleted_at IS NULL AND status <> 'refunded'
         GROUP BY enrollment_id
       ) pay ON pay.enrollment_id = e.id
       WHERE e.deleted_at IS NULL AND e.status <> 'withdrawn'
         AND (e.agreed_fee - e.discount - COALESCE(pay.paid,0)) > 0`
    )

    const sessions = one<{ c: number }>(
      `SELECT COUNT(*) AS c FROM class_sessions
       WHERE deleted_at IS NULL AND session_date = ? AND status <> 'cancelled'`,
      today
    )

    return {
      totalStudents: students.total ?? 0,
      activeStudents: students.active ?? 0,
      totalTeachers: teachers.c ?? 0,
      totalClasses: classes.total ?? 0,
      ongoingClasses: classes.ongoing ?? 0,
      monthRevenue: revenue.amount ?? 0,
      prevMonthRevenue: prevRevenue.amount ?? 0,
      unpaidAmount: debt.amount ?? 0,
      unpaidCount: debt.c ?? 0,
      todaySessions: sessions.c ?? 0
    }
  }

  /** Doanh thu 12 tháng gần nhất — luôn trả đủ 12 điểm, tháng trống = 0 */
  private revenueByMonth(months: string[]): RevenueByMonthRow[] {
    if (months.length === 0) return []
    const placeholders = months.map(() => '?').join(',')

    const rows = this.sqlite
      .prepare(
        `SELECT substr(paid_date,1,7) AS month, COALESCE(SUM(amount),0) AS revenue
         FROM payments
         WHERE deleted_at IS NULL AND status <> 'refunded' AND substr(paid_date,1,7) IN (${placeholders})
         GROUP BY month`
      )
      .all(...months) as { month: string; revenue: number }[]

    const map = new Map(rows.map((r) => [r.month, r.revenue]))
    return months.map((m) => ({ month: m, revenue: map.get(m) ?? 0 }))
  }

  private studentsByCourse(): StudentsByCourseRow[] {
    return this.sqlite
      .prepare(
        `SELECT co.name AS courseName, COUNT(DISTINCT e.student_id) AS students
         FROM courses co
         JOIN classes cl ON cl.course_id = co.id AND cl.deleted_at IS NULL
         JOIN enrollments e ON e.class_id = cl.id AND e.deleted_at IS NULL
         WHERE co.deleted_at IS NULL
         GROUP BY co.id
         HAVING students > 0
         ORDER BY students DESC
         LIMIT 8`
      )
      .all() as StudentsByCourseRow[]
  }

  private paymentRatio(): PaymentRatioRow[] {
    const row = this.sqlite
      .prepare(
        `SELECT
           SUM(CASE WHEN COALESCE(pay.paid,0) >= (e.agreed_fee - e.discount) THEN 1 ELSE 0 END) AS paid,
           SUM(CASE WHEN COALESCE(pay.paid,0) > 0
                     AND COALESCE(pay.paid,0) < (e.agreed_fee - e.discount) THEN 1 ELSE 0 END) AS partial,
           SUM(CASE WHEN COALESCE(pay.paid,0) <= 0 THEN 1 ELSE 0 END) AS unpaid
         FROM enrollments e
         LEFT JOIN (
           SELECT enrollment_id, SUM(amount) AS paid FROM payments
           WHERE deleted_at IS NULL AND status <> 'refunded'
           GROUP BY enrollment_id
         ) pay ON pay.enrollment_id = e.id
         WHERE e.deleted_at IS NULL AND e.status <> 'withdrawn'`
      )
      .get() as { paid: number | null; partial: number | null; unpaid: number | null }

    return [
      { name: 'Đã đóng đủ', value: row.paid ?? 0, key: 'paid' },
      { name: 'Đóng một phần', value: row.partial ?? 0, key: 'partial' },
      { name: 'Chưa đóng', value: row.unpaid ?? 0, key: 'unpaid' }
    ]
  }

  private todaySessions(today: string): TodaySessionRow[] {
    return this.sqlite
      .prepare(
        `SELECT cs.id, cl.name AS className, co.name AS courseName,
                COALESCE(t.full_name, tc.full_name) AS teacherName,
                cs.room, cs.start_time AS startTime, cs.end_time AS endTime, cs.status,
                (SELECT COUNT(*) FROM enrollments e
                  WHERE e.class_id = cs.class_id AND e.deleted_at IS NULL
                    AND e.status = 'studying') AS studentCount
         FROM class_sessions cs
         JOIN classes cl ON cl.id = cs.class_id
         JOIN courses co ON co.id = cl.course_id
         LEFT JOIN teachers t ON t.id = cs.teacher_id
         LEFT JOIN teachers tc ON tc.id = cl.teacher_id
         WHERE cs.deleted_at IS NULL AND cs.session_date = ?
         ORDER BY cs.start_time`
      )
      .all(today) as TodaySessionRow[]
  }

  private recentPayments(): DashboardData['recentPayments'] {
    return this.sqlite
      .prepare(
        `SELECT p.id, p.code, s.full_name AS studentName, p.amount,
                p.paid_date AS paidDate, p.method
         FROM payments p JOIN students s ON s.id = p.student_id
         WHERE p.deleted_at IS NULL
         ORDER BY p.created_at DESC LIMIT 8`
      )
      .all() as DashboardData['recentPayments']
  }

  /* ======================= BÁO CÁO ======================= */

  revenueReport(range: ReportRange, groupBy: 'day' | 'month'): RevenueReport {
    // substr an toàn vì groupBy đã được ràng buộc bởi kiểu union, không phải input tự do
    const periodExpr = groupBy === 'day' ? 'paid_date' : 'substr(paid_date,1,7)'

    const rows = this.sqlite
      .prepare(
        `SELECT ${periodExpr} AS period, COUNT(*) AS transactions, COALESCE(SUM(amount),0) AS revenue
         FROM payments
         WHERE deleted_at IS NULL AND status <> 'refunded' AND paid_date BETWEEN ? AND ?
         GROUP BY period ORDER BY period`
      )
      .all(range.from, range.to) as RevenueReportRow[]

    const byMethod = this.sqlite
      .prepare(
        `SELECT method, COALESCE(SUM(amount),0) AS amount, COUNT(*) AS count
         FROM payments
         WHERE deleted_at IS NULL AND status <> 'refunded' AND paid_date BETWEEN ? AND ?
         GROUP BY method`
      )
      .all(range.from, range.to) as { method: PaymentMethod; amount: number; count: number }[]

    return {
      rows,
      totalRevenue: rows.reduce((s, r) => s + r.revenue, 0),
      totalTransactions: rows.reduce((s, r) => s + r.transactions, 0),
      byMethod
    }
  }

  tuitionReport(range: ReportRange): TuitionReportRow[] {
    const rows = this.sqlite
      .prepare(
        `SELECT
           cl.id AS classId, cl.name AS className, co.name AS courseName,
           COUNT(e.id) AS students,
           COALESCE(SUM(e.agreed_fee - e.discount),0) AS payable,
           COALESCE(SUM(pay.paid),0) AS paid
         FROM classes cl
         JOIN courses co ON co.id = cl.course_id
         LEFT JOIN enrollments e ON e.class_id = cl.id AND e.deleted_at IS NULL
           AND e.enroll_date BETWEEN ? AND ?
         LEFT JOIN (
           SELECT enrollment_id, SUM(amount) AS paid FROM payments
           WHERE deleted_at IS NULL AND status <> 'refunded'
           GROUP BY enrollment_id
         ) pay ON pay.enrollment_id = e.id
         WHERE cl.deleted_at IS NULL
         GROUP BY cl.id
         HAVING students > 0
         ORDER BY (COALESCE(SUM(e.agreed_fee - e.discount),0) - COALESCE(SUM(pay.paid),0)) DESC`
      )
      .all(range.from, range.to) as Omit<TuitionReportRow, 'remaining' | 'rate'>[]

    return rows.map((r) => ({
      ...r,
      remaining: r.payable - r.paid,
      rate: r.payable > 0 ? Math.round((r.paid / r.payable) * 1000) / 10 : 0
    }))
  }

  attendanceReport(range: ReportRange): AttendanceReportRow[] {
    const rows = this.sqlite
      .prepare(
        `SELECT
           cl.id AS classId, cl.name AS className,
           COUNT(DISTINCT cs.id) AS sessions,
           SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) AS present,
           SUM(CASE WHEN a.status = 'excused' THEN 1 ELSE 0 END) AS excused,
           SUM(CASE WHEN a.status = 'absent'  THEN 1 ELSE 0 END) AS absent,
           SUM(CASE WHEN a.status = 'late'    THEN 1 ELSE 0 END) AS late
         FROM classes cl
         JOIN class_sessions cs ON cs.class_id = cl.id AND cs.deleted_at IS NULL
           AND cs.session_date BETWEEN ? AND ?
         LEFT JOIN attendance a ON a.session_id = cs.id AND a.deleted_at IS NULL
         WHERE cl.deleted_at IS NULL
         GROUP BY cl.id
         ORDER BY cl.name`
      )
      .all(range.from, range.to) as Omit<AttendanceReportRow, 'rate'>[]

    return rows.map((r) => {
      const total = r.present + r.excused + r.absent + r.late
      return { ...r, rate: total > 0 ? Math.round(((r.present + r.late) / total) * 1000) / 10 : 0 }
    })
  }

  studentReport(range: ReportRange): StudentReportRow[] {
    const rows = this.sqlite
      .prepare(
        `SELECT
           substr(e.enroll_date,1,7) AS period,
           COUNT(DISTINCT e.student_id) AS newStudents
         FROM enrollments e
         WHERE e.deleted_at IS NULL AND e.enroll_date BETWEEN ? AND ?
         GROUP BY period ORDER BY period`
      )
      .all(range.from, range.to) as { period: string; newStudents: number }[]

    const dropped = this.sqlite
      .prepare(
        `SELECT substr(e.enroll_date,1,7) AS period, COUNT(*) AS dropped
         FROM enrollments e
         WHERE e.deleted_at IS NULL AND e.status = 'withdrawn' AND e.enroll_date BETWEEN ? AND ?
         GROUP BY period`
      )
      .all(range.from, range.to) as { period: string; dropped: number }[]

    const droppedMap = new Map(dropped.map((d) => [d.period, d.dropped]))

    let running = 0
    return rows.map((r) => {
      running += r.newStudents - (droppedMap.get(r.period) ?? 0)
      return {
        period: r.period,
        newStudents: r.newStudents,
        dropped: droppedMap.get(r.period) ?? 0,
        totalActive: running
      }
    })
  }

  teacherReport(range: ReportRange): TeacherReportRow[] {
    return this.sqlite
      .prepare(
        `SELECT
           t.id AS teacherId, t.full_name AS teacherName, t.salary,
           COUNT(DISTINCT cl.id) AS classes,
           COUNT(DISTINCT cs.id) AS sessions,
           COUNT(DISTINCT e.student_id) AS students
         FROM teachers t
         LEFT JOIN classes cl ON cl.teacher_id = t.id AND cl.deleted_at IS NULL
         LEFT JOIN class_sessions cs ON cs.class_id = cl.id AND cs.deleted_at IS NULL
           AND cs.session_date BETWEEN ? AND ? AND cs.status = 'done'
         LEFT JOIN enrollments e ON e.class_id = cl.id AND e.deleted_at IS NULL
         WHERE t.deleted_at IS NULL
         GROUP BY t.id
         ORDER BY sessions DESC, t.full_name`
      )
      .all(range.from, range.to) as TeacherReportRow[]
  }
}

export const analyticsRepository = new AnalyticsRepository()
