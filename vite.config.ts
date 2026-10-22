import config from '@yboyer/config/vite-plus'
import { defineConfig, mergeConfig } from 'vite-plus'

export default defineConfig(
  mergeConfig(config, {
    lint: {
      // Vue SFC types are checked with vue-tsc in the check task.
      options: { typeAware: false, typeCheck: false },
      overrides: [
        {
          files: ['**/*.js'],
          env: { node: true },
          rules: {
            'no-console': 'off',
            'no-new': 'off',
          },
        },
        {
          files: ['apps/frontend/src/**'],
          env: { browser: true },
          globals: { defineProps: 'readonly' },
        },
      ],
    },
    run: {
      tasks: {
        check: {
          command: 'vp check',
          dependsOn: ['frontend#check'],
          cache: false,
        },
      },
    },
    staged: {
      '*': 'vp check --fix',
    },
  })
)
