import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  const watch = mode === 'development'

  return {
    plugins: [vue()],
    build: {
      outDir: watch ? '../backend/static' : 'dist',
      emptyOutDir: true,
      watch: watch ? {} : null,
    },
  }
})
