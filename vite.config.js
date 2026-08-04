import { defineConfig } from 'vite';

export default defineConfig({
  // 使用相对路径构建，便于部署到任意子目录
  base: './',
  server: {
    port: 5173,
    open: true
  },
  build: {
    target: 'es2020',
    // ECharts 全量引入体积较大，提高告警阈值避免误报
    chunkSizeWarningLimit: 3000,
    // 关闭自动拆分，演示工具打包为单文件更便于分享
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});
