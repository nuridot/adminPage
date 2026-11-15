import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, http, setReauthenticationHandler, setUnauthorizedHandler } from './client'
import { getStoredSession, setStoredSession, updateAccessToken } from './session'
import { httpApi } from './httpApi'
import { MfaChallenge } from '@/auth/mfa'

const response = (result: unknown, status = 200, code = 'COMMON2000') =>
  new Response(JSON.stringify({ isSuccess: status < 400, code, message: code, result }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
beforeEach(() =>
  setStoredSession({
    loginId: 'operator',
    role: 'ROLE_ADMIN',
    accessToken: 'old',
    refreshToken: 'refresh',
  }),
)
afterEach(() => {
  vi.unstubAllGlobals()
  setReauthenticationHandler(null)
  setUnauthorizedHandler(null)
  setStoredSession(null)
})

describe('authenticated transport', () => {
  it('shares a refresh and retains each original request after concurrent 401 responses', async () => {
    const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/refresh')) return response({ accessToken: 'renewed' })
      return (init?.headers as Record<string, string>).Authorization === 'Bearer old'
        ? response(null, 401)
        : response({ ok: true })
    })
    vi.stubGlobal('fetch', fetcher)
    await Promise.all([http.get('/api/admin/a'), http.get('/api/admin/b')])
    expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/refresh'))).toHaveLength(1)
    expect(getStoredSession()?.accessToken).toBe('renewed')
  })
  it('replays exactly the same body and idempotency key once after step-up authentication', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(null, 403, 'AUTH4013'))
      .mockResolvedValueOnce(response({ entryId: 42 }))
    vi.stubGlobal('fetch', fetcher)
    const reauth = vi.fn(async () => {
      updateAccessToken('step-up')
    })
    setReauthenticationHandler(reauth)
    await expect(
      http.request('POST', '/api/admin/credit/wallets/1/grants', {
        body: { amount: 100, reason: 'test' },
        headers: { 'Idempotency-Key': 'stable-key' },
      }),
    ).resolves.toEqual({ entryId: 42 })
    expect(reauth).toHaveBeenCalledOnce()
    const first = fetcher.mock.calls[0][1],
      retry = fetcher.mock.calls[1][1]
    expect(retry.body).toBe(first.body)
    expect(retry.headers['Idempotency-Key']).toBe('stable-key')
    expect(retry.headers.Authorization).toBe('Bearer step-up')
  })
  it('does not retry a mutation after cancelled reauthentication', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(null, 403, 'AUTH4013'))
    vi.stubGlobal('fetch', fetcher)
    setReauthenticationHandler(async () => {
      throw new Error('재인증 취소')
    })
    await expect(http.post('/api/admin/change', {})).rejects.toThrow('재인증 취소')
    expect(fetcher).toHaveBeenCalledOnce()
  })
  it('does not refresh for an incorrect TOTP code', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(null, 401, 'AUTH4008'))
    vi.stubGlobal('fetch', fetcher)
    await expect(http.post('/api/admin/auth/reauth', { code: '123456' })).rejects.toBeInstanceOf(
      ApiError,
    )
    expect(fetcher).toHaveBeenCalledOnce()
    expect(getStoredSession()).not.toBeNull()
  })
  it('clears an old session that lacks required MFA', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, 403, 'AUTH4007')))
    const unauthorized = vi.fn()
    setUnauthorizedHandler(unauthorized)
    await expect(http.get('/api/admin/ops/home')).rejects.toMatchObject({ code: 'AUTH4007' })
    expect(getStoredSession()).toBeNull()
    expect(unauthorized).toHaveBeenCalledOnce()
  })
  it('clears the session when refresh fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(null, 401, 'AUTH4003')))
    await expect(http.get('/api/admin/ops/home')).rejects.toMatchObject({ status: 401 })
    expect(getStoredSession()).toBeNull()
  })
  it('never treats the password-only MFA challenge as a usable session', async () => {
    setStoredSession(null)
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          response({ mfaRequired: true, mfaStep: 'VERIFY', mfaToken: 'temporary' }),
        ),
    )
    await expect(
      httpApi.auth.login({ loginId: 'operator', password: 'test' }),
    ).rejects.toBeInstanceOf(MfaChallenge)
    expect(getStoredSession()).toBeNull()
    expect(localStorage.getItem('semojum.admin.session')).toBeNull()
  })
})
