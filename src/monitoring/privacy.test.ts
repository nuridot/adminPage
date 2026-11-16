import { describe, expect, it } from 'vitest'
import type { ErrorEvent } from '@sentry/react'
import { accountUuid, privateErrorEvent } from './privacy'

describe('console telemetry privacy boundary', () => {
  it('drops document text, identifiers, request details and arbitrary context, preserving public code locations', () => {
    const event: ErrorEvent = {
      type: undefined,
      event_id: 'a'.repeat(32),
      environment: 'prod',
      release: 'b'.repeat(40),
      message: 'private document',
      user: { email: 'person@example.org', ip_address: '127.0.0.1' },
      request: {
        url: 'https://console.test/mail?token=secret',
        headers: { Authorization: 'secret' },
        data: 'mail body',
      },
      breadcrumbs: [{ message: 'private file.pdf' }],
      extra: { password: 'secret' },
      contexts: { custom: { body: 'private content' } },
      tags: { filename: 'private file.pdf' },
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'private document failed',
            stacktrace: {
              frames: [
                {
                  filename: 'https://console.test/assets/index-Ab12.js?token=secret',
                  lineno: 1,
                  colno: 99,
                  vars: { password: 'secret' },
                  context_line: 'mail body',
                },
                { filename: 'https://elsewhere.test/private.pdf' },
                { filename: 'https://console.test/mail/private.pdf' },
              ],
            },
          },
        ],
      },
    }
    const sanitized = privateErrorEvent(
      event,
      'https://console.test',
      '12345678-1234-4234-8234-123456789abc',
    )!
    expect(sanitized.user).toEqual({ id: '12345678-1234-4234-8234-123456789abc' })
    expect(sanitized.exception!.values![0].stacktrace!.frames).toEqual([
      { filename: 'https://console.test/assets/index-Ab12.js', lineno: 1, colno: 99, in_app: true },
    ])
    for (const secret of ['private', 'secret', 'mail body', 'person@example', '127.0.0.1'])
      expect(JSON.stringify(sanitized)).not.toContain(secret)
    expect(sanitized.release).toBe('b'.repeat(40))
    expect(sanitized.sdk?.settings).toEqual({ infer_ip: 'never' })
    expect(
      privateErrorEvent(
        { type: undefined, exception: { values: [{ type: 'Error', value: 'test' }] } },
        'https://console.test',
      )?.exception?.values?.[0],
    ).not.toHaveProperty('stacktrace')
    expect(
      privateErrorEvent({ type: undefined, message: 'private log' }, 'https://console.test'),
    ).toBeNull()
  })
  it('never substitutes an email/login ID or malformed token for the account UUID', () => {
    const token = (sub: string) => `header.${btoa(JSON.stringify({ sub }))}.signature`
    expect(accountUuid(token('person@example.org'))).toBeUndefined()
    expect(accountUuid('not-a-jwt')).toBeUndefined()
    expect(accountUuid(token('12345678-1234-4234-8234-123456789abc'))).toBe(
      '12345678-1234-4234-8234-123456789abc',
    )
  })
})
