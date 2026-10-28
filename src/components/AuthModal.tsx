import { useEffect, useState } from 'react'
import { useApp } from '../lib/app'
import { useUI } from '../lib/ui'
import { isEmail, safeNick } from '../lib/util'
import { supabaseProviderUrl } from '../lib/config'
import { Modal } from './ui'
import { Icon } from './Icon'

export function AuthModal() {
  const { authOpen, authMode, closeAuth, openAuth } = useUI()
  const { signIn, signUp, signInDemo, signInWithGoogle, signInWithMagicLink, signInAsGuest, authProviders, mode, offline } =
    useApp()
  const googleReady = authProviders?.google !== false
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [handle, setHandle] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPass, setShowPass] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    if (!authOpen) {
      setError(null)
      setNotice(null)
      setBusy(false)
    }
  }, [authOpen])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!isEmail(email)) {
      setError('Введите корректный e-mail')
      return
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов')
      return
    }
    if (authMode === 'register') {
      const nick = safeNick(handle || name)
      if (nick.length < 2) {
        setError('Ник — минимум 2 символа (латиница, цифры, _ . -)')
        return
      }
    }
    setBusy(true)
    try {
      if (authMode === 'login') {
        await signIn(email, password)
        closeAuth()
      } else {
        const res = await signUp(email, password, safeNick(handle || name), name || handle)
        if (res.needsConfirmation) {
          setNotice('Проверьте почту и подтвердите аккаунт, затем войдите.')
          openAuth('login')
        } else {
          closeAuth()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так')
    } finally {
      setBusy(false)
    }
  }

  const guest = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await signInAsGuest()
      closeAuth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Гостевой вход недоступен')
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await signInWithGoogle()
    } finally {
      setBusy(false)
    }
  }

  const magic = async () => {
    if (!isEmail(email)) {
      setError('Введите e-mail — на него придёт ссылка для входа')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await signInWithMagicLink(email)
      setNotice('Ссылка отправлена. Откройте письмо на этом устройстве — вход произойдёт автоматически.')
    } finally {
      setBusy(false)
    }
  }

  const demo = async () => {
    setBusy(true)
    setError(null)
    try {
      await signInDemo()
      closeAuth()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Демо недоступно')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={authOpen} onClose={closeAuth} title={authMode === 'login' ? 'ВХОД' : 'РЕГИСТРАЦИЯ'} width={460}>
      <div className="auth">
        <div className="auth__mode">
          <button
            className={`auth__tab ${authMode === 'login' ? 'is-active' : ''}`}
            onClick={() => openAuth('login')}
          >
            Войти
          </button>
          <button
            className={`auth__tab ${authMode === 'register' ? 'is-active' : ''}`}
            onClick={() => openAuth('register')}
          >
            Создать аккаунт
          </button>
        </div>

        {mode === 'supabase' && (
          <>
            <button className="btn btn--primary btn--wide" onClick={() => void guest()} disabled={busy} type="button">
              <Icon name="zap" size={14} /> ВОЙТИ В ОДИН КЛИК (ГОСТЬ)
            </button>
            {googleReady ? (
              <button className="btn btn--google btn--wide" onClick={() => void google()} disabled={busy} type="button">
                <span className="google-g" aria-hidden="true">G</span> ВОЙТИ ЧЕРЕЗ GOOGLE
              </button>
            ) : (
              <p className="auth__provider-note">
                Google-вход ещё не включён в проекте Supabase. Включите провайдера в{' '}
                <a href={supabaseProviderUrl()} target="_blank" rel="noopener noreferrer">
                  Authentication → Providers
                </a>{' '}
                (нужен OAuth Client ID из Google Cloud), а пока — гостевой вход или почта.
              </p>
            )}
            <div className="auth__divider">
              <span>или почта и пароль</span>
            </div>
          </>
        )}

        <form className="stack" onSubmit={submit}>
          {authMode === 'register' && (
            <>
              <label className="field">
                <span>Отображаемое имя</span>
                <input
                  className="input"
                  value={name}
                  maxLength={40}
                  placeholder="LULZ LORD"
                  onChange={(e) => {
                    setName(e.target.value)
                    if (!handle) setHandle(safeNick(e.target.value))
                  }}
                />
              </label>
              <label className="field">
                <span>Ник (латиница)</span>
                <input
                  className="input"
                  value={handle}
                  maxLength={24}
                  placeholder="lulz_lord"
                  onChange={(e) => setHandle(safeNick(e.target.value))}
                />
              </label>
            </>
          )}
          <label className="field">
            <span>E-mail</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              placeholder="you@lulzforum.net"
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Пароль</span>
            <span className="input-wrap">
              <input
                className="input"
                type={showPass ? 'text' : 'password'}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                placeholder="минимум 6 символов"
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="btn btn--icon input-wrap__btn" onClick={() => setShowPass((v) => !v)}>
                <Icon name={showPass ? 'lock' : 'eye'} size={14} />
              </button>
            </span>
          </label>

          {error && <div className="alert alert--error">!! {error}</div>}
          {notice && <div className="alert">:: {notice}</div>}

          <button className="btn btn--primary btn--wide" type="submit" disabled={busy}>
            {busy ? 'ПОДОЖДИТЕ…' : authMode === 'login' ? 'ВОЙТИ' : 'СОЗДАТЬ АККАУНТ'}
          </button>

          {mode === 'supabase' && (
            <button className="btn btn--ghost btn--wide" type="button" onClick={() => void magic()} disabled={busy}>
              <Icon name="send" size={13} /> ПРИСЛАТЬ ССЫЛКУ НА ПОЧТУ ВМЕСТО ПАРОЛЯ
            </button>
          )}
        </form>

        {mode === 'local' && (
          <>
            <div className="auth__divider">
              <span>{offline ? 'Supabase недоступен — локальный режим' : 'или'}</span>
            </div>
            <button className="btn btn--wide" onClick={() => void demo()} disabled={busy}>
              <Icon name="user" size={14} /> ВОЙТИ В ДЕМО-АККАУНТ
            </button>
          </>
        )}

        <p className="auth__hint">
          {mode === 'supabase'
            ? 'Аккаунты хранятся в Supabase: Google в один клик, ссылка на почту или обычный пароль. Данные общие для всех, кто зайдёт на сайт.'
            : offline
              ? 'Supabase не ответил (нет сети или проект на паузе), поэтому включён локальный демо-режим. Данные останутся в этом браузере.'
              : 'Supabase не подключён — работает полностью локальный демо-режим. Данные хранятся только в вашем браузере (IndexedDB), аккаунт можно создать на этой же странице.'}
        </p>
      </div>
    </Modal>
  )
}
