import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      // Example-screen tests must stay offline even when CI builds for production.
      // This override is scoped to Vitest; the subsequent Vite build keeps HTTP mode.
      env: { VITE_API_SOURCE: 'mock', VITE_API_BASE_URL: '' },
    },
  }),
)
