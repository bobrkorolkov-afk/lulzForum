import { Fragment, type ReactNode } from 'react'
import { useRouter } from '../lib/router'

const TOKEN_RE = /(#[\p{L}\p{N}_-]{1,28})|(@[a-z0-9_.-]{2,24})|(https?:\/\/[^\s<]+)/giu

export function RichText({ text }: { text: string }) {
  const { navigate } = useRouter()

  const renderLine = (line: string, lineKey: number): ReactNode => {
    const parts: ReactNode[] = []
    let cursor = 0
    let k = 0
    for (const match of line.matchAll(TOKEN_RE)) {
      const idx = match.index ?? 0
      if (idx > cursor) parts.push(<Fragment key={`t${lineKey}-${k++}`}>{line.slice(cursor, idx)}</Fragment>)
      const token = match[0]
      if (token.startsWith('#')) {
        const tag = token.slice(1).toLowerCase()
        parts.push(
          <button
            key={`t${lineKey}-${k++}`}
            className="inline-tag"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/tag/${encodeURIComponent(tag)}`)
            }}
          >
            {token}
          </button>,
        )
      } else if (token.startsWith('@')) {
        parts.push(
          <button
            key={`t${lineKey}-${k++}`}
            className="inline-tag"
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/u/${token.slice(1)}`)
            }}
          >
            {token}
          </button>,
        )
      } else {
        parts.push(
          <a
            key={`t${lineKey}-${k++}`}
            href={token}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-link"
            onClick={(e) => e.stopPropagation()}
          >
            {token.replace(/^https?:\/\//, '').slice(0, 42)}
          </a>,
        )
      }
      cursor = idx + token.length
    }
    if (cursor < line.length) parts.push(<Fragment key={`t${lineKey}-${k++}`}>{line.slice(cursor)}</Fragment>)
    return parts
  }

  return (
    <div className="rich">
      {text.split('\n').map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {renderLine(line, i)}
        </Fragment>
      ))}
    </div>
  )
}
