import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' => chạy đúng trên GitHub Pages dù repo đặt tên gì (dự án dùng điều hướng bằng hash nên không cần rewrite).
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
