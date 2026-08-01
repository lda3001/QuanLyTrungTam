import type Database from 'better-sqlite3'
import { sql } from 'drizzle-orm'
import type { DB } from './connection'
import {
  attendance,
  classSchedules,
  classSessions,
  classes,
  courses,
  enrollments,
  payments,
  permissions,
  rolePermissions,
  roles,
  settings,
  students,
  teachers,
  users
} from './schema'
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  ROLE_CODES,
  ROLE_LABELS
} from '@shared/constants/permissions'
import { hashPassword, hashSecurityAnswer } from '../utils/crypto'

/**
 * Seed dữ liệu khởi tạo. Chạy mỗi lần mở app nhưng có kiểm tra tồn tại,
 * nên an toàn khi chạy lại (idempotent).
 *
 * Gồm 3 tầng:
 *  1. Bắt buộc  : danh mục quyền, 4 vai trò, tài khoản admin, cấu hình mặc định
 *  2. Tuỳ chọn  : dữ liệu mẫu (chỉ tạo khi database hoàn toàn trống)
 */
export function seedDatabase(db: DB, sqlite: Database.Database): void {
  const now = Date.now()

  seedPermissions(db, now)
  seedRoles(db, now)
  seedAdminUser(db, now)
  seedSettings(db, now)

  const studentCount = sqlite.prepare('SELECT COUNT(*) AS c FROM students').get() as { c: number }
  if (studentCount.c === 0) {
    seedDemoData(db, sqlite, now)
  }
}

/* ------------------------------------------------------------------ */

function seedPermissions(db: DB, now: number): void {
  const groupOf = new Map<string, string>()
  for (const g of PERMISSION_GROUPS) {
    for (const p of g.permissions) groupOf.set(p, g.key)
  }

  const rows = ALL_PERMISSIONS.map((code) => ({
    code,
    name: PERMISSION_LABELS[code] ?? code,
    groupKey: groupOf.get(code) ?? 'other',
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }))

  // onConflictDoNothing: chạy lại không nhân bản, và tự thêm quyền mới ở bản cập nhật
  db.insert(permissions).values(rows).onConflictDoNothing().run()
}

function seedRoles(db: DB, now: number): void {
  const existing = db.select({ id: roles.id, code: roles.code }).from(roles).all()
  const byCode = new Map(existing.map((r) => [r.code, r.id]))

  for (const code of Object.values(ROLE_CODES)) {
    let roleId = byCode.get(code)

    if (!roleId) {
      const inserted = db
        .insert(roles)
        .values({
          code,
          name: ROLE_LABELS[code] ?? code,
          description: `Vai trò ${ROLE_LABELS[code] ?? code}`,
          isSystem: 1,
          createdAt: now,
          updatedAt: now,
          deletedAt: null
        })
        .returning({ id: roles.id })
        .get()
      roleId = inserted.id
    }

    const perms = DEFAULT_ROLE_PERMISSIONS[code].map((permissionCode) => ({
      roleId: roleId as number,
      permissionCode,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    }))
    if (perms.length > 0) {
      db.insert(rolePermissions).values(perms).onConflictDoNothing().run()
    }
  }
}

function seedAdminUser(db: DB, now: number): void {
  const count = db.select({ c: sql<number>`count(*)` }).from(users).get()
  if (count && count.c > 0) return

  const adminRole = db.select().from(roles).where(sql`${roles.code} = 'admin'`).get()
  if (!adminRole) return

  db.insert(users)
    .values({
      username: 'admin',
      // Mật khẩu mặc định — màn hình đăng nhập có nhắc người dùng đổi ngay
      passwordHash: hashPassword('admin123'),
      fullName: 'Quản trị viên',
      email: 'admin@trungtam.vn',
      phone: null,
      roleId: adminRole.id,
      teacherId: null,
      avatar: null,
      isActive: 1,
      lastLoginAt: null,
      securityQuestion: 'Tên trung tâm của bạn là gì?',
      securityAnswerHash: hashSecurityAnswer('trung tam'),
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    .onConflictDoNothing()
    .run()

  console.info('[db] Đã tạo tài khoản mặc định: admin / admin123')
}

function seedSettings(db: DB, now: number): void {
  const defaults: { key: string; value: string; groupKey: string; description: string }[] = [
    { key: 'centerName', value: 'Trung Tâm Đào Tạo ABC', groupKey: 'center', description: 'Tên trung tâm' },
    { key: 'centerAddress', value: '123 Nguyễn Trãi, Thanh Xuân, Hà Nội', groupKey: 'center', description: 'Địa chỉ' },
    { key: 'centerPhone', value: '0243 123 4567', groupKey: 'center', description: 'Điện thoại' },
    { key: 'centerEmail', value: 'lienhe@trungtam.vn', groupKey: 'center', description: 'Email' },
    { key: 'centerTaxCode', value: '0101234567', groupKey: 'center', description: 'Mã số thuế' },
    { key: 'receiptPrefix', value: 'PT', groupKey: 'code', description: 'Tiền tố mã phiếu thu' },
    { key: 'studentPrefix', value: 'HV', groupKey: 'code', description: 'Tiền tố mã học viên' },
    { key: 'teacherPrefix', value: 'GV', groupKey: 'code', description: 'Tiền tố mã giáo viên' },
    { key: 'currency', value: 'VND', groupKey: 'general', description: 'Đơn vị tiền tệ' }
  ]

  db.insert(settings)
    .values(defaults.map((d) => ({ ...d, createdAt: now, updatedAt: now, deletedAt: null })))
    .onConflictDoNothing()
    .run()
}

/* ------------------------------------------------------------------ *
 * Dữ liệu mẫu — giúp Dashboard và biểu đồ có nội dung ngay lần chạy đầu
 * ------------------------------------------------------------------ */

function pad(n: number, len = 4): string {
  return String(n).padStart(len, '0')
}

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function seedDemoData(db: DB, sqlite: Database.Database, now: number): void {
  const today = new Date()
  const base = { createdAt: now, updatedAt: now, deletedAt: null }

  const run = sqlite.transaction(() => {
    /* --- Giáo viên --- */
    const teacherSeed = [
      { name: 'Nguyễn Thu Hà', spec: 'Tiếng Anh giao tiếp', degree: 'Thạc sĩ', salary: 18_000_000 },
      { name: 'Trần Minh Quân', spec: 'IELTS', degree: 'Cử nhân', salary: 22_000_000 },
      { name: 'Lê Hoàng Nam', spec: 'Toán tư duy', degree: 'Thạc sĩ', salary: 16_000_000 },
      { name: 'Phạm Thuỳ Linh', spec: 'Tin học văn phòng', degree: 'Cử nhân', salary: 14_000_000 },
      { name: 'Vũ Đức Anh', spec: 'Lập trình', degree: 'Kỹ sư', salary: 25_000_000 }
    ]
    const teacherIds: number[] = []
    teacherSeed.forEach((t, i) => {
      const row = db
        .insert(teachers)
        .values({
          code: `GV${pad(i + 1)}`,
          fullName: t.name,
          gender: i % 2 === 0 ? 'female' : 'male',
          birthDate: `199${i}-0${(i % 9) + 1}-15`,
          email: `gv${i + 1}@trungtam.vn`,
          phone: `09${pad(10000000 + i * 111111, 8)}`,
          address: 'Hà Nội',
          specialization: t.spec,
          degree: t.degree,
          salary: t.salary,
          hireDate: `202${i % 5}-03-01`,
          status: 'active',
          note: null,
          ...base
        })
        .returning({ id: teachers.id })
        .get()
      teacherIds.push(row.id)
    })

    /* --- Khoá học --- */
    const courseSeed = [
      { name: 'Tiếng Anh Giao Tiếp Cơ Bản', fee: 4_500_000, hours: 48, sessions: 24 },
      { name: 'Luyện Thi IELTS 6.5+', fee: 12_000_000, hours: 96, sessions: 48 },
      { name: 'Toán Tư Duy Tiểu Học', fee: 3_200_000, hours: 36, sessions: 18 },
      { name: 'Tin Học Văn Phòng', fee: 2_800_000, hours: 30, sessions: 15 },
      { name: 'Lập Trình Python Cho Người Mới', fee: 6_500_000, hours: 60, sessions: 30 }
    ]
    const courseIds: number[] = []
    courseSeed.forEach((c, i) => {
      const row = db
        .insert(courses)
        .values({
          code: `KH${pad(i + 1)}`,
          name: c.name,
          description: `Khoá học ${c.name} — lộ trình bài bản, lớp nhỏ, có kiểm tra định kỳ.`,
          tuitionFee: c.fee,
          durationHours: c.hours,
          totalSessions: c.sessions,
          status: 'active',
          ...base
        })
        .returning({ id: courses.id })
        .get()
      courseIds.push(row.id)
    })

    /* --- Học viên --- */
    const firstNames = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Hùng', 'Khánh', 'Lan', 'Minh']
    const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi']
    const middle = ['Văn', 'Thị', 'Đức', 'Ngọc', 'Quang', 'Thu']
    const studentIds: number[] = []

    for (let i = 0; i < 60; i++) {
      const name = `${lastNames[i % lastNames.length]} ${middle[i % middle.length]} ${firstNames[i % firstNames.length]}`
      const row = db
        .insert(students)
        .values({
          code: `HV${pad(i + 1)}`,
          fullName: name,
          gender: i % 3 === 0 ? 'female' : 'male',
          birthDate: `${2000 + (i % 12)}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
          email: `hocvien${i + 1}@gmail.com`,
          phone: `03${pad(20000000 + i * 137, 8)}`,
          address: `Số ${i + 1}, Quận ${(i % 12) + 1}, Hà Nội`,
          // Lớp ở trường phổ thông: khối 6–12, ban A/B/C/D
          schoolClass: `${6 + (i % 7)}${['A', 'B', 'C', 'D'][i % 4]}${(i % 3) + 1}`,
          guardianName: i % 2 === 0 ? `${lastNames[(i + 1) % lastNames.length]} Văn Phụ Huynh` : null,
          guardianPhone: i % 2 === 0 ? `098${pad(1000000 + i * 31, 7)}` : null,
          note: null,
          status: i % 17 === 0 ? 'inactive' : 'active',
          avatar: null,
          ...base
        })
        .returning({ id: students.id })
        .get()
      studentIds.push(row.id)
    }

    /* --- Lớp học + khung giờ --- */
    const classIds: number[] = []
    courseIds.forEach((courseId, i) => {
      const start = new Date(today)
      start.setMonth(start.getMonth() - 2)
      const end = new Date(today)
      end.setMonth(end.getMonth() + 2)

      const row = db
        .insert(classes)
        .values({
          code: `L${pad(i + 1, 3)}`,
          name: `${courseSeed[i].name.split(' ').slice(0, 3).join(' ')} - K${i + 1}`,
          courseId,
          teacherId: teacherIds[i % teacherIds.length],
          room: `P.${101 + i}`,
          startDate: ymd(start),
          endDate: ymd(end),
          maxStudents: 25,
          status: 'ongoing',
          note: null,
          ...base
        })
        .returning({ id: classes.id })
        .get()
      classIds.push(row.id)

      // Mỗi lớp học 2 buổi/tuần
      const weekdays = i % 2 === 0 ? [2, 5] : [3, 6]
      for (const weekday of weekdays) {
        db.insert(classSchedules)
          .values({
            classId: row.id,
            weekday,
            startTime: i % 2 === 0 ? '18:00' : '08:00',
            endTime: i % 2 === 0 ? '20:00' : '10:00',
            room: `P.${101 + i}`,
            ...base
          })
          .run()
      }
    })

    /* --- Ghi danh --- */
    const enrollmentIds: { id: number; studentId: number; fee: number }[] = []
    studentIds.forEach((studentId, i) => {
      const classIdx = i % classIds.length
      const fee = courseSeed[classIdx].fee
      const enrollDate = new Date(today)
      enrollDate.setDate(enrollDate.getDate() - (60 - i))

      const row = db
        .insert(enrollments)
        .values({
          studentId,
          classId: classIds[classIdx],
          enrollDate: ymd(enrollDate),
          status: 'studying',
          agreedFee: fee,
          discount: i % 10 === 0 ? 500_000 : 0,
          note: null,
          ...base
        })
        .returning({ id: enrollments.id })
        .get()
      enrollmentIds.push({ id: row.id, studentId, fee: fee - (i % 10 === 0 ? 500_000 : 0) })
    })

    /* --- Buổi học: 6 tuần gần đây + 4 tuần tới --- */
    const sessionIds: { id: number; classId: number; date: string }[] = []
    classIds.forEach((classId, ci) => {
      const weekdays = ci % 2 === 0 ? [2, 5] : [3, 6]
      for (let w = -6; w <= 4; w++) {
        for (const wd of weekdays) {
          const d = new Date(today)
          d.setDate(d.getDate() - d.getDay() + wd + w * 7)
          const dateStr = ymd(d)
          const isPast = d.getTime() < today.getTime()

          const row = db
            .insert(classSessions)
            .values({
              classId,
              sessionDate: dateStr,
              startTime: ci % 2 === 0 ? '18:00' : '08:00',
              endTime: ci % 2 === 0 ? '20:00' : '10:00',
              room: `P.${101 + ci}`,
              teacherId: teacherIds[ci % teacherIds.length],
              topic: `Buổi ${w + 7}`,
              status: isPast ? 'done' : 'scheduled',
              note: null,
              ...base
            })
            .returning({ id: classSessions.id })
            .get()
          sessionIds.push({ id: row.id, classId, date: dateStr })
        }
      }
    })

    /* --- Điểm danh cho các buổi đã diễn ra --- */
    const enrollmentsByClass = new Map<number, number[]>()
    studentIds.forEach((studentId, i) => {
      const classId = classIds[i % classIds.length]
      const arr = enrollmentsByClass.get(classId) ?? []
      arr.push(studentId)
      enrollmentsByClass.set(classId, arr)
    })

    let seedTick = 0
    for (const s of sessionIds) {
      if (new Date(s.date).getTime() >= today.getTime()) continue
      const list = enrollmentsByClass.get(s.classId) ?? []
      for (const studentId of list) {
        seedTick++
        const status =
          seedTick % 13 === 0 ? 'absent' : seedTick % 7 === 0 ? 'excused' : seedTick % 11 === 0 ? 'late' : 'present'
        db.insert(attendance)
          .values({
            sessionId: s.id,
            studentId,
            status,
            note: null,
            markedBy: 1,
            markedAt: now,
            ...base
          })
          .onConflictDoNothing()
          .run()
      }
    }

    /* --- Phiếu thu: trải đều 6 tháng gần nhất để biểu đồ có xu hướng --- */
    let receiptNo = 0
    enrollmentIds.forEach((e, i) => {
      // ~75% học viên đã đóng ít nhất một phần
      if (i % 4 === 3) return

      const full = i % 3 !== 0
      const amount = full ? e.fee : Math.round(e.fee / 2 / 100_000) * 100_000
      const d = new Date(today)
      d.setMonth(d.getMonth() - (i % 6))
      d.setDate(((i * 3) % 27) + 1)

      receiptNo++
      db.insert(payments)
        .values({
          code: `PT${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${pad(receiptNo)}`,
          studentId: e.studentId,
          enrollmentId: e.id,
          amount,
          method: i % 3 === 0 ? 'transfer' : i % 5 === 0 ? 'card' : 'cash',
          status: 'paid',
          paidDate: ymd(d),
          note: full ? 'Đóng đủ học phí' : 'Đóng đợt 1',
          createdBy: 1,
          ...base
        })
        .run()
    })
  })

  run()
  console.info('[db] Đã tạo dữ liệu mẫu (60 học viên, 5 lớp, 5 khoá học).')
}
