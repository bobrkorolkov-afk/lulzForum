import type { Track } from '../types'
import { md5 } from './md5'

/* ---------------------------------------------------------------------------
 * ZAYCEV.NET
 *
 * У Зайцева есть открытый mobile-API (api.zaycev.net/external): hello → подпись
 * MD5(token + staticKey) → access token → поиск. Из браузера он упирается в CORS:
 * сервер не отдаёт Access-Control-Allow-Origin, поэтому запрос идёт либо напрямую
 * (если CORS когда-нибудь включат), либо через ваш прокси, либо через публичный
 * CORS-прокси (по желанию пользователя).
 *
 * Настройки хранятся в localStorage, env-переменная VITE_ZAYCEV_PROXY задаёт
 * свой прокси по умолчанию — см. README.
 * ------------------------------------------------------------------------- */

const API = 'https://api.zaycev.net/external'
const SITE = 'https://zaycev.net'
// Ключ подписи из клиента приложения; Zaycev меняет его между версиями,
// поэтому пробуем известные варианты по порядку.
const STATIC_KEYS = ['kmskoNdkYHDnl3ol3', '63kQw2LlpV3jv', 'd7DVdaELf']
const SETTINGS_KEY = 'lulzforum:zaycev'
const TOKEN_KEY = 'lulzforum:zaycev-token'

export type ZaycevProxyMode = 'auto' | 'public' | 'direct' | 'custom'

export interface ZaycevSettings {
  mode: ZaycevProxyMode
  customUrl: string
}

const ENV = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {}) as Record<
  string,
  string | undefined
>

const defaultProxy = ENV.VITE_ZAYCEV_PROXY ?? ''

export function getZaycevSettings(): ZaycevSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ZaycevSettings>
      return {
        mode: (parsed.mode as ZaycevProxyMode) ?? (defaultProxy ? 'custom' : 'auto'),
        customUrl: parsed.customUrl ?? defaultProxy,
      }
    }
  } catch {
    /* ignore */
  }
  return { mode: defaultProxy ? 'custom' : 'auto', customUrl: defaultProxy }
}

export function setZaycevSettings(next: ZaycevSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

const PUBLIC_PROXIES: Array<(url: string) => string> = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
]

function customProxyUrl(custom: string, url: string): string {
  if (custom.includes('%s')) return custom.replace('%s', encodeURIComponent(url))
  if (custom.includes('{url}')) return custom.replace('{url}', encodeURIComponent(url))
  return `${custom}${custom.includes('?') ? '' : '?'}${custom.includes('=') ? '' : 'url='}${encodeURIComponent(url)}`
}

async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const cleaned = text.replace(/^\uFEFF/, '').trim()
    return JSON.parse(cleaned) as T
  } finally {
    clearTimeout(timer)
  }
}

function attemptsFor(target: string): string[] {
  const settings = getZaycevSettings()
  switch (settings.mode) {
    case 'direct':
      return [target]
    case 'custom':
      return settings.customUrl ? [customProxyUrl(settings.customUrl, target)] : [target]
    case 'public':
      return PUBLIC_PROXIES.map((p) => p(target))
    default:
      return [target, ...PUBLIC_PROXIES.map((p) => p(target))]
  }
}

async function fetchText(target: string, timeoutMs = 12_000): Promise<string> {
  let lastError: unknown = null
  for (const url of attemptsFor(target)) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.text()
    } catch (error) {
      lastError = error
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(`Zaycev недоступен из браузера. ${lastError instanceof Error ? lastError.message : ''}`.trim())
}

async function requestApi<T>(path: string, timeoutMs = 9000): Promise<T> {
  const target = `${API}${path}`
  let lastError: unknown = null
  for (const url of attemptsFor(target)) {
    try {
      const json = await fetchJson<T>(url, timeoutMs)
      return json
    } catch (error) {
      lastError = error
    }
  }
  const settings = getZaycevSettings()
  const hint =
    settings.mode === 'direct' || (settings.mode === 'custom' && !settings.customUrl)
      ? 'включите прокси в настройках музыки'
      : 'прокси не ответил — попробуйте другой или свой'
  throw new Error(`Zaycev недоступен из браузера (CORS): ${hint}. ${lastError instanceof Error ? lastError.message : ''}`.trim())
}

let tokenCache: { token: string; expires: number } | null = null

async function getAccessToken(force = false): Promise<string> {
  if (!force) {
    if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token
    try {
      const raw = sessionStorage.getItem(TOKEN_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { token: string; expires: number }
        if (parsed.expires > Date.now()) {
          tokenCache = parsed
          return parsed.token
        }
      }
    } catch {
      /* ignore */
    }
  }

  const hello = await requestApi<{ token?: string }>('/hello')
  if (!hello?.token) throw new Error('Zaycev: не удалось получить hello-токен')
  let accessToken: string | undefined
  for (const key of STATIC_KEYS) {
    const hash = md5(hello.token + key)
    try {
      const auth = await requestApi<{ token?: string }>(
        `/auth?code=${encodeURIComponent(hello.token)}&hash=${hash}`,
        8000,
      )
      if (auth?.token) {
        accessToken = auth.token
        break
      }
    } catch {
      /* пробуем следующий ключ */
    }
  }
  if (!accessToken) throw new Error('Zaycev: сервис отклонил авторизацию (изменился API)')
  const value = { token: accessToken, expires: Date.now() + 25 * 60_000 }
  tokenCache = value
  try {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(value))
  } catch {
    /* ignore */
  }
  return accessToken
}

/* ------------------------------------------------------------------ парсинг */

type AnyRecord = Record<string, unknown>

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' ? (value as AnyRecord) : {}
}

function pickString(source: AnyRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

function parseDuration(value: unknown): number | undefined {
  if (typeof value === 'number' && value > 0) return value
  if (typeof value === 'string') {
    const mmss = value.match(/^(\d{1,2}):(\d{2})$/)
    if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2])
    if (/^\d+$/.test(value)) return Number(value)
  }
  return undefined
}

function absolute(url?: string): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  return `https://zaycev.net${url.startsWith('/') ? '' : '/'}${url}`
}

function parseTrack(raw: unknown): Track | null {
  const item = asRecord(raw)
  const id =
    pickString(item, ['trackId', 'id', 'track_id']) ??
    pickString(asRecord(item.track), ['trackId', 'id'])
  if (!id) return null
  const nested = asRecord(item.track)
  const artist =
    pickString(item, ['artistName', 'artist', 'artist_name']) ??
    pickString(asRecord(item.artist), ['name']) ??
    pickString(nested, ['artistName']) ??
    'ZAYCEV'
  const title =
    pickString(item, ['fullName', 'name', 'title', 'trackName', 'track']) ??
    pickString(nested, ['name', 'title']) ??
    `Трек ${id}`

  const artwork =
    pickString(item, [
      'artistImageUrlSquare250',
      'artistImageUrlSquare100',
      'imageUrl',
      'albumImageUrl',
      'cover',
      'image',
    ]) ??
    pickString(nested, ['artwork', 'image'])

  const stream =
    pickString(item, ['playUrl', 'dlUrl', 'streamUrl', 'url', 'mp3']) ??
    pickString(nested, ['playUrl', 'url'])

  const page = pickString(item, ['pageUrl', 'externalUrl', 'link', 'webUrl'])
  const cleanArtist = artist.replace(/\s*-\s*$/, '').trim()
  const cleanTitle = title.startsWith(`${cleanArtist} - `) ? title.slice(cleanArtist.length + 3) : title

  return {
    id: `zaycev:${id}`,
    provider: 'zaycev',
    title: cleanTitle,
    artist: cleanArtist,
    artwork: absolute(artwork) ?? null,
    duration: parseDuration(item.duration ?? item.time ?? nested.duration),
    streamUrl: absolute(stream) ?? null,
    externalUrl: absolute(page) ?? `https://zaycev.net/search.html?query_search=${encodeURIComponent(`${artist} ${title}`)}`,
  }
}

function extractTracks(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  const root = asRecord(payload)
  const candidates = [root.tracks, root.results, root.items, asRecord(root.data).tracks, root.data, asRecord(root.response).tracks]
  for (const candidate of candidates) if (Array.isArray(candidate)) return candidate
  return []
}

/* --------------------------------------------------------------------- API */

/** Запасной путь: разбираем обычную страницу поиска Zaycev.net (нужен DOMParser). */
export async function searchZaycevHtml(query: string, limit = 8): Promise<Track[]> {
  if (typeof DOMParser === 'undefined') return []
  const q = query.trim()
  if (!q) return []
  const html = await fetchText(`${SITE}/search?query_search=${encodeURIComponent(q)}&type=all`, 11_000)
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href*="/pages/"]'))
  const seen = new Set<string>()
  const tracks: Track[] = []

  for (const link of links) {
    const match = link.getAttribute('href')?.match(/\/pages\/\d+\/(\d+)\.shtml/)
    if (!match) continue
    const id = match[1]
    if (seen.has(id)) continue
    const raw = (link.getAttribute('title') ?? link.textContent ?? '').trim()
    if (!raw) continue
    const container = link.closest('li, article, div') ?? link
    const img = container.querySelector('img')
    const durationText = (container.textContent ?? '').match(/\b(\d{1,2}):(\d{2})\b/)
    const [artistPart, ...rest] = raw.split(' - ')
    const artist = rest.length ? artistPart.trim() : 'ZAYCEV.NET'
    const title = rest.length ? rest.join(' - ').trim() : raw

    seen.add(id)
    tracks.push({
      id: `zaycev:${id}`,
      provider: 'zaycev',
      title,
      artist,
      artwork: absolute(img?.getAttribute('src') ?? undefined) ?? null,
      duration: durationText ? Number(durationText[1]) * 60 + Number(durationText[2]) : undefined,
      streamUrl: null,
      externalUrl: absolute(link.getAttribute('href') ?? undefined) ?? `${SITE}/pages/${id}.shtml`,
    })
    if (tracks.length >= limit) break
  }
  return tracks
}

export async function searchZaycev(query: string, limit = 8): Promise<Track[]> {
  const q = query.trim()
  if (!q) return []
  try {
    const token = await getAccessToken()
    const path = `/search?query=${encodeURIComponent(q)}&page=1&type=all&sort=&style=&access_token=${encodeURIComponent(token)}`
    const payload = await requestApi<unknown>(path, 6000)
    const tracks = extractTracks(payload)
      .map(parseTrack)
      .filter((t): t is Track => Boolean(t))
    if (tracks.length) return tracks.slice(0, limit)
  } catch {
    /* API недоступен — идём на страницу поиска */
  }
  return searchZaycevHtml(q, limit)
}

export function isZaycevUrl(url: string): boolean {
  return /(^|\.)zaycev\.net\//i.test(url)
}

export function zaycevTrackId(url: string): string | null {
  const patterns = [/\/pages\/\d+\/(\d+)\.shtml/i, /\/track\/(\d+)/i, /[?&]track(?:Id|_id)?=(\d+)/i, /\/music\/track\/(\d+)/i]
  for (const re of patterns) {
    const match = url.match(re)
    if (match) return match[1]
  }
  return null
}

/** Достраивает трек по ссылке на zaycev.net: тянет метаданные из API, иначе — заглушка. */
export async function resolveZaycevLink(url: string): Promise<Track> {
  const id = zaycevTrackId(url)
  const fallback: Track = {
    id: `zaycev:${id ?? encodeURIComponent(url)}`,
    provider: 'zaycev',
    title: id ? `Zaycev · трек ${id}` : 'Трек с Zaycev.net',
    artist: 'ZAYCEV.NET',
    artwork: null,
    streamUrl: null,
    externalUrl: url,
  }
  if (!id) return fallback
  try {
    const token = await getAccessToken()
    const payload = await requestApi<unknown>(`/track/${id}?access_token=${encodeURIComponent(token)}`)
    const root = asRecord(payload)
    const raw = root.track ?? root.data ?? payload
    const parsed = parseTrack({ ...asRecord(raw), trackId: id })
    if (!parsed) return fallback
    return { ...parsed, externalUrl: url }
  } catch {
    return fallback
  }
}

export const ZAYCEV_PROVIDER_LABEL = 'ZAYCEV'
