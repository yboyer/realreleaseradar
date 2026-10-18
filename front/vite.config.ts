import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite-plus'

export default defineConfig(({ mode }) => {
  const watch = mode === 'development'

  return {
    plugins: [vue()],
    build: {
      outDir: watch ? '../static' : 'dist',
      emptyOutDir: true,
      watch: watch ? {} : null,
    },
    run: {
      tasks: {
        check: {
          command: ['vue-tsc --noEmit', 'vp check'],
          cache: false,
        },
        'dev:build': {
          command: 'vp build --mode development',
          cache: false,
        },
      },
    },
  }
})
