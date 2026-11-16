/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_SOURCE?: 'mock' | 'http'
  readonly VITE_API_BASE_URL?: string
  readonly VITE_MOCK_LATENCY?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_ENVIRONMENT?: 'prod' | 'local'
  readonly VITE_SENTRY_RELEASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
