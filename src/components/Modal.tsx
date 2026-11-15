import { useEffect, useRef, type ReactNode } from 'react'

const dialogs: HTMLElement[] = []

export function Modal({
  title,
  open,
  onClose,
  footer,
  children,
  width = 460,
  layer = 40,
}: {
  title: string
  open: boolean
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
  width?: number
  layer?: number
}) {
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    if (!open || !dialog.current) return
    const element = dialog.current
    const previous = document.activeElement as HTMLElement | null
    dialogs.push(element)
    const focusable = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
        ),
      )
    ;(focusable()[0] ?? element).focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (dialogs[dialogs.length - 1] !== element) return
      if (event.key === 'Escape') close.current()
      if (event.key === 'Tab') {
        const items = focusable()
        const first = items[0],
          last = items[items.length - 1]
        if (!first) {
          event.preventDefault()
          element.focus()
          return
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || !element.contains(document.activeElement))
        ) {
          event.preventDefault()
          last?.focus()
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || !element.contains(document.activeElement))
        ) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      dialogs.splice(dialogs.indexOf(element), 1)
      if (previous?.isConnected) previous.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: layer,
      }}
    >
      <div
        role="dialog"
        ref={dialog}
        tabIndex={-1}
        aria-modal
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
        style={{
          background: 'var(--surface)',
          borderRadius: 'var(--radius)',
          width,
          maxWidth: '100%',
          maxHeight: '100%',
          overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(15, 23, 42, 0.24)',
          padding: '22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <h2 className="card__title">{title}</h2>
          <button
            type="button"
            className="btn btn--sm"
            aria-label="대화상자 닫기"
            onClick={onClose}
          >
            ×
          </button>
        </header>
        {children}
        {footer && <div className="form__footer">{footer}</div>}
      </div>
    </div>
  )
}

/** 삭제처럼 되돌리기 어려운 조작 앞에 한 번 물어봅니다. */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = '확인',
  danger = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button
            type="button"
            className={danger ? 'btn btn--danger' : 'btn btn--primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: 'var(--sub)' }}>{message}</p>
    </Modal>
  )
}
