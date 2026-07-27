import { useEffect, useRef, useState } from 'react'

/**
 * Trả về giá trị bị trễ lại `delay` ms.
 *
 * Dùng cho ô tìm kiếm: mỗi phím gõ không tạo một truy vấn database. Với bảng
 * 10.000 học viên, gõ "nguyễn" là 6 lần truy vấn nếu không debounce.
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

/**
 * Bản debounce cho hàm callback — dùng khi cần trì hoãn một hành động
 * (tự lưu nháp, gọi API khi kéo thanh trượt) thay vì trì hoãn một giá trị.
 */
export function useDebouncedCallback<TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay = 350
): (...args: TArgs) => void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callbackRef = useRef(callback)

  // Luôn gọi bản callback mới nhất, tránh "closure cũ" bắt biến lỗi thời
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (...args: TArgs) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => callbackRef.current(...args), delay)
  }
}
