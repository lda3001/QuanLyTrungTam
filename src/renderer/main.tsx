import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'

/**
 * Điểm khởi động của renderer.
 *
 * StrictMode chỉ bật ở chế độ phát triển (Vite tự loại bỏ nhánh này khi build):
 * nó gọi effect hai lần để lộ ra các effect thiếu hàm dọn dẹp — rất hữu ích khi
 * viết, nhưng không cần trong bản phát hành.
 */
const container = document.getElementById('root')

if (!container) {
  throw new Error('Không tìm thấy phần tử #root trong index.html')
}

const root = createRoot(container)

root.render(
  import.meta.env.DEV ? (
    <StrictMode>
      <App />
    </StrictMode>
  ) : (
    <App />
  )
)
