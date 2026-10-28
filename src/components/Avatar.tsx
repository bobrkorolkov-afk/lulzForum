import { useMemo } from 'react'
import { hashCode } from '../lib/util'

/** Детерминированный 8×8 пиксель-идентикон: половина генерируется, половина зеркалится. */
export function identicon(seed: string): string {
  const h = hashCode(seed || 'lulz')
  const cells: boolean[] = []
  let state = h
  for (let i = 0; i < 32; i++) {
    state = (state * 1664525 + 1013904223) >>> 0
    cells.push(((state >>> 8) & 0xff) > 105)
  }
  let rects = ''
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 4; x++) {
      if (!cells[y * 4 + x]) continue
      rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`
      rects += `<rect x="${7 - x}" y="${y}" width="1" height="1"/>`
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges"><rect width="8" height="8" fill="#ffffff"/><g fill="#000000">${rects}</g></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

interface AvatarProps {
  seed: string
  name?: string
  src?: string | null
  size?: number
  ring?: boolean
  className?: string
}

export function Avatar({ seed, name, src, size = 40, ring = false, className }: AvatarProps) {
  const fallback = useMemo(() => identicon(seed || name || 'lulz'), [seed, name])
  const url = src || fallback
  return (
    <span
      className={`avatar ${ring ? 'avatar--ring' : ''} ${className ?? ''}`}
      style={{ width: size, height: size }}
      title={name}
    >
      <img src={url} alt={name ?? 'avatar'} width={size} height={size} loading="lazy" draggable={false} />
    </span>
  )
}
