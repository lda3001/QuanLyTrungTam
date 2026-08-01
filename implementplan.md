Chuyển đổi ứng dụng Electron → Web App
Ứng dụng hiện tại là Electron desktop app quản lý trung tâm dạy học đầy đủ tính năng: quản lý học sinh, giáo viên, khóa học, lớp học, buổi học, điểm danh, thanh toán, phân quyền RBAC, dashboard, báo cáo, xuất Excel/PDF. Database SQLite cục bộ qua Drizzle ORM.

Kế hoạch này chuyển đổi sang web app thuần (React + Vite frontend + Express backend).

User Review Required
IMPORTANT


Database: Hiện tại app dùng SQLite cục bộ (file-based). Khi chuyển sang web, có 2 lựa chọn:

Giữ SQLite — Backend Express sử dụng better-sqlite3 (đơn giản, không cần cài database server, phù hợp trung tâm nhỏ/vừa)
Chuyển sang PostgreSQL/MySQL — Phù hợp hơn cho production lớn, multi-user nặng
Kế hoạch này chọn phương án 1 (giữ SQLite) để giảm thiểu thay đổi. Toàn bộ database layer giữ nguyên.

IMPORTANT

Authentication: App hiện tại đã có hệ thống Auth + RBAC (login, roles, permissions). Khi chuyển sang web, logic auth sẽ chuyển sang dùng session-based auth (express-session) thay vì IPC. Toàn bộ business logic giữ nguyên.

WARNING

File Operations: Các tính năng xuất Excel/PDF, import Excel, in HTML hiện dùng native API (dialog.showSaveDialog, shell.openPath). Khi chuyển sang web:

Export → Server tạo file, browser download
Import → Browser file input + upload
Print → window.print() hoặc server render PDF
Open Questions
Bạn có muốn giữ SQLite hay chuyển sang PostgreSQL/MySQL?
Có yêu cầu gì đặc biệt về deployment (Docker, cloud hosting, self-hosted, etc.) không?
Session auth (express-session + cookie) hay JWT token? Kế hoạch mặc định dùng session auth.
Kiến trúc hiện tại vs Kiến trúc mới
Mermaid diagram
Mermaid diagram
Proposed Changes
Cấu trúc thư mục mới

project/
├── client/                        # React frontend (từ src/renderer)
│   ├── index.html
│   ├── vite.config.ts             # [NEW] Vite thuần
│   └── src/
│       ├── App.tsx                 # Giữ nguyên
│       ├── main.tsx               # Giữ nguyên
│       ├── components/            # Giữ nguyên 100%
│       ├── hooks/                 # Giữ nguyên 100%
│       ├── layouts/               # ✏️ Xóa Electron title bar
│       ├── pages/                 # Giữ nguyên 100%
│       ├── router/                # Giữ nguyên 100%
│       ├── services/              # ✏️ window.api → axios
│       ├── store/                 # Giữ nguyên 100%
│       ├── styles/                # Giữ nguyên 100%
│       └── utils/                 # Giữ nguyên 100%
│
├── server/                        # Express backend (từ src/main)
│   ├── index.ts                   # [NEW] Express entry
│   ├── middleware/                # [NEW] Auth, error handling
│   ├── routes/                    # [NEW] REST routes (thay IPC handlers)
│   ├── database/                  # Giữ nguyên từ src/main/database
│   ├── repositories/              # Giữ nguyên 100%
│   ├── services/                  # Giữ nguyên ~98%
│   └── utils/                     # Giữ nguyên
│
├── shared/                        # Types + Constants dùng chung
│   ├── types/                     # Giữ nguyên 100%
│   └── constants/                 # Giữ nguyên 100%
│
├── package.json                   # Root scripts
├── tsconfig.json
└── drizzle.config.ts
Component 1: Server — Express Backend
Tạo Express server, chuyển ~85 IPC handlers thành REST API endpoints. Database/Repository/Service layer giữ nguyên.

[NEW] server/index.ts
Express app entry point
cors(), express.json(), express-session() (hoặc cookie-parser)
Import & mount tất cả route modules
Khởi tạo database connection (logic từ src/main/database/)
Error handling middleware
Listen port 3001
[NEW] server/middleware/auth.ts
Session-based authentication middleware
requireAuth() — kiểm tra session đã đăng nhập
requirePermission(permission) — kiểm tra quyền RBAC
Wrap logic từ IPC auth handlers hiện tại
[NEW] server/routes/authRoutes.ts
IPC Channel	HTTP	REST Endpoint
auth:login	POST	/api/auth/login
auth:logout	POST	/api/auth/logout
auth:me	GET	/api/auth/me
auth:change-password	POST	/api/auth/change-password
auth:security-question	GET	/api/auth/security-question
auth:reset-password	POST	/api/auth/reset-password
[NEW] server/routes/studentRoutes.ts
IPC Channel	HTTP	REST Endpoint
student:list	GET	/api/students
student:get	GET	/api/students/:id
student:create	POST	/api/students
student:update	PUT	/api/students/:id
student:delete	DELETE	/api/students/:id
student:bulk-delete	POST	/api/students/bulk-delete
student:options	GET	/api/students/options
student:school-classes	GET	/api/students/school-classes
student:import	POST	/api/students/import
student:import-template	GET	/api/students/import-template
student:classes	GET	/api/students/:id/classes
student:payments	GET	/api/students/:id/payments
[NEW] server/routes/teacherRoutes.ts
IPC Channel	HTTP	REST Endpoint
teacher:list	GET	/api/teachers
teacher:get	GET	/api/teachers/:id
teacher:create	POST	/api/teachers
teacher:update	PUT	/api/teachers/:id
teacher:delete	DELETE	/api/teachers/:id
teacher:options	GET	/api/teachers/options
[NEW] server/routes/courseRoutes.ts
IPC Channel	HTTP	REST Endpoint
course:list	GET	/api/courses
course:get	GET	/api/courses/:id
course:create	POST	/api/courses
course:update	PUT	/api/courses/:id
course:delete	DELETE	/api/courses/:id
course:options	GET	/api/courses/options
[NEW] server/routes/classRoutes.ts
IPC Channel	HTTP	REST Endpoint
class:list	GET	/api/classes
class:get	GET	/api/classes/:id
class:create	POST	/api/classes
class:update	PUT	/api/classes/:id
class:delete	DELETE	/api/classes/:id
class:options	GET	/api/classes/options
class:students	GET	/api/classes/:id/students
class:available-students	GET	/api/classes/:id/available-students
class:enroll	POST	/api/classes/:id/enroll
class:unenroll	POST	/api/classes/:id/unenroll
class:enroll-import	POST	/api/classes/:id/enroll-import
class:enroll-template	GET	/api/classes/enroll-template
[NEW] server/routes/sessionRoutes.ts
IPC Channel	HTTP	REST Endpoint
session:list	GET	/api/sessions
session:get	GET	/api/sessions/:id
session:create	POST	/api/sessions
session:update	PUT	/api/sessions/:id
session:delete	DELETE	/api/sessions/:id
session:move	POST	/api/sessions/:id/move
session:generate	POST	/api/sessions/generate
[NEW] server/routes/attendanceRoutes.ts
IPC Channel	HTTP	REST Endpoint
attendance:by-session	GET	/api/attendance/session/:sessionId
attendance:mark	POST	/api/attendance/mark
attendance:mark-multi	POST	/api/attendance/mark-multi
attendance:history	GET	/api/attendance/history
attendance:grid	GET	/api/attendance/grid
attendance:student-summary	GET	/api/attendance/student/:studentId/summary
[NEW] server/routes/paymentRoutes.ts
IPC Channel	HTTP	REST Endpoint
payment:list	GET	/api/payments
payment:get	GET	/api/payments/:id
payment:create	POST	/api/payments
payment:update	PUT	/api/payments/:id
payment:delete	DELETE	/api/payments/:id
payment:debts	GET	/api/payments/debts
payment:receipt	GET	/api/payments/:id/receipt
payment:student-enrollments	GET	/api/payments/student-enrollments
[NEW] server/routes/userRoutes.ts
IPC Channel	HTTP	REST Endpoint
user:list	GET	/api/users
user:get	GET	/api/users/:id
user:create	POST	/api/users
user:update	PUT	/api/users/:id
user:delete	DELETE	/api/users/:id
user:reset-password	POST	/api/users/:id/reset-password
[NEW] server/routes/roleRoutes.ts
IPC Channel	HTTP	REST Endpoint
role:list	GET	/api/roles
role:create	POST	/api/roles
role:update	PUT	/api/roles/:id
role:delete	DELETE	/api/roles/:id
role:options	GET	/api/roles/options
[NEW] server/routes/dashboardRoutes.ts
IPC Channel	HTTP	REST Endpoint
dashboard:data	GET	/api/dashboard
[NEW] server/routes/reportRoutes.ts
IPC Channel	HTTP	REST Endpoint
report:revenue	GET	/api/reports/revenue
report:tuition	GET	/api/reports/tuition
report:attendance	GET	/api/reports/attendance
report:student	GET	/api/reports/student
report:teacher	GET	/api/reports/teacher
[NEW] server/routes/settingRoutes.ts
IPC Channel	HTTP	REST Endpoint
setting:get-all	GET	/api/settings
setting:update	PUT	/api/settings
log:list	GET	/api/logs
[NEW] server/routes/fileRoutes.ts
Xử lý file operations (thay native dialog):

IPC Channel	HTTP	REST Endpoint	Ghi chú
file:export-excel	POST	/api/files/export-excel	Response: file download
file:export-pdf	POST	/api/files/export-pdf	Response: PDF download
file:import-excel	POST	/api/files/import-excel	Multipart upload
file:import-excel-raw	POST	/api/files/import-excel-raw	Multipart upload
file:print-html	POST	/api/files/print-html	Response: HTML for window.print()
[MOVE] server/database/ ← src/main/database/
Giữ nguyên schema, migration, connection
Chỉ thay app.getPath('userData') → path.resolve('./data') cho file SQLite
[MOVE] server/repositories/ ← src/main/repositories/
Giữ nguyên 100% — Drizzle queries không phụ thuộc Electron
[MOVE] server/services/ ← src/main/services/
Giữ nguyên ~98% — Chỉ xóa Electron imports (dialog, shell)
excelService.ts giữ nguyên logic, chỉ đổi output: trả Buffer thay vì save to file
Component 2: Client — React Frontend
Frontend giữ nguyên ~95%. Thay đổi chính: window.api.* → axios HTTP calls.

[NEW] client/src/services/apiClient.ts
typescript

// Axios instance cấu hình sẵn
import axios from 'axios'
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true  // send session cookie
})
[MODIFY] client/src/services/ (tất cả ~14 service files)
Pattern chuyển đổi:

diff

-export const getStudents = (query) => window.api.students.list(query)
+export const getStudents = (query) => api.get('/students', { params: query }).then(r => r.data)
-export const createStudent = (data) => window.api.students.create(data)
+export const createStudent = (data) => api.post('/students', data).then(r => r.data)
[MODIFY] client/src/services/fileService.ts
diff

-export const exportExcel = (req) => window.api.files.exportExcel(req)
+export const exportExcel = async (req) => {
+  const res = await api.post('/files/export-excel', req, { responseType: 'blob' })
+  // Trigger browser download
+  const url = URL.createObjectURL(res.data)
+  const a = document.createElement('a')
+  a.href = url; a.download = req.fileName; a.click()
+}
[MODIFY] client/src/layouts/MainLayout.tsx
Xóa custom Electron title bar (minimize/maximize/close buttons)
Xóa CSS -webkit-app-region: drag
Xóa window.api.app.* calls
[MOVE] Giữ nguyên 100% — không cần sửa:
client/src/components/ ← src/renderer/components/
client/src/hooks/ ← src/renderer/hooks/
client/src/pages/ ← src/renderer/pages/
client/src/router/ ← src/renderer/router/
client/src/store/ ← src/renderer/store/
client/src/styles/ ← src/renderer/styles/
client/src/utils/ ← src/renderer/utils/
[NEW] client/vite.config.ts
typescript

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src', '@shared': '../shared' }
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' }
  }
})
Component 3: Shared Types & Constants
[MOVE] shared/types/ ← src/shared/types/
Giữ nguyên 100% (entities.ts, dto.ts, common.ts)
IpcResult<T> vẫn dùng được (chỉ đổi transport từ IPC → HTTP, cấu trúc response giữ nguyên)
[MOVE] shared/constants/ ← src/shared/constants/
Giữ nguyên 100% (enums.ts, permissions.ts)
[DELETE] shared/ipc/ — Xóa hoàn toàn
channels.ts — không cần channel names nữa
api.ts — interface AppApi không cần nữa (thay bằng REST endpoints)
Component 4: Config & Dependencies
[NEW] package.json (root)
json

{
  "name": "quanly-trungtam-web",
  "scripts": {
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\"",
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "cd client && vite",
    "build": "cd client && vite build",
    "start": "NODE_ENV=production tsx server/index.ts",
    "db:generate": "drizzle-kit generate"
  }
}
[NEW] tsconfig.json, tsconfig.server.json, client/tsconfig.json
Xóa Electron dependencies:
electron, electron-builder, electron-vite
@electron-toolkit/preload, @electron-toolkit/utils, @electron-toolkit/tsconfig
Thêm dependencies mới:
express, cors, express-session, multer (file upload)
tsx (Node TS runtime), concurrently
@types/express, @types/cors, @types/express-session, @types/multer
Giữ nguyên (chuyển sang dependencies):
better-sqlite3, drizzle-orm, drizzle-kit, exceljs
Tất cả React/Ant Design/UI packages
[DELETE] Xóa hoàn toàn:
electron.vite.config.ts
electron-builder.yml
src/preload/ (toàn bộ)
src/main/ipc/ (toàn bộ — thay bằng routes)
src/main/index.ts (Electron entry — thay bằng server/index.ts)
src/shared/ipc/ (toàn bộ)
Tóm tắt mức thay đổi
Phần	Thay đổi	Chi tiết
Database schema + Drizzle	⬜ 0%	Giữ nguyên 100%
Repositories	⬜ 0%	Giữ nguyên 100%
Services (business logic)	🟨 ~2%	Xóa Electron imports, đổi file output
Shared types & constants	⬜ 0%	Giữ nguyên 100%
IPC → REST Routes	🟥 Mới	~14 route files, ~85 endpoints
Express server setup	🟥 Mới	Entry, middleware, auth
Frontend Components/Pages	⬜ 0%	Giữ nguyên 100%
Frontend Hooks/Store/Router	⬜ 0%	Giữ nguyên 100%
Frontend Services	🟥 100%	window.api → axios
Layout	🟨 ~10%	Xóa Electron title bar
IPC/Preload	🔴 Xóa	Không cần nữa
Config files	🟥 100%	electron-vite → vite + express
Verification Plan
Automated Tests
bash

# 1. Build client
cd client && npx vite build
# 2. Start server, kiểm tra API
npm run dev:server
# curl http://localhost:3001/api/auth/login -X POST -d '...'
# 3. Full app test
npm run dev
# Mở http://localhost:5173
Manual Verification
Đăng nhập / Đăng xuất
CRUD: Học sinh, Giáo viên, Khóa học, Lớp học, Buổi học
Điểm danh học sinh
Thanh toán + Phiếu thu
Dashboard + Báo cáo (Revenue, Tuition, Attendance)
Import/Export Excel
Phân quyền RBAC (tạo role, gán permission)
Settings