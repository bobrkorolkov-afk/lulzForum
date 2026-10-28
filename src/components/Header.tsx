import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { ThemeSwitch } from './ThemeSwitch'

export function Header({ onMenu }: { onMenu: () => void }) {
  const { user, unreadMessages, unreadNotifications, signOut, mode, offline } = useApp()
  const { navigate, route } = useRouter()
  const ui = useUI()
  const [query, setQuery] = useState(route.query.get('q') ?? '')
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setQuery(route.query.get('q') ?? '')
  }, [route.query])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <header className="header">
      <div className="header__left">
        <button className="btn btn--icon header__burger" onClick={onMenu} aria-label="Меню">
          <Icon name="menu" size={16} />
        </button>
        <button className="logo" onClick={() => navigate('/')} aria-label="LulzForum — на главную">
          <span className="logo__mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <span className="logo__text">LULZFORUM</span>
        </button>
        <span
          className={`mode-chip mode-chip--${mode}`}
          title={
            offline
              ? 'Supabase не ответил — локальный демо-режим'
              : mode === 'supabase'
                ? 'Данные в Supabase: общие для всех'
                : 'Демо-режим: данные в этом браузере'
          }
        >
          {mode === 'local' ? (offline ? 'DEMO · OFFLINE' : 'DEMO') : 'SUPABASE'}
        </span>
      </div>

      <form className="search" onSubmit={submit} role="search">
        <Icon name="search" size={14} className="search__icon" />
        <input
          ref={inputRef}
          className="search__input"
          value={query}
          placeholder="Поиск по форуму, людям и тегам…  ( / )"
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="search__clear" onClick={() => setQuery('')} aria-label="Очистить">
            <Icon name="close" size={12} />
          </button>
        )}
      </form>

      <div className="header__right">
        <button
          className="btn btn--primary header__compose"
          onClick={() => ui.openComposer()}
          title="Новый пост (N)"
        >
          <Icon name="plus" size={14} /> <span>ПОСТ</span>
        </button>

        <span className="header__theme">
          <ThemeSwitch compact />
        </span>

        <button className="header__icon-btn" onClick={() => navigate('/groups')} title="Сообщества">
          <Icon name="users" size={17} />
        </button>

        <button className="header__icon-btn header__icon-btn--music" onClick={() => navigate('/music')} title="Музыка">
          <Icon name="music" size={17} />
        </button>

        <button className="header__icon-btn" onClick={() => navigate('/chats')} title="Чаты">
          <Icon name="chat" size={17} />
          {unreadMessages > 0 && <span className="badge badge--dot">{unreadMessages}</span>}
        </button>

        <button className="header__icon-btn" onClick={() => navigate('/notifications')} title="Уведомления">
          <Icon name="bell" size={17} />
          {unreadNotifications > 0 && <span className="badge badge--dot">{unreadNotifications}</span>}
        </button>

        {user ? (
          <div className="usermenu">
            <button className="usermenu__btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Профиль">
              <Avatar seed={user.handle} name={user.name} src={user.avatarUrl} size={30} />
            </button>
            {menuOpen && (
              <>
                <button className="menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Закрыть" />
                <div className="menu menu--right">
                  <div className="menu__head">
                    <b>{user.name}</b>
                    <span>@{user.handle}</span>
                  </div>
                  <button
                    className="menu__item"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate(`/u/${user.handle}`)
                    }}
                  >
                    <Icon name="user" size={14} /> Мой профиль
                  </button>
                  <button
                    className="menu__item"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/vault')
                    }}
                  >
                    <Icon name="vault" size={14} /> Хранилище
                  </button>
                  <button
                    className="menu__item"
                    onClick={() => {
                      setMenuOpen(false)
                      navigate('/settings')
                    }}
                  >
                    <Icon name="settings" size={14} /> Настройки
                  </button>
                  <button
                    className="menu__item menu__item--danger"
                    onClick={() => {
                      setMenuOpen(false)
                      void signOut()
                    }}
                  >
                    <Icon name="logout" size={14} /> Выйти
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button className="btn" onClick={() => ui.openAuth('login')}>
            <Icon name="user" size={14} /> <span>ВОЙТИ</span>
          </button>
        )}
      </div>
    </header>
  )
}
