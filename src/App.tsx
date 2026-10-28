import { useEffect, useRef, useState } from 'react'
import { AppProvider, useApp } from './lib/app'
import { PlayerProvider, usePlayer } from './lib/player'
import { RouterProvider, useRouter } from './lib/router'
import { ToastProvider, ToastViewport, useToast } from './lib/toast'
import { UIProvider, useUI } from './lib/ui'
import { Header } from './components/Header'
import { Sidebar } from './components/Sidebar'
import { RightRail } from './components/RightRail'
import { Player } from './components/Player'
import { MobileNav } from './components/MobileNav'
import { AuthModal } from './components/AuthModal'
import { Composer } from './components/Composer'
import { Modal } from './components/ui'
import { Icon } from './components/Icon'
import { FeedPage } from './pages/FeedPage'
import { PostPage } from './pages/PostPage'
import { TagPage } from './pages/TagPage'
import { ChatsPage } from './pages/ChatsPage'
import { GroupsPage } from './pages/GroupsPage'
import { GroupPage } from './pages/GroupPage'
import { MusicPage } from './pages/MusicPage'
import { VaultPage } from './pages/VaultPage'
import { FriendsPage } from './pages/FriendsPage'
import { ProfilePage } from './pages/ProfilePage'
import { NotificationsPage } from './pages/NotificationsPage'
import { SearchPage } from './pages/SearchPage'
import { SettingsPage } from './pages/SettingsPage'
import { BookmarksPage } from './pages/BookmarksPage'
import { AboutPage } from './pages/AboutPage'

function Page() {
  const { route } = useRouter()
  const [head, param, sub] = route.segments

  switch (head) {
    case undefined:
      return <FeedPage />
    case 'post':
      return <PostPage id={param} />
    case 'tag':
      return <TagPage tag={param} />
    case 'chats':
      return <ChatsPage chatId={param} />
    case 'groups':
      return <GroupsPage />
    case 'g':
      return param ? <GroupPage groupId={param} channelId={sub} /> : <GroupsPage />
    case 'music':
      return <MusicPage />
    case 'vault':
      return <VaultPage />
    case 'friends':
      return <FriendsPage />
    case 'notifications':
      return <NotificationsPage />
    case 'bookmarks':
      return <BookmarksPage />
    case 'search':
      return <SearchPage query={route.query.get('q') ?? ''} />
    case 'settings':
      return <SettingsPage />
    case 'about':
      return <AboutPage />
    case 'u':
      return <ProfilePage handle={param} />
    default:
      return <FeedPage />
  }
}

function Shell() {
  const { booted, user } = useApp()
  const { route, navigate } = useRouter()
  const ui = useUI()
  const player = usePlayer()
  const toast = useToast()
  const [drawer, setDrawer] = useState(false)
  const gRef = useRef(0)
  const [showTop, setShowTop] = useState(false)

  useEffect(() => {
    const boot = document.getElementById('boot')
    if (boot && booted) {
      boot.style.opacity = '0'
      boot.style.transition = 'opacity .2s'
      window.setTimeout(() => boot.remove(), 240)
    }
  }, [booted])

  useEffect(() => {
    setDrawer(false)
  }, [route.path])

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 900)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)
      if (typing) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const key = e.key.toLowerCase()
      if (key === 'n') {
        e.preventDefault()
        ui.openComposer()
        return
      }
      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault()
        ui.toggleShortcuts()
        return
      }
      if (key === ' ') {
        if (player.current) {
          e.preventDefault()
          player.toggle()
        }
        return
      }
      const map: Record<string, string> = {
        f: '/',
        c: '/chats',
        g: '/groups',
        m: '/music',
        v: '/vault',
        d: '/friends',
        n: '/notifications',
      }
      const withinG = gRef.current > 0 && Date.now() - gRef.current < 1400
      if (withinG && map[key]) {
        e.preventDefault()
        navigate(map[key])
        gRef.current = 0
        return
      }
      if (key === 'g') {
        gRef.current = Date.now()
      }
      if (key === 'escape') {
        ui.closeComposer()
        ui.closeAuth()
        ui.closeLightbox()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, player, ui])

  // Приветственный тост после регистрации.
  useEffect(() => {
    if (user && route.query.get('welcome') === '1') {
      toast.push(`Привет, ${user.name}! Заполните профиль в настройках.`, 'ok')
      navigate('/', { replace: true })
    }
  }, [user, route.query, toast, navigate])

  const flush = route.segments[0] === 'chats'

  return (
    <div className={`app ${player.current ? 'app--player' : ''}`}>
      <Header onMenu={() => setDrawer(true)} />

      {drawer && (
        <div className="drawer">
          <button className="drawer__scrim" onClick={() => setDrawer(false)} aria-label="Закрыть меню" />
          <div className="drawer__panel">
            <div className="drawer__head">
              <span className="logo__text">LULZFORUM</span>
              <button className="btn btn--icon" onClick={() => setDrawer(false)}>
                <Icon name="close" size={14} />
              </button>
            </div>
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className={`shell ${flush ? 'shell--flush' : ''}`}>
        <div className="shell__sidebar">
          <Sidebar />
        </div>
        <main className="main" id="main">
          <Page />
        </main>
        <RightRail />
      </div>

      <Player />
      <MobileNav />
      <AuthModal />
      <Composer />
      <ShortcutsModal />
      <ToastViewport />

      <Modal open={Boolean(ui.lightbox)} onClose={ui.closeLightbox} bare width={980}>
        {ui.lightbox && (
          <div className="lightbox">
            <img src={ui.lightbox} alt="Просмотр изображения" />
            <div className="lightbox__bar">
              <a className="btn" href={ui.lightbox} download target="_blank" rel="noopener noreferrer">
                <Icon name="download" size={13} /> СКАЧАТЬ
              </a>
              <button className="btn" onClick={ui.closeLightbox}>
                <Icon name="close" size={13} /> ЗАКРЫТЬ
              </button>
            </div>
          </div>
        )}
      </Modal>

      {showTop && (
        <button className="totop" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} title="Наверх">
          <Icon name="arrowLeft" size={16} className="rotate-up" />
        </button>
      )}
    </div>
  )
}

function ShortcutsModal() {
  const ui = useUI()
  const keys: Array<[string, string]> = [
    ['/', 'Фокус на поиске'],
    ['N', 'Новый пост'],
    ['Space', 'Пауза / воспроизведение'],
    ['G → F', 'Лента'],
    ['G → C', 'Чаты'],
    ['G → G', 'Сообщества'],
    ['G → M', 'Музыка'],
    ['G → V', 'Хранилище'],
    ['G → D', 'Друзья'],
    ['G → N', 'Уведомления'],
    ['?', 'Показать эту подсказку'],
    ['Esc', 'Закрыть окно'],
  ]
  return (
    <Modal open={ui.shortcutsOpen} onClose={() => ui.toggleShortcuts(false)} title="ГОРЯЧИЕ КЛАВИШИ" width={440}>
      <div className="shortcut-grid">
        {keys.map(([k, label]) => (
          <div key={k} className="shortcut-row">
            <kbd>{k}</kbd>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <p className="muted small" style={{ marginTop: 12 }}>
        Клавиши не работают, пока вы печатаете в поле ввода.
      </p>
    </Modal>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider>
        <AppProvider>
          <UIProvider>
            <PlayerProvider>
              <Shell />
            </PlayerProvider>
          </UIProvider>
        </AppProvider>
      </RouterProvider>
    </ToastProvider>
  )
}
