import { BaseRepository } from './base.repository'
import type { AppSetting, CenterSettings } from '@shared/types/entities'

const DEFAULTS: CenterSettings = {
  centerName: 'Trung Tâm Đào Tạo',
  centerAddress: '',
  centerPhone: '',
  centerEmail: '',
  centerTaxCode: '',
  receiptPrefix: 'PT',
  studentPrefix: 'HV',
  teacherPrefix: 'GV',
  currency: 'VND'
}

export class SettingRepository extends BaseRepository<AppSetting> {
  protected readonly tableName = 'settings'
  protected readonly selectColumns = `
    id, key, value, group_key AS "group", description,
    created_at AS createdAt, updated_at AS updatedAt, deleted_at AS deletedAt`

  getAll(): AppSetting[] {
    return this.sqlite
      .prepare(`SELECT ${this.selectColumns} FROM settings WHERE deleted_at IS NULL ORDER BY group_key, key`)
      .all() as AppSetting[]
  }

  /** Trả về object đã có sẵn giá trị mặc định — nơi gọi không cần kiểm tra null */
  getCenterSettings(): CenterSettings {
    const rows = this.sqlite.prepare(`SELECT key, value FROM settings WHERE deleted_at IS NULL`).all() as {
      key: string
      value: string
    }[]

    const map = new Map(rows.map((r) => [r.key, r.value]))
    const result = { ...DEFAULTS }
    for (const key of Object.keys(DEFAULTS) as (keyof CenterSettings)[]) {
      const v = map.get(key)
      if (v !== undefined && v !== '') result[key] = v
    }
    return result
  }

  getValue(key: string, fallback = ''): string {
    const row = this.sqlite
      .prepare(`SELECT value FROM settings WHERE key = ? AND deleted_at IS NULL`)
      .get(key) as { value: string } | undefined
    return row?.value ?? fallback
  }

  updateMany(values: Record<string, string>): void {
    this.transaction(() => {
      const now = Date.now()
      const upsert = this.sqlite.prepare(
        `INSERT INTO settings (key, value, group_key, description, created_at, updated_at, deleted_at)
         VALUES (?,?,'general',NULL,?,?,NULL)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      for (const [key, value] of Object.entries(values)) {
        upsert.run(key, String(value ?? ''), now, now)
      }
    })
  }
}

export const settingRepository = new SettingRepository()
