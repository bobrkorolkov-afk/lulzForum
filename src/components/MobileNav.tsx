import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { Icon } from './Icon'

export function MobileNav() {
  const { user, unreadMessages } = useApp()
  const { route, navigate } = useRouter()
  const ui = useUI()

  const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))

  return (
    <nav className="mobile-nav" aria-label="Мобильная навигация">
      <button className={`mnav ${isActive('/') ? 'is-active' : ''}`} onClick={() => navigate('/')}>
        <Icon name="home" size={18} />
        <span>Лента</span>
      </button>
      <button className={`mnav ${isActive('/music') ? 'is-active' : ''}`} onClick={() => navigate('/music')}>
        <Icon name="music" size={18} />
        <span>Музыка</span>
      </button>
      <button className="mnav mnav--compose" onClick={() => ui.openComposer()} aria-label="Новый пост">
        <Icon name="plus" size={20} />
      </button>
      <button className={`mnav ${isActive('/chats') ? 'is-active' : ''}`} onClick={() => navigate('/chats')}>
        <Icon name="chat" size={18} />
        <span>Чаты</span>
        {unreadMessages > 0 && <i className="mnav__dot" />}
      </button>
      <button
        className={`mnav ${isActive('/u/') ? 'is-active' : ''}`}
        onClick={() => (user ? navigate(`/u/${user.handle}`) : ui.openAuth('login'))}
      >
        <Icon name="user" size={18} />
        <span>{user ? 'Профиль' : 'Войти'}</span>
      </button>
    </nav>
  )
}
