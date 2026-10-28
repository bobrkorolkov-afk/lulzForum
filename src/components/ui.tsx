import { useEffect, type ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { classNames } from '../lib/util'

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 520,
  bare = false,
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  width?: number
  bare?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <button className="modal__scrim" onClick={onClose} aria-label="Закрыть" tabIndex={-1} />
      <div className="modal__box" style={{ maxWidth: width }}>
        {!bare && (
          <div className="modal__head">
            <span className="modal__title">{title}</span>
            <button className="btn btn--icon" onClick={onClose} aria-label="Закрыть">
              <Icon name="close" />
            </button>
          </div>
        )}
        <div className="modal__body">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({
  icon = 'search',
  title,
  hint,
  action,
}: {
  icon?: IconName
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <div className="empty__art">
        <Icon name={icon} size={48} />
      </div>
      <div className="empty__title">{title}</div>
      {hint && <p className="empty__hint">{hint}</p>}
      {action}
    </div>
  )
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  small,
}: {
  value: T
  onChange: (v: T) => void
  options: Array<{ value: T; label: string; icon?: IconName }>
  small?: boolean
}) {
  return (
    <div className={classNames('segmented', small && 'segmented--sm')} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={classNames('segmented__item', value === o.value && 'is-active')}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={13} />}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__blocks" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {label && <span className="spinner__label">{label}</span>}
    </div>
  )
}

export function Tag({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button className="tag" onClick={onClick} type="button">
      #{children}
    </button>
  )
}

export function Stat({ label, value, onClick }: { label: string; value: ReactNode; onClick?: () => void }) {
  return (
    <button className="stat" onClick={onClick} disabled={!onClick} type="button">
      <b>{value}</b>
      <span>{label}</span>
    </button>
  )
}
