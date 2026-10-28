import { useEffect, useState } from 'react'
import { supabaseConfigured, useApp } from '../lib/app'
import { useUI } from '../lib/ui'
import { isEmail, safeNick } from '../lib/util'
import { Modal } from './ui'
import { Icon } from './Icon'

export function AuthModal() {
  const { authOpen, authMode, closeAuth, openAuth } = useUI()
  const { signIn, signUp, signInDemo, mode } = useApp()
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
        </form>

        {mode === 'local' && (
          <>
            <div className="auth__divider">
              <span>или</span>
            </div>
            <button className="btn btn--wide" onClick={() => void demo()} disabled={busy}>
              <Icon name="user" size={14} /> ВОЙТИ В ДЕМО-АККАУНТ
            </button>
          </>
        )}

        <p className="auth__hint">
          {supabaseConfigured
            ? 'Аккаунты Supabase: почта + пароль. После регистрации может понадобиться подтверждение почты.'
            : 'Supabase не подключён — работает полностью локальный демо-режим. Данные хранятся только в вашем браузере (IndexedDB), аккаунт можно создать на этой же странице.'}
        </p>
      </div>
    </Modal>
  )
}
