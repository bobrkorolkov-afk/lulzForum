import { useTheme } from '../lib/theme'

/**
 * Переключатель ровно из двух тем: белое на чёрном ↔ чёрное на белом.
 * Оформлен как пиксельный тумблер из двух ячеек.
 */
export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      className={compact ? 'theme-switch theme-switch--compact' : 'theme-switch'}
      onClick={toggle}
      title={dark ? 'Светлая тема: чёрное на белом' : 'Тёмная тема: белое на чёрном'}
      aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      aria-pressed={dark}
    >
      <span className={`theme-switch__cell ${dark ? '' : 'is-on'}`} aria-hidden="true">
        {/* белый квадрат на чёрном фоне — «светлая» */}
        <svg width="12" height="12" viewBox="0 0 8 8" shapeRendering="crispEdges">
          <rect x="0" y="0" width="8" height="8" fill="currentColor" />
          <rect x="3" y="3" width="2" height="2" fill="var(--ink)" />
        </svg>
      </span>
      <span className={`theme-switch__cell ${dark ? 'is-on' : ''}`} aria-hidden="true">
        {/* чёрный квадрат в белой рамке — «тёмная» */}
        <svg width="12" height="12" viewBox="0 0 8 8" shapeRendering="crispEdges">
          <rect x="0" y="0" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1" />
          <rect x="2" y="2" width="4" height="4" fill="currentColor" />
        </svg>
      </span>
    </button>
  )
}
