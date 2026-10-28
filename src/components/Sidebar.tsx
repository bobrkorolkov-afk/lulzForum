import { useMemo } from 'react'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { Icon, type IconName } from './Icon'
import { formatCount } from '../lib/util'
import { Avatar } from './Avatar'

interface NavItem {
  label: string
  to: string
  icon: IconName
  badge?: number
  authOnly?: boolean
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, unreadMessages, unreadNotifications, pendingIncoming, chats, friendIds, profileById } = useApp()
  const { navigate, route } = useRouter()
  const ui = useUI()

  const items: NavItem[] = [
    { label: 'Лента', to: '/', icon: 'home' },
    { label: 'Чаты', to: '/chats', icon: 'chat', badge: unreadMessages, authOnly: true },
    { label: 'Музыка', to: '/music', icon: 'music' },
    { label: 'Хранилище', to: '/vault', icon: 'vault', authOnly: true },
    { label: 'Друзья', to: '/friends', icon: 'friends', badge: pendingIncoming.length, authOnly: true },
    { label: 'Уведомления', to: '/notifications', icon: 'bell', badge: unreadNotifications, authOnly: true },
    { label: 'Закладки', to: '/bookmarks', icon: 'bookmark', authOnly: true },
    { label: 'Профиль', to: user ? `/u/${user.handle}` : '/', icon: 'user', authOnly: true },
    { label: 'Настройки', to: '/settings', icon: 'settings' },
  ]

  const friends = useMemo(
    () =>
      Array.from(friendIds)
        .map((id) => profileById(id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
        .slice(0, 6),
    [friendIds, profileById],
  )

  const activeChats = chats.filter((c) => c.unreadCount > 0).length

  return (
    <nav className="sidebar" aria-label="Основная навигация">
      <div className="sidebar__group">
        {items
          .filter((i) => !i.authOnly || user)
          .map((item) => {
            const active =
              item.to === '/' ? route.path === '/' : route.path === item.to || route.path.startsWith(`${item.to}/`)
            return (
              <button
                key={item.to}
                className={`nav ${active ? 'nav--active' : ''}`}
                onClick={() => {
                  navigate(item.to)
                  onNavigate?.()
                }}
              >
                <span className="nav__icon">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className="nav__label">{item.label}</span>
                {item.badge ? <span className="badge">{item.badge > 99 ? '99+' : item.badge}</span> : null}
              </button>
            )
          })}
        {!user && (
          <button
            className="nav nav--cta"
            onClick={() => {
              ui.openAuth('register')
              onNavigate?.()
            }}
          >
            <span className="nav__icon">
              <Icon name="user" size={16} />
            </span>
            <span className="nav__label">Создать аккаунт</span>
          </button>
        )}
      </div>

      {user && friends.length > 0 && (
        <div className="sidebar__block">
          <div className="sidebar__title">ДРУЗЬЯ / ОНЛАЙН</div>
          <div className="sidebar__friends">
            {friends.map((f) => (
              <button
                key={f.id}
                className="friend-mini"
                onClick={() => {
                  navigate(`/u/${f.handle}`)
                  onNavigate?.()
                }}
                title={`@${f.handle}`}
              >
                <Avatar seed={f.handle} name={f.name} src={f.avatarUrl} size={24} />
                <span className="friend-mini__name">{f.name}</span>
                <i className="dot" />
              </button>
            ))}
          </div>
        </div>
      )}

      {user && activeChats > 0 && (
        <div className="sidebar__note">
          <Icon name="chat" size={14} />
          <span>
            {activeChats} {activeChats === 1 ? 'чат ждёт' : 'чата ждут'} ответа
          </span>
        </div>
      )}

      <div className="sidebar__footer">
        <span className="sidebar__counter">
          <Icon name="fire" size={12} /> {formatCount(12_400)} постов
        </span>
        <button className="sidebar__link" onClick={() => navigate('/about')}>
          Правила и о форуме
        </button>
        <button className="sidebar__link" onClick={() => ui.toggleShortcuts(true)}>
          Горячие клавиши
        </button>
      </div>
    </nav>
  )
}
