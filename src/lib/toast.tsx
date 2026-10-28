import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { uid } from './util'

type ToastKind = 'info' | 'ok' | 'error'

interface Toast {
  id: string
  kind: ToastKind
  text: string
}

interface ToastValue {
  toasts: Toast[]
  push: (text: string, kind?: ToastKind) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (text: string, kind: ToastKind = 'info') => {
      const id = uid('t')
      setToasts((list) => [...list.slice(-3), { id, kind, text }])
      window.setTimeout(() => dismiss(id), 4200)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])
  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <button key={t.id} className={`toast toast--${t.kind}`} onClick={() => dismiss(t.id)}>
          <span className="toast__mark">{t.kind === 'error' ? '!!' : t.kind === 'ok' ? 'OK' : '::'}</span>
          <span className="toast__text">{t.text}</span>
        </button>
      ))}
    </div>
  )
}
