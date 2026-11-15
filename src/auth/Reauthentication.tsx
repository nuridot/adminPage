import { useEffect, useRef, useState } from 'react'
import { http, setReauthenticationHandler } from '@/api/http/client'
import { updateAccessToken } from '@/api/http/session'
import { Modal } from '@/components/Modal'

export function Reauthentication() {
  const pending = useRef<{ resolve: () => void; reject: (e: Error) => void } | null>(null)
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    setReauthenticationHandler(
      () =>
        new Promise<void>((resolve, reject) => {
          pending.current = { resolve, reject }
          setCode('')
          setError('')
          setOpen(true)
        }),
    )
    return () => {
      setReauthenticationHandler(null)
      pending.current?.reject(new Error('재인증이 취소되었습니다.'))
    }
  }, [])
  const cancel = () => {
    if (busy) return
    pending.current?.reject(new Error('재인증이 취소되었습니다. 변경은 실행되지 않았습니다.'))
    pending.current = null
    setOpen(false)
  }
  return (
    <Modal title="중요한 변경 · 본인 확인" open={open} onClose={cancel} layer={80}>
      <p>인증 앱의 코드를 확인하면 방금 요청한 변경을 계속합니다.</p>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError('')
          try {
            const result = await http.post<{ accessToken: string }>('/api/admin/auth/reauth', {
              code,
            })
            updateAccessToken(result.accessToken)
            pending.current?.resolve()
            pending.current = null
            setOpen(false)
            setCode('')
          } catch (err) {
            setError(err instanceof Error ? err.message : '인증 실패')
          } finally {
            setBusy(false)
          }
        }}
      >
        <label htmlFor="reauth-code">6자리 인증 코드</label>
        <input
          autoFocus
          id="reauth-code"
          className="input"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          pattern="[0-9]{6}"
          required
        />
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary" disabled={busy}>
          확인 후 계속
        </button>
        <button type="button" className="btn" disabled={busy} onClick={cancel}>
          취소
        </button>
      </form>
    </Modal>
  )
}
