import { useEffect, useState } from 'react'
import { backend, useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { useToast } from '../lib/toast'
import { LocalBackend } from '../lib/localBackend'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { EmptyState } from '../components/ui'
import { supabaseConfigured } from '../lib/app'
import { downloadUrl, formatBytes } from '../lib/util'

export function SettingsPage() {
  const { user, signOut, files, tracks, posts, mode } = useApp()
  const { navigate } = useRouter()
  const ui = useUI()
  const toast = useToast()
  const [reduceMotion, setReduceMotion] = useState(
    () => localStorage.getItem('lulzforum:reduce-motion') === '1',
  )

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
    localStorage.setItem('lulzforum:reduce-motion', reduceMotion ? '1' : '0')
  }, [reduceMotion])


  if (!user) {
    return (
      <div className="page">
        <EmptyState
          icon="settings"
          title="Настройки после входа"
          hint="Войдите, чтобы управлять профилем и данными."
          action={
            <button className="btn btn--primary" onClick={() => ui.openAuth('login')}>
              ВОЙТИ
            </button>
          }
        />
      </div>
    )
  }

  const local = backend as unknown as LocalBackend

  const exportData = async () => {
    if (typeof local.exportData !== 'function') {
      toast.push('Экспорт доступен только в демо-режиме', 'error')
      return
    }
    try {
      const json = await local.exportData()
      const blob = new Blob([json], { type: 'application/json' })
      downloadUrl(URL.createObjectURL(blob), `lulzforum-backup-${new Date().toISOString().slice(0, 10)}.json`)
      toast.push('Резервная копия скачана', 'ok')
    } catch {
      toast.push('Не удалось создать копию', 'error')
    }
  }

  const resetAll = async () => {
    if (!confirm('Сбросить все демо-данные? Посты, чаты и файлы будут удалены безвозвратно.')) return
    try {
      await local.resetData()
      window.location.hash = '#/'
      window.location.reload()
    } catch {
      toast.push('Не удалось сбросить данные', 'error')
    }
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">НАСТРОЙКИ</h1>
          <p className="page__sub">Аккаунт, внешний вид и данные</p>
        </div>
      </div>

      <section className="card settings-card">
        <h3>
          <Icon name="user" size={14} /> АККАУНТ
        </h3>
        <div className="settings-account">
          <Avatar seed={user.handle} name={user.name} src={user.avatarUrl} size={56} />
          <div className="settings-account__text">
            <b>{user.name}</b>
            <span>@{user.handle}</span>
            <span className="chip chip--tiny">{mode === 'local' ? 'ДЕМО · LOCAL' : 'SUPABASE'}</span>
          </div>
          <div className="settings-account__actions">
            <button className="btn" onClick={() => navigate(`/u/${user.handle}`)}>
              ПРОФИЛЬ
            </button>
            <button className="btn btn--danger" onClick={() => void signOut()}>
              <Icon name="logout" size={13} /> ВЫЙТИ
            </button>
          </div>
        </div>
      </section>

      <section className="card settings-card">
        <h3>
          <Icon name="settings" size={14} /> ВНЕШНИЙ ВИД
        </h3>
        <div className="settings-row">
          <div>
            <b>Меньше анимации</b>
            <p className="muted small">Отключает маркизу, мигание и переходы. Полезно для слабых устройств.</p>
          </div>
          <button className={`switch ${reduceMotion ? 'is-on' : ''}`} onClick={() => setReduceMotion((v) => !v)} role="switch" aria-checked={reduceMotion}>
            <span />
          </button>
        </div>
        <div className="settings-row">
          <div>
            <b>Палитра</b>
            <p className="muted small">LulzForum намеренно чёрно-белый: 1-битный стиль, никаких компромиссов.</p>
          </div>
          <span className="swatches">
            <i style={{ background: '#000' }} />
            <i style={{ background: '#fff' }} />
          </span>
        </div>
      </section>

      <section className="card settings-card">
        <h3>
          <Icon name="vault" size={14} /> ВАШИ ДАННЫЕ
        </h3>
        <div className="settings-stats">
          <span>
            <b>{posts.filter((p) => p.authorId === user.id).length}</b> постов
          </span>
          <span>
            <b>{tracks.length}</b> треков
          </span>
          <span>
            <b>{files.length}</b> файлов
          </span>
          <span>
            <b>{formatBytes(files.reduce((s, f) => s + f.size, 0))}</b> в хранилище
          </span>
        </div>
        <div className="settings-actions">
          <button className="btn" onClick={() => void exportData()}>
            <Icon name="download" size={13} /> ЭКСПОРТ ДАННЫХ
          </button>
          <button className="btn btn--danger" onClick={() => void resetAll()}>
            <Icon name="trash" size={13} /> СБРОСИТЬ ДЕМО-ДАННЫЕ
          </button>
        </div>
        <p className="muted small">
          {supabaseConfigured
            ? 'Данные хранятся в вашем Supabase-проекте. Экспорт и сброс доступны только в демо-режиме.'
            : 'Демо-режим: всё лежит в IndexedDB вашего браузера. Экспорт сохранит посты, чаты, файлы и музыку в JSON.'}
        </p>
      </section>

      <section className="card settings-card">
        <h3>
          <Icon name="chat" size={14} /> ГОРЯЧИЕ КЛАВИШИ
        </h3>
        <ul className="shortcut-list">
          <li>
            <kbd>/</kbd> — фокус на поиске
          </li>
          <li>
            <kbd>N</kbd> — новый пост
          </li>
          <li>
            <kbd>G</kbd> затем <kbd>F</kbd> — лента
          </li>
          <li>
            <kbd>G</kbd> затем <kbd>C</kbd> — чаты
          </li>
          <li>
            <kbd>G</kbd> затем <kbd>M</kbd> — музыка
          </li>
          <li>
            <kbd>G</kbd> затем <kbd>V</kbd> — хранилище
          </li>
          <li>
            <kbd>Space</kbd> — пауза/плей в плеере
          </li>
          <li>
            <kbd>?</kbd> — это окно
          </li>
          <li>
            <kbd>Esc</kbd> — закрыть окно
          </li>
        </ul>
      </section>

      <section className="card settings-card">
        <h3>
          <Icon name="lock" size={14} /> ПРИВАТНОСТЬ
        </h3>
        <ul className="tips">
          <li>Хранилище файлов приватное: доступ только у владельца аккаунта.</li>
          <li>Музыка и плейлисты не публикуются в ленту автоматически — только если прикрепите трек к посту.</li>
          <li>Чаты видят только участники (RLS-политики Supabase).</li>
          <li>Пароли хранит Supabase Auth, LulzForum их не видит.</li>
        </ul>
      </section>
    </div>
  )
}
