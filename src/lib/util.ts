export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))

export function plural(n: number, forms: [string, string, string]) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last > 1 && last < 5) return forms[1]
  if (last === 1) return forms[0]
  return forms[2]
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const diff = Math.max(0, Date.now() - then)
  const sec = Math.floor(diff / 1000)
  if (sec < 45) return 'только что'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} ${plural(min, ['минуту', 'минуты', 'минут'])} назад`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs} ${plural(hrs, ['час', 'часа', 'часов'])} назад`
  const days = Math.floor(hrs / 24)
  if (days < 8) return `${days} ${plural(days, ['день', 'дня', 'дней'])} назад`
  return new Date(then).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 Б'
  const units = ['Б', 'КБ', 'МБ', 'ГБ']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const val = bytes / Math.pow(1024, i)
  return `${val >= 10 || i === 0 ? Math.round(val) : val.toFixed(1)} ${units[i]}`
}

export function formatDuration(sec?: number): string {
  if (!sec || !Number.isFinite(sec)) return '—:—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28)
}

export function extractTags(body: string, extra: string[] = []): string[] {
  const inline = Array.from(body.matchAll(/#([\p{L}\p{N}_-]{1,28})/gu)).map((m) => normalizeTag(m[1]))
  const all = [...inline, ...extra.map(normalizeTag)]
  return Array.from(new Set(all.filter(Boolean))).slice(0, 8)
}

export function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms = 300) {
  let t: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
}

export function fileKind(mime: string, name = ''): 'image' | 'audio' | 'video' | 'doc' | 'archive' | 'other' {
  const n = name.toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('text/') || /\.(pdf|docx?|txt|md|rtf|epub)$/.test(n)) return 'doc'
  if (/\.(zip|rar|7z|gz|tar)$/.test(n)) return 'archive'
  return 'other'
}

export function formatCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10000) return `${(n / 1000).toFixed(1).replace('.0', '')}к`
  return `${Math.round(n / 1000)}к`
}

export function isImageUrl(url: string): boolean {
  return /^data:image\//.test(url) || /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url)
}

/** Downscale + compress an image in the browser so it fits comfortably in storage. */
export async function compressImage(file: File, maxSide = 1400, quality = 0.82): Promise<string> {
  const dataUrl = await readAsDataURL(file)
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return dataUrl
  const img = await loadImage(dataUrl)
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', quality)
}

export function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.target = '_blank'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Stable hash used for identicon avatars. */
export function hashCode(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function safeNick(handle: string): string {
  return handle.trim().toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_.-]/g, '').slice(0, 24)
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
}

export function classNames(...xs: Array<string | false | null | undefined>): string {
  return xs.filter(Boolean).join(' ')
}
