import { join, resolve } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import { runMigrations } from './migrations'
import { seedDatabase } from './seed'

export type DB = BetterSQLite3Database<typeof schema>

let sqlite: Database.Database | null = null
let db: DB | null = null
let dbFilePath = ''

/**
 * Vị trí file dữ liệu: thư mục userData của HĐH
 * (Windows: %APPDATA%/quanly-trungtam/data/center.db)
 *
 * Không đặt cạnh file .exe — thư mục Program Files chỉ đọc, ghi vào đó sẽ lỗi
 * quyền trên máy người dùng thật.
 */
export function getDatabasePath(): string {
  // DATABASE_DIR takes precedence for deployed/portable installations.
  const configuredDir = process.env['DATABASE_DIR']
  if (configuredDir) {
    const dir = resolve(configuredDir)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    return join(dir, 'center.db')
  }

  // Keep existing Electron installations working after moving the UI to the
  // web server. Previously, data lived under Electron's userData directory.
  // Prefer that database when it exists instead of silently creating a second,
  // empty database in the project directory.
  const appData = process.env['APPDATA']
  const legacyDir = appData ? join(appData, 'quanly-trungtam', 'data') : undefined
  if (legacyDir && existsSync(join(legacyDir, 'center.db'))) {
    return join(legacyDir, 'center.db')
  }

  const dir = resolve('data')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'center.db')
}

export function initDatabase(): DB {
  if (db) return db

  dbFilePath = getDatabasePath()
  sqlite = new Database(dbFilePath)

  // WAL: cho phép đọc song song khi đang ghi — mượt hơn hẳn khi vừa mở
  // dashboard vừa lưu dữ liệu.
  sqlite.pragma('journal_mode = WAL')
  // SQLite mặc định TẮT ràng buộc khoá ngoại. Phải bật thủ công mỗi kết nối.
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('busy_timeout = 5000')

  runMigrations(sqlite)

  db = drizzle(sqlite, { schema })
  seedDatabase(db, sqlite)

  console.info(`[db] Sẵn sàng tại ${dbFilePath}`)
  return db
}

export function getDb(): DB {
  if (!db) throw new Error('Database chưa được khởi tạo. Gọi initDatabase() trước.')
  return db
}

/** Truy cập kết nối thô — dùng cho vài truy vấn thống kê phức tạp */
export function getSqlite(): Database.Database {
  if (!sqlite) throw new Error('Database chưa được khởi tạo.')
  return sqlite
}

export function getDbFilePath(): string {
  return dbFilePath
}

export function closeDatabase(): void {
  if (sqlite) {
    // Gộp file WAL vào file chính trước khi thoát, tránh để lại -wal/-shm mồ côi
    try {
      sqlite.pragma('wal_checkpoint(TRUNCATE)')
    } catch {
      /* bỏ qua: không critical khi đang tắt app */
    }
    sqlite.close()
    sqlite = null
    db = null
  }
}
