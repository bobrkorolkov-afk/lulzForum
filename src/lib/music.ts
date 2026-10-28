import type { Track, TrackProvider } from '../types'

/* ---------------------------------------------------------------------------
 * Поиск музыки «по всему интернету» без API-ключей и без сервера:
 *  • Audius      — открытый музыкальный протокол, полноценные стримы
 *  • iTunes      — огромный каталог Apple, 30-секундные превью
 *  • Openverse   — Creative Commons аудио (Freesound, Jamendo и др.)
 *  • Ссылка      — SoundCloud, Яндекс Музыка, Bandcamp, YouTube, прямой mp3
 * ------------------------------------------------------------------------- */

let audiusHost: string | null = null

async function getAudiusHost(): Promise<string | null> {
  if (audiusHost) return audiusHost
  try {
    const res = await fetch('https://api.audius.co')
    const json = (await res.json()) as { data?: string[] }
    const host = json.data?.[0]
    if (host) {
      audiusHost = host
      return host
    }
  } catch {
    /* network blocked */
  }
  return null
}

export const AUDIUS_APP = 'LulzForum'

async function searchAudius(query: string, limit: number): Promise<Track[]> {
  const host = await getAudiusHost()
  if (!host) return []
  const url = `${host}/v1/tracks/search?query=${encodeURIComponent(query)}&app_name=${AUDIUS_APP}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) return []
  const json = (await res.json()) as { data?: AudiusTrack[] }
  return (json.data ?? []).map((t) => ({
    id: `audius:${t.id}`,
    provider: 'audius' as const,
    title: t.title,
    artist: t.user?.name ?? 'Audius',
    artwork: t.artwork?.['480x480'] ?? t.artwork?.['150x150'] ?? null,
    duration: t.duration,
    streamUrl: `${host}/v1/tracks/${t.id}/stream?app_name=${AUDIUS_APP}`,
    externalUrl: `https://audius.co${t.permalink ?? ''}`,
  }))
}

interface AudiusTrack {
  id: string
  title: string
  duration?: number
  permalink?: string
  artwork?: Record<string, string>
  user?: { name?: string }
}

async function searchItunes(query: string, limit: number): Promise<Track[]> {
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) return []
  const json = (await res.json()) as { results?: ItunesTrack[] }
  return (json.results ?? [])
    .filter((r) => r.previewUrl)
    .map((r) => ({
      id: `itunes:${r.trackId}`,
      provider: 'itunes' as const,
      title: r.trackName ?? 'Без названия',
      artist: r.artistName ?? 'iTunes',
      artwork: r.artworkUrl100 ? r.artworkUrl100.replace('100x100bb', '300x300bb') : null,
      duration: Math.round((r.trackTimeMillis ?? 30000) / 1000),
      streamUrl: r.previewUrl ?? null,
      externalUrl: r.trackViewUrl ?? `https://music.apple.com/search?term=${encodeURIComponent(r.trackName ?? '')}`,
    }))
}

interface ItunesTrack {
  trackId: number
  trackName?: string
  artistName?: string
  artworkUrl100?: string
  previewUrl?: string
  trackTimeMillis?: number
  trackViewUrl?: string
}

interface OpenverseAudio {
  id: string
  title: string
  creator?: string
  url?: string
  thumbnail?: string
  duration?: number
  foreign_landing_url?: string
  provider?: string
}

async function searchOpenverse(query: string, limit: number): Promise<Track[]> {
  const url = `https://api.openverse.org/v1/audio/?q=${encodeURIComponent(query)}&page_size=${limit}&license_type=all`
  const res = await fetch(url)
  if (!res.ok) return []
  const json = (await res.json()) as { results?: OpenverseAudio[] }
  return (json.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      id: `openverse:${r.id}`,
      provider: 'link' as const,
      title: r.title || 'Без названия',
      artist: r.creator ?? r.provider ?? 'Openverse',
      artwork: r.thumbnail ?? null,
      duration: r.duration ? Math.round(r.duration / 1000) : undefined,
      streamUrl: r.url ?? null,
      externalUrl: r.foreign_landing_url ?? 'https://openverse.org',
    }))
}

export interface SearchResult {
  tracks: Track[]
  errors: string[]
}

export async function searchMusic(query: string, limitPerSource = 8): Promise<SearchResult> {
  const q = query.trim()
  if (!q) return { tracks: [], errors: [] }
  const errors: string[] = []
  const [audius, itunes, openverse] = await Promise.all([
    searchAudius(q, limitPerSource).catch(() => {
      errors.push('Audius недоступен')
      return [] as Track[]
    }),
    searchItunes(q, limitPerSource).catch(() => {
      errors.push('iTunes недоступен')
      return [] as Track[]
    }),
    searchOpenverse(q, Math.max(4, Math.floor(limitPerSource / 2))).catch(() => {
      errors.push('Openverse недоступен')
      return [] as Track[]
    }),
  ])
  const seen = new Set<string>()
  const tracks: Track[] = []
  for (const t of [...audius, ...itunes, ...openverse]) {
    const key = `${t.title}|${t.artist}`.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tracks.push(t)
  }
  return { tracks, errors }
}

/* ------------------------------------------------------------- link parsing */

const YT_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i
const SC_RE = /soundcloud\.com\//i
const YANDEX_RE = /music\.yandex\.[a-z]+\/(album\/(\d+)\/track\/(\d+)|track\/(\d+)(?:\/(\d+))?|album\/(\d+))/i
const BANDCAMP_RE = /\.bandcamp\.com\/track\//i
const AUDIO_RE = /\.(mp3|ogg|oga|wav|flac|m4a|aac|opus)(\?.*)?$/i

export interface ResolvedLink {
  track: Track
  note?: string
}

/** Превратить любую ссылку на музыку в объект Track. */
export function resolveMusicLink(raw: string): ResolvedLink {
  const url = raw.trim()
  if (!/^https?:\/\//i.test(url)) throw new Error('Нужна ссылка, начинающаяся с http(s)://')

  const yt = url.match(YT_RE)
  if (yt) {
    return {
      track: {
        id: `youtube:${yt[1]}`,
        provider: 'link',
        title: 'Трек с YouTube',
        artist: 'YouTube',
        artwork: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
        embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}`,
        externalUrl: url,
      },
      note: 'YouTube-плеер откроется во встроенном окне',
    }
  }

  if (SC_RE.test(url)) {
    return {
      track: {
        id: `soundcloud:${encodeURIComponent(url)}`,
        provider: 'soundcloud',
        title: guessTitleFromUrl(url),
        artist: 'SoundCloud',
        embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23000000&hide_related=true&show_comments=false&show_teaser=false`,
        externalUrl: url,
      },
      note: 'SoundCloud играет во встроенном плеере',
    }
  }

  const ym = url.match(YANDEX_RE)
  if (ym) {
    const trackId = ym[3] ?? ym[4]
    const albumId = ym[2] ?? ym[5] ?? ym[6]
    const embed = trackId
      ? `https://music.yandex.ru/iframe/#track/${trackId}/${albumId ?? ''}`
      : `https://music.yandex.ru/iframe/#album/${albumId}`
    return {
      track: {
        id: `yandex:${trackId ?? albumId}`,
        provider: 'yandex',
        title: trackId ? `Яндекс Музыка · трек ${trackId}` : `Яндекс Музыка · альбом ${albumId}`,
        artist: 'Яндекс Музыка',
        embedUrl: embed,
        externalUrl: url,
      },
      note: 'Яндекс Музыка требует входа в аккаунт для полного прослушивания',
    }
  }

  if (BANDCAMP_RE.test(url)) {
    return {
      track: {
        id: `bandcamp:${encodeURIComponent(url)}`,
        provider: 'link',
        title: guessTitleFromUrl(url),
        artist: 'Bandcamp',
        externalUrl: url,
      },
    }
  }

  if (AUDIO_RE.test(url)) {
    return {
      track: {
        id: `link:${encodeURIComponent(url)}`,
        provider: 'link',
        title: decodeURIComponent(url.split('/').pop() ?? 'Аудио').replace(/\.[a-z0-9]+$/i, ''),
        artist: new URL(url).hostname.replace(/^www\./, ''),
        streamUrl: url,
        externalUrl: url,
      },
    }
  }

  return {
    track: {
      id: `web:${encodeURIComponent(url)}`,
      provider: 'link',
      title: guessTitleFromUrl(url),
      artist: new URL(url).hostname.replace(/^www\./, ''),
      externalUrl: url,
    },
    note: 'Прямого потока нет — трек сохранён как ссылка',
  }
}

function guessTitleFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? u.hostname)
    return last.replace(/[-_]+/g, ' ').replace(/\.[a-z0-9]+$/i, '') || u.hostname
  } catch {
    return url
  }
}

export const PROVIDER_LABEL: Record<TrackProvider, string> = {
  audius: 'AUDIUS',
  itunes: 'ITUNES',
  soundcloud: 'SOUNDCLOUD',
  yandex: 'ЯНДЕКС',
  link: 'LINK',
}

export function isPlayable(track: Track): boolean {
  return Boolean(track.streamUrl)
}

export function hasEmbed(track: Track): boolean {
  return Boolean(track.embedUrl)
}

/** Подсказки для пустого поиска. */
export const SEARCH_HINTS = ['lofi hip hop', 'битмейкинг', 'synthwave', 'чиптюн', 'ambient', 'пост-панк']
