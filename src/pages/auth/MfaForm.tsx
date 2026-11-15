import { useState, type FormEvent } from 'react'
import { ApiError, http } from '@/api/http/client'
import type { Session } from '@/api/types'
import { useAuth } from '@/auth/AuthContext'
import type { MfaChallenge, MfaResult } from '@/auth/mfa'
import { LoginLayout } from './LoginLayout'
import { QRCodeSVG } from 'qrcode.react'

export function MfaForm({
  challenge,
  onComplete,
  onBack,
}: {
  challenge: MfaChallenge
  onComplete: (session: Session) => void
  onBack: () => void
}) {
  const { completeLogin } = useAuth()
  const [enrollment, setEnrollment] = useState<{
    secret: string
    otpauthUri: string
    accountName: string
    issuer: string
  } | null>(null)
  const [code, setCode] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [result, setResult] = useState<MfaResult | null>(null)
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [expired, setExpired] = useState(false)
  const enroll = challenge.challenge.mfaStep === 'ENROLL'
  const finish = (value: MfaResult) => {
    const session: Session = {
      loginId: challenge.loginId,
      role: value.role,
      accessToken: value.accessToken,
      refreshToken: value.refreshToken,
    }
    completeLogin(session)
    onComplete(session)
  }
  const run = async (action: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : '인증을 완료하지 못했습니다.')
      if (e instanceof ApiError && e.code === 'AUTH4009') setExpired(true)
    } finally {
      setBusy(false)
    }
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    void run(async () => {
      const value = await http.post<MfaResult>(
        `/api/auth/mfa/login/${enroll ? 'enroll/confirm' : 'verify'}`,
        {
          mfaToken: challenge.challenge.mfaToken,
          ...(recovery && !enroll ? { recoveryCode: code.trim() } : { code: code.trim() }),
        },
        { anonymous: true },
      )
      if (value.role !== 'ROLE_ADMIN' || value.adminScope !== 'WEB')
        throw new Error('콘솔 운영자 계정이 필요합니다.')
      setEnrollment(null)
      setCode('')
      if (value.recoveryCodes?.length || value.recoveryCodesRemaining <= 3) setResult(value)
      else finish(value)
    })
  }
  return (
    <LoginLayout>
      <h1>2단계 인증</h1>
      <p>{challenge.loginId} · 인증 앱으로 본인 확인</p>
      {result ? (
        <>
          <h2>
            {result.recoveryCodes ? '복구 코드를 안전하게 보관하세요' : '남은 복구 코드가 적습니다'}
          </h2>
          {result.recoveryCodes ? (
            <>
              <p>이 화면에서 한 번만 표시됩니다. 각 코드는 한 번 사용할 수 있습니다.</p>
              <div className="recovery-codes">
                {result.recoveryCodes.map((c) => (
                  <code key={c}>{c}</code>
                ))}
              </div>
              <label>
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(e) => setSaved(e.target.checked)}
                />{' '}
                복구 코드를 안전한 곳에 저장했습니다.
              </label>
            </>
          ) : (
            <p>
              남은 코드 {result.recoveryCodesRemaining}개. 다른 운영자에게 초기화를 요청해 인증 앱을
              다시 등록하세요.
            </p>
          )}
          <button
            className="btn btn--primary"
            disabled={!!result.recoveryCodes && !saved}
            onClick={() => finish(result)}
          >
            콘솔로 이동
          </button>
        </>
      ) : (
        <>
          {enroll && !enrollment ? (
            <button
              className="btn btn--primary"
              disabled={busy || expired}
              onClick={() =>
                void run(async () =>
                  setEnrollment(
                    await http.post(
                      '/api/auth/mfa/login/enroll',
                      { mfaToken: challenge.challenge.mfaToken },
                      { anonymous: true },
                    ),
                  ),
                )
              }
            >
              인증 앱 등록 시작
            </button>
          ) : (
            <>
              {enrollment && (
                <div className="notice-box">
                  <p>인증 앱에서 QR을 스캔하거나 설정 키를 직접 입력하세요.</p>
                  <QRCodeSVG
                    value={enrollment.otpauthUri}
                    size={180}
                    marginSize={4}
                    title="인증 앱 등록 QR"
                  />
                  <p>
                    {enrollment.issuer} · {enrollment.accountName} · 시간 기반 · 6자리 · 30초
                  </p>
                  <code className="secret-key">{enrollment.secret}</code>
                </div>
              )}
              <form className="login__form" onSubmit={submit}>
                <label htmlFor="mfa-code">{recovery ? '복구 코드' : '인증 앱의 6자리 코드'}</label>
                <input
                  id="mfa-code"
                  className="input"
                  autoFocus
                  autoComplete="one-time-code"
                  inputMode={recovery ? 'text' : 'numeric'}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  pattern={recovery ? undefined : '[0-9]{6}'}
                />
                <button className="btn btn--primary" disabled={busy || expired}>
                  {busy ? '확인 중…' : '인증 확인'}
                </button>
                {!enroll && (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setRecovery(!recovery)
                      setCode('')
                    }}
                  >
                    {recovery ? '인증 앱 사용' : '복구 코드 사용'}
                  </button>
                )}
              </form>
            </>
          )}
          {error && (
            <p role="alert" className="error-box">
              {error}
            </p>
          )}
          <button className="btn" disabled={busy} onClick={onBack}>
            아이디·비밀번호부터 다시
          </button>
        </>
      )}
    </LoginLayout>
  )
}
