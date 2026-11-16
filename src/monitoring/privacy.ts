import { SDK_VERSION, type ErrorEvent, type StackFrame } from '@sentry/react'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const errorTypes = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'EvalError',
  'AggregateError',
])

export function accountUuid(token?: string): string | undefined {
  try {
    const payload = JSON.parse(atob(token!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.sub === 'string' && uuid.test(payload.sub) ? payload.sub : undefined
  } catch {
    return undefined
  }
}

function safeFrame(frame: StackFrame, origin: string): StackFrame | null {
  try {
    const url = new URL(frame.filename ?? '', origin)
    // Only public compiled assets: never document names, routes, queries or source context.
    if (url.origin !== origin || !/^\/assets\/[\w.-]+\.js$/.test(url.pathname)) return null
    return {
      filename: `${origin}${url.pathname}`,
      lineno: frame.lineno,
      colno: frame.colno,
      in_app: true,
    }
  } catch {
    return null
  }
}

/** Build a fresh allowlisted event; regex redaction alone cannot protect arbitrary document text. */
export function privateErrorEvent(
  event: ErrorEvent,
  origin: string,
  userId?: string,
): ErrorEvent | null {
  if (!event.exception?.values?.length) return null
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: 'javascript',
    // Preserve the SDK privacy directive; dropping it would let Relay infer IP/geolocation.
    sdk: { name: 'sentry.javascript.react', version: SDK_VERSION, settings: { infer_ip: 'never' } },
    level: 'error',
    environment: event.environment === 'prod' ? 'prod' : 'local',
    release: /^[0-9a-f]{40}$/.test(event.release ?? '') ? event.release : undefined,
    tags: { surface: 'console' },
    ...(userId && uuid.test(userId) ? { user: { id: userId } } : {}),
    exception: {
      values: event.exception.values.slice(-1).map((value) => {
        const frames = (value.stacktrace?.frames ?? [])
          .map((frame) => safeFrame(frame, origin))
          .filter((frame): frame is StackFrame => !!frame)
        return {
          type: errorTypes.has(value.type ?? '') ? value.type : 'Error',
          value: 'Console runtime error (details redacted)',
          ...(frames.length ? { stacktrace: { frames } } : {}),
        }
      }),
    },
  }
}
