import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * electron-vite chia project thành 3 bundle độc lập:
 *  - main    : Node process (Electron main) -> out/main
 *  - preload : cầu nối bảo mật (contextBridge) -> out/preload
 *  - renderer: ứng dụng React (chạy trong Chromium) -> out/renderer
 *
 * externalizeDepsPlugin() giữ các package trong "dependencies" ở dạng require()
 * thay vì bundle vào file — bắt buộc với native module như better-sqlite3.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    },
    resolve: {
      alias: {
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    }
  },

  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/preload/index.ts') }
      }
    },
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },

  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
        output: {
          // Code splitting thủ công: tách vendor lớn ra khỏi bundle chính
          // để lần tải đầu nhanh hơn và cache tốt hơn giữa các bản build.
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-antd': ['antd', '@ant-design/icons'],
            'vendor-chart': ['recharts'],
            'vendor-form': ['react-hook-form', 'zod', '@hookform/resolvers']
          }
        }
      },
      chunkSizeWarningLimit: 1500
    },
    resolve: {
      alias: {
        '@': resolve('src/renderer'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()],
    server: { port: 5173, strictPort: true }
  }
})
