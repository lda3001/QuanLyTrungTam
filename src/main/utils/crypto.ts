import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

/**
 * Băm mật khẩu bằng scrypt (có sẵn trong Node, không cần native module như bcrypt
 * — một dependency native ít đi là một rủi ro build ít đi cho app Electron).
 *
 * Định dạng lưu: scrypt$N$r$p$<salt-hex>$<hash-hex>
 * Nhúng tham số vào chuỗi để sau này tăng độ khó mà vẫn xác thực được hash cũ.
 */

const N = 16384 // CPU/memory cost
const r = 8 // block size
const p = 1 // parallelization
const KEY_LEN = 64
const SALT_LEN = 16

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN)
  const hash = scryptSync(plain.normalize('NFKC'), salt, KEY_LEN, { N, r, p })
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`
}

export function verifyPassword(plain: string, stored: string): boolean {
  try {
    const parts = stored.split('$')
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false

    const [, sN, sR, sP, saltHex, hashHex] = parts
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    const actual = scryptSync(plain.normalize('NFKC'), salt, expected.length, {
      N: Number(sN),
      r: Number(sR),
      p: Number(sP)
    })

    // So sánh thời gian hằng định để không rò rỉ thông tin qua thời gian phản hồi
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

/** Đáp án câu hỏi bảo mật: chuẩn hoá về chữ thường, bỏ khoảng trắng thừa rồi băm */
export function hashSecurityAnswer(answer: string): string {
  return hashPassword(answer.trim().toLowerCase().replace(/\s+/g, ' '))
}

export function verifySecurityAnswer(answer: string, stored: string): boolean {
  return verifyPassword(answer.trim().toLowerCase().replace(/\s+/g, ' '), stored)
}
