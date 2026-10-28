/**
 * Конфигурация бэкенда.
 *
 * Значения можно переопределить переменными окружения при сборке
 * (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Если их нет, используются
 * публичные ключи проекта LulzForum: anon key не секрет — он по определению
 * уезжает в браузер, а доступ ограничен Row Level Security в базе.
 *
 * Демо-режим (IndexedDB) включается принудительно:
 *   VITE_DEMO=1 npm run dev      или      ?demo=1 в адресе страницы
 */
const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<
  string,
  string | undefined
>

export const DEFAULT_SUPABASE_URL = 'https://ydgvisqgqvabumludfxb.supabase.co'
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkZ3Zpc3FncXZhYnVtbHVkZnhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxOTc5NTAsImV4cCI6MjEwODc3Mzk1MH0.d7ZKyIh21X-sBBGrQ6bhXQaRXJFVYwkcVw7ABYsvvIE'

const forcedDemo = (() => {
  if (ENV.VITE_DEMO === '1') return true
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1'
  } catch {
    return false
  }
})()

export const SUPABASE_URL = ENV.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
export const SUPABASE_ANON_KEY = ENV.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

/** Настроен ли Supabase вообще (ключи есть и демо не запрошено вручную). */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) && !forcedDemo

export interface AuthProviders {
  google: boolean
  email: boolean
  anonymous: boolean
}

/**
 * Спрашиваем у GoTrue, какие провайдеры реально включены. Если запрос не удался
 * (нет сети/старый проект) — возвращаем null и интерфейс работает по умолчанию.
 */
export async function fetchAuthProviders(timeoutMs = 3500): Promise<AuthProviders | null> {
  if (!supabaseConfigured || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      signal: controller.signal,
      headers: { apikey: SUPABASE_ANON_KEY, Accept: 'application/json' },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { external?: Record<string, boolean> }
    const external = json.external ?? {}
    return {
      google: Boolean(external.google),
      email: external.email !== false,
      anonymous: Boolean(external.anonymous ?? external.anonymous_users),
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Ссылка в дашборд Supabase — чтобы включить провайдера было куда нажать. */
export function supabaseProviderUrl(): string {
  const ref = SUPABASE_URL.replace(/^https:\/\//, '').split('.')[0]
  return `https://supabase.com/dashboard/project/${ref}/auth/providers`
}

/** Адрес возврата после OAuth: без hash-роутера, только origin + path. */
export function authRedirectUrl(): string {
  return `${window.location.origin}${window.location.pathname}`
}
