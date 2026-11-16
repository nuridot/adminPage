import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MfaForm } from './MfaForm'
import { MfaChallenge } from '@/auth/mfa'
import { ApiError, http } from '@/api/http/client'

const completeLogin = vi.hoisted(() => vi.fn())
vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ completeLogin }) }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  completeLogin.mockClear()
})
const challenge = (step: 'ENROLL' | 'VERIFY') =>
  new MfaChallenge(
    { mfaRequired: true, mfaStep: step, mfaToken: 'temporary-only', mfaTokenExpiresIn: 300 },
    'test-admin',
  )
const session = {
  accessToken: 'access',
  refreshToken: 'refresh',
  role: 'ROLE_ADMIN',
  adminScope: 'WEB',
  recoveryCodes: null,
  recoveryCodesRemaining: 10,
}

it('enrolls MFA and waits for recovery-code acknowledgement before establishing a console session', async () => {
  const post = vi
    .spyOn(http, 'post')
    .mockResolvedValueOnce({
      secret: 'TESTONLY',
      otpauthUri: 'otpauth://totp/test?secret=TESTONLY',
      accountName: 'test',
      issuer: 'test',
    })
    .mockResolvedValueOnce({
      ...session,
      recoveryCodes: ['test-recovery-one', 'test-recovery-two'],
    })
  const user = userEvent.setup()
  const done = vi.fn()
  render(<MfaForm challenge={challenge('ENROLL')} onComplete={done} onBack={() => {}} />)
  await user.click(screen.getByRole('button', { name: '인증 앱 등록 시작' }))
  await user.type(await screen.findByLabelText('인증 앱의 6자리 코드'), '123456')
  await user.click(screen.getByRole('button', { name: '인증 확인' }))
  await screen.findByText('test-recovery-one')
  expect(completeLogin).not.toHaveBeenCalled()
  expect((screen.getByRole('button', { name: '콘솔로 이동' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: '콘솔로 이동' }))
  expect(completeLogin).toHaveBeenCalledWith({
    loginId: 'test-admin',
    role: 'ROLE_ADMIN',
    accessToken: 'access',
    refreshToken: 'refresh',
  })
  expect(post.mock.calls[1]).toEqual([
    '/api/auth/mfa/login/enroll/confirm',
    { mfaToken: 'temporary-only', code: '123456' },
    { anonymous: true },
  ])
  expect(done).toHaveBeenCalledOnce()
})

it('sends a recovery code without a TOTP code and rejects expired challenges without creating a session', async () => {
  const post = vi
    .spyOn(http, 'post')
    .mockRejectedValue(new ApiError(401, 'AUTH4009', '인증 시간이 만료되었습니다.'))
  const user = userEvent.setup()
  const back = vi.fn()
  render(<MfaForm challenge={challenge('VERIFY')} onComplete={vi.fn()} onBack={back} />)
  await user.click(screen.getByRole('button', { name: '복구 코드 사용' }))
  await user.type(screen.getByLabelText('복구 코드'), 'recovery-test')
  await user.click(screen.getByRole('button', { name: '인증 확인' }))
  await screen.findByRole('alert')
  expect(post).toHaveBeenCalledWith(
    '/api/auth/mfa/login/verify',
    { mfaToken: 'temporary-only', recoveryCode: 'recovery-test' },
    { anonymous: true },
  )
  expect(completeLogin).not.toHaveBeenCalled()
  expect((screen.getByRole('button', { name: '인증 확인' }) as HTMLButtonElement).disabled).toBe(
    true,
  )
  await user.click(screen.getByRole('button', { name: '아이디·비밀번호부터 다시' }))
  expect(back).toHaveBeenCalledOnce()
})

it('rejects an app-scoped admin result after TOTP verification', async () => {
  vi.spyOn(http, 'post').mockResolvedValue({ ...session, adminScope: 'APP' })
  const user = userEvent.setup()
  render(<MfaForm challenge={challenge('VERIFY')} onComplete={vi.fn()} onBack={vi.fn()} />)
  await user.type(screen.getByLabelText('인증 앱의 6자리 코드'), '123456')
  await user.click(screen.getByRole('button', { name: '인증 확인' }))
  await screen.findByText('콘솔 운영자 계정이 필요합니다.')
  expect(completeLogin).not.toHaveBeenCalled()
})
