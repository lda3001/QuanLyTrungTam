import type Database from 'better-sqlite3'

/**
 * Migration chạy lúc khởi động ứng dụng.
 *
 * Vì sao không dùng thẳng thư mục /drizzle do drizzle-kit sinh ra?
 * Ứng dụng desktop được đóng gói vào asar — đọc file SQL từ trong gói dễ hỏng
 * khi đổi cấu hình đóng gói. Nhúng DDL thành mã nguồn thì bản build luôn tự
 * chứa đủ, không bao giờ thiếu file. drizzle-kit vẫn hữu ích để đối chiếu
 * schema (`npm run db:generate`).
 *
 * Cơ chế: dùng PRAGMA user_version của SQLite làm số phiên bản schema.
 * Mỗi migration chỉ chạy đúng một lần, trong một transaction.
 */

interface Migration {
  version: number
  name: string
  statements: string[]
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    statements: [
      `CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS roles_code_unique ON roles (code)`,
      `CREATE INDEX IF NOT EXISTS roles_deleted_idx ON roles (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        group_key TEXT NOT NULL DEFAULT 'other',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS permissions_code_unique ON permissions (code)`,
      `CREATE INDEX IF NOT EXISTS permissions_group_idx ON permissions (group_key)`,

      `CREATE TABLE IF NOT EXISTS role_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_code TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS role_permissions_role_idx ON role_permissions (role_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_unique ON role_permissions (role_id, permission_code)`,

      `CREATE TABLE IF NOT EXISTS teachers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        full_name TEXT NOT NULL,
        gender TEXT NOT NULL DEFAULT 'male',
        birth_date TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        specialization TEXT,
        degree TEXT,
        salary INTEGER NOT NULL DEFAULT 0,
        hire_date TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS teachers_code_unique ON teachers (code)`,
      `CREATE INDEX IF NOT EXISTS teachers_name_idx ON teachers (full_name)`,
      `CREATE INDEX IF NOT EXISTS teachers_status_idx ON teachers (status)`,
      `CREATE INDEX IF NOT EXISTS teachers_deleted_idx ON teachers (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        role_id INTEGER NOT NULL REFERENCES roles(id),
        teacher_id INTEGER REFERENCES teachers(id),
        avatar TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_login_at INTEGER,
        security_question TEXT,
        security_answer_hash TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique ON users (username)`,
      `CREATE INDEX IF NOT EXISTS users_role_idx ON users (role_id)`,
      `CREATE INDEX IF NOT EXISTS users_deleted_idx ON users (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        full_name TEXT NOT NULL,
        gender TEXT NOT NULL DEFAULT 'male',
        birth_date TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        guardian_name TEXT,
        guardian_phone TEXT,
        note TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        avatar TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS students_code_unique ON students (code)`,
      `CREATE INDEX IF NOT EXISTS students_name_idx ON students (full_name)`,
      `CREATE INDEX IF NOT EXISTS students_phone_idx ON students (phone)`,
      `CREATE INDEX IF NOT EXISTS students_status_idx ON students (status)`,
      `CREATE INDEX IF NOT EXISTS students_deleted_idx ON students (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        tuition_fee INTEGER NOT NULL DEFAULT 0,
        duration_hours INTEGER NOT NULL DEFAULT 0,
        total_sessions INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS courses_code_unique ON courses (code)`,
      `CREATE INDEX IF NOT EXISTS courses_name_idx ON courses (name)`,
      `CREATE INDEX IF NOT EXISTS courses_deleted_idx ON courses (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        course_id INTEGER NOT NULL REFERENCES courses(id),
        teacher_id INTEGER REFERENCES teachers(id),
        room TEXT,
        start_date TEXT,
        end_date TEXT,
        max_students INTEGER NOT NULL DEFAULT 30,
        status TEXT NOT NULL DEFAULT 'planned',
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS classes_code_unique ON classes (code)`,
      `CREATE INDEX IF NOT EXISTS classes_course_idx ON classes (course_id)`,
      `CREATE INDEX IF NOT EXISTS classes_teacher_idx ON classes (teacher_id)`,
      `CREATE INDEX IF NOT EXISTS classes_status_idx ON classes (status)`,
      `CREATE INDEX IF NOT EXISTS classes_deleted_idx ON classes (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS class_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        weekday INTEGER NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        room TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS class_schedules_class_idx ON class_schedules (class_id)`,
      `CREATE INDEX IF NOT EXISTS class_schedules_deleted_idx ON class_schedules (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS class_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        session_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        room TEXT,
        teacher_id INTEGER REFERENCES teachers(id),
        topic TEXT,
        status TEXT NOT NULL DEFAULT 'scheduled',
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS class_sessions_class_idx ON class_sessions (class_id)`,
      `CREATE INDEX IF NOT EXISTS class_sessions_date_idx ON class_sessions (session_date)`,
      `CREATE INDEX IF NOT EXISTS class_sessions_teacher_idx ON class_sessions (teacher_id)`,
      `CREATE INDEX IF NOT EXISTS class_sessions_deleted_idx ON class_sessions (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL REFERENCES students(id),
        class_id INTEGER NOT NULL REFERENCES classes(id),
        enroll_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'studying',
        agreed_fee INTEGER NOT NULL DEFAULT 0,
        discount INTEGER NOT NULL DEFAULT 0,
        note TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS enrollments_student_idx ON enrollments (student_id)`,
      `CREATE INDEX IF NOT EXISTS enrollments_class_idx ON enrollments (class_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS enrollments_student_class_unique ON enrollments (student_id, class_id)`,
      `CREATE INDEX IF NOT EXISTS enrollments_deleted_idx ON enrollments (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
        student_id INTEGER NOT NULL REFERENCES students(id),
        status TEXT NOT NULL DEFAULT 'present',
        note TEXT,
        marked_by INTEGER REFERENCES users(id),
        marked_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS attendance_session_idx ON attendance (session_id)`,
      `CREATE INDEX IF NOT EXISTS attendance_student_idx ON attendance (student_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS attendance_session_student_unique ON attendance (session_id, student_id)`,
      `CREATE INDEX IF NOT EXISTS attendance_deleted_idx ON attendance (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        student_id INTEGER NOT NULL REFERENCES students(id),
        enrollment_id INTEGER REFERENCES enrollments(id),
        amount INTEGER NOT NULL DEFAULT 0,
        method TEXT NOT NULL DEFAULT 'cash',
        status TEXT NOT NULL DEFAULT 'paid',
        paid_date TEXT NOT NULL,
        note TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS payments_code_unique ON payments (code)`,
      `CREATE INDEX IF NOT EXISTS payments_student_idx ON payments (student_id)`,
      `CREATE INDEX IF NOT EXISTS payments_enrollment_idx ON payments (enrollment_id)`,
      `CREATE INDEX IF NOT EXISTS payments_date_idx ON payments (paid_date)`,
      `CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status)`,
      `CREATE INDEX IF NOT EXISTS payments_deleted_idx ON payments (deleted_at)`,

      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL,
        value TEXT NOT NULL DEFAULT '',
        group_key TEXT NOT NULL DEFAULT 'general',
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS settings_key_unique ON settings (key)`,

      `CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        username TEXT,
        action TEXT NOT NULL,
        entity TEXT NOT NULL,
        entity_id INTEGER,
        description TEXT,
        ip_address TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
      `CREATE INDEX IF NOT EXISTS logs_user_idx ON logs (user_id)`,
      `CREATE INDEX IF NOT EXISTS logs_entity_idx ON logs (entity)`,
      `CREATE INDEX IF NOT EXISTS logs_created_idx ON logs (created_at)`
    ]
  },

  {
    version: 2,
    name: 'student-school-class',
    statements: [
      // Lớp của học sinh ở TRƯỜNG phổ thông (10A1, 6A3...), khác với lớp học
      // tại trung tâm. Cột cho phép NULL nên dữ liệu cũ không cần điền lại.
      `ALTER TABLE students ADD COLUMN school_class TEXT`,
      `CREATE INDEX IF NOT EXISTS students_school_class_idx ON students (school_class)`
    ]
  }
]

export function runMigrations(sqlite: Database.Database): void {
  const current = sqlite.pragma('user_version', { simple: true }) as number
  const pending = MIGRATIONS.filter((m) => m.version > current).sort((a, b) => a.version - b.version)

  if (pending.length === 0) return

  for (const migration of pending) {
    const apply = sqlite.transaction(() => {
      for (const stmt of migration.statements) sqlite.exec(stmt)
      // PRAGMA không nhận tham số bind — số phiên bản lấy từ hằng số nội bộ nên an toàn
      sqlite.pragma(`user_version = ${migration.version}`)
    })
    apply()
    console.info(`[db] Đã áp dụng migration v${migration.version} — ${migration.name}`)
  }
}
