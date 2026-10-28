import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { Track } from '../types'
import { useToast } from './toast'
import { useApp } from './app'

export type AuthMode = 'login' | 'register'

interface UIValue {
  authOpen: boolean
  authMode: AuthMode
  openAuth: (mode?: AuthMode) => void
  closeAuth: () => void
  composerOpen: boolean
  composerTrack: Track | null
  composerBody: string
  openComposer: (track?: Track | null, body?: string) => void
  closeComposer: () => void
  lightbox: string | null
  openLightbox: (url: string) => void
  closeLightbox: () => void
  shortcutsOpen: boolean
  toggleShortcuts: (v?: boolean) => void
  requireAuth: (message?: string) => boolean
}

const UIContext = createContext<UIValue | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const { user } = useApp()
  const toast = useToast()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerTrack, setComposerTrack] = useState<Track | null>(null)
  const [composerBody, setComposerBody] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const value = useMemo<UIValue>(
    () => ({
      authOpen,
      authMode,
      openAuth: (mode = 'login') => {
        setAuthMode(mode)
        setAuthOpen(true)
      },
      closeAuth: () => setAuthOpen(false),
      composerOpen,
      composerTrack,
      composerBody,
      openComposer: (track = null, body = '') => {
        if (!user) {
          toast.push('Войдите, чтобы публиковать', 'error')
          setAuthMode('login')
          setAuthOpen(true)
          return
        }
        setComposerTrack(track)
        setComposerBody(body)
        setComposerOpen(true)
      },
      closeComposer: () => {
        setComposerOpen(false)
        setComposerTrack(null)
        setComposerBody('')
      },
      lightbox,
      openLightbox: setLightbox,
      closeLightbox: () => setLightbox(null),
      shortcutsOpen,
      toggleShortcuts: (v) => setShortcutsOpen((s) => (v === undefined ? !s : v)),
      requireAuth: (message = 'Нужно войти в аккаунт') => {
        if (user) return true
        toast.push(message, 'error')
        setAuthMode('login')
        setAuthOpen(true)
        return false
      },
    }),
    [authOpen, authMode, composerOpen, composerTrack, composerBody, lightbox, shortcutsOpen, user, toast],
  )

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export function useUI(): UIValue {
  const ctx = useContext(UIContext)
  if (!ctx) throw new Error('useUI must be used inside UIProvider')
  return ctx
}
