import type Database from 'better-sqlite3'
import { getDb, getSqlite, type DB } from '../database/connection'
import { AppError } from '../utils/errors'

/**
 * Lớp nền cho mọi repository.
 *
 * Nguyên tắc xuyên suốt:
 *  - Chỉ tầng này được chạm vào SQL. Service không bao giờ viết SQL.
 *  - Mọi truy vấn đọc đều lọc `deleted_at IS NULL`.
 *  - Xoá = cập nhật `deleted_at`, không bao giờ DELETE thật.
 */
export abstract class BaseRepository<TEntity extends { id: number }> {
  protected abstract readonly tableName: string
  /** Danh sách cột kèm alias camelCase, tái sử dụng cho mọi SELECT */
  protected abstract readonly selectColumns: string

  protected get db(): DB {
    return getDb()
  }

  protected get sqlite(): Database.Database {
    return getSqlite()
  }

  findById(id: number): TEntity | undefined {
    return this.sqlite
      .prepare(
        `SELECT ${this.selectColumns} FROM ${this.tableName}
         WHERE id = ? AND deleted_at IS NULL`
      )
      .get(id) as TEntity | undefined
  }

  /** Như findById nhưng ném lỗi NOT_FOUND — dùng khi bản ghi bắt buộc phải có */
  findByIdOrFail(id: number, label = 'Bản ghi'): TEntity {
    const row = this.findById(id)
    if (!row) throw AppError.notFound(label)
    return row
  }

  exists(id: number): boolean {
    const row = this.sqlite
      .prepare(`SELECT 1 AS x FROM ${this.tableName} WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as { x: number } | undefined
    return !!row
  }

  count(where = '1=1', params: unknown[] = []): number {
    const row = this.sqlite
      .prepare(`SELECT COUNT(*) AS c FROM ${this.tableName} WHERE deleted_at IS NULL AND ${where}`)
      .get(...(params as never[])) as { c: number }
    return row.c
  }

  softDelete(id: number): boolean {
    const res = this.sqlite
      .prepare(`DELETE FROM ${this.tableName} WHERE id = ? AND deleted_at IS NULL`)
      .run(id)
    return res.changes > 0
  }

  softDeleteMany(ids: number[]): number {
    if (ids.length === 0) return 0
    const placeholders = ids.map(() => '?').join(',')
    const res = this.sqlite
      .prepare(
        `DELETE FROM ${this.tableName} WHERE id IN (${placeholders}) AND deleted_at IS NULL`
      )
      .run(...ids)
    return res.changes
  }

  /**
   * Kiểm tra trùng giá trị của một cột duy nhất (mã, username...).
   * `excludeId` dùng khi sửa: bỏ qua chính bản ghi đang sửa.
   */
  protected isDuplicate(column: string, value: string, excludeId?: number): boolean {
    const sql = excludeId
      ? `SELECT 1 AS x FROM ${this.tableName} WHERE ${column} = ? AND id <> ? LIMIT 1`
      : `SELECT 1 AS x FROM ${this.tableName} WHERE ${column} = ? LIMIT 1`
    const params = excludeId ? [value, excludeId] : [value]
    return !!this.sqlite.prepare(sql).get(...(params as never[]))
  }

  /** Bọc nhiều lệnh ghi vào một transaction — hoặc thành công hết, hoặc không gì cả */
  protected transaction<T>(fn: () => T): T {
    return this.sqlite.transaction(fn)()
  }
}
