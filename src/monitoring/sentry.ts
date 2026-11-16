import * as Sentry from '@sentry/react'
import { getStoredSession } from '@/api/http/session'
import { accountUuid, privateErrorEvent } from './privacy'

export function initializeMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn || import.meta.env.VITE_API_SOURCE === 'mock') return
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT === 'prod' ? 'prod' : 'local',
    release: import.meta.env.VITE_SENTRY_RELEASE,
    defaultIntegrations: false,
    integrations: [
      Sentry.globalHandlersIntegration(),
      Sentry.browserApiErrorsIntegration(),
      Sentry.dedupeIntegration(),
    ],
    tracePropagationTargets: [],
    maxBreadcrumbs: 0,
    beforeSendLog: () => null,
    beforeSendMetric: () => null,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
      frameContextLines: 0,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
    },
    beforeSend: (event) =>
      privateErrorEvent(
        event,
        window.location.origin,
        accountUuid(getStoredSession()?.accessToken),
      ),
  })
}

export function reportRenderError(error: Error) {
  if (Sentry.isInitialized()) Sentry.captureException(error)
}
