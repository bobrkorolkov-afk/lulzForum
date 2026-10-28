import { useRef, useState } from 'react'
import type { Track } from '../types'
import { backend, useApp } from '../lib/app'
import { useUI } from '../lib/ui'
import { useToast } from '../lib/toast'
import { extractTags, normalizeTag } from '../lib/util'
import { resolveMusicLink, searchMusic } from '../lib/music'
import { Modal, Spinner } from './ui'
import { Icon } from './Icon'

const MAX = 4000

export function Composer() {
  const { composerOpen, closeComposer, composerTrack, composerBody } = useUI()
  const { createPost, tracks } = useApp()
  const toast = useToast()
  const [body, setBody] = useState(composerBody)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [track, setTrack] = useState<Track | null>(composerTrack)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [musicPanel, setMusicPanel] = useState(false)
  const [musicQuery, setMusicQuery] = useState('')
  const [musicResults, setMusicResults] = useState<Track[]>([])
  const [musicBusy, setMusicBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const initialized = useRef(false)

  // Sync external composerTrack / body on open.
  if (composerOpen && !initialized.current) {
    initialized.current = true
    setTrack(composerTrack)
    setBody(composerBody)
  }
  if (!composerOpen && initialized.current) initialized.current = false

  const reset = () => {
    setBody('')
    setTags([])
    setTagInput('')
    setImage(null)
    setTrack(null)
    setMusicPanel(false)
    setMusicQuery('')
    setMusicResults([])
  }

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw)
    if (!tag) return
    setTags((list) => (list.includes(tag) || list.length >= 8 ? list : [...list, tag]))
    setTagInput('')
  }

  const onImage = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.push('Можно прикрепить только изображение', 'error')
      return
    }
    setUploading(true)
    try {
      const url = await backend.uploadPublicImage(file)
      setImage(url)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Не удалось загрузить картинку', 'error')
    } finally {
      setUploading(false)
    }
  }

  const runMusicSearch = async () => {
    const q = musicQuery.trim()
    if (!q) return
    setMusicBusy(true)
    try {
      if (/^https?:\/\//i.test(q)) {
        const { track: resolved } = resolveMusicLink(q)
        setTrack(resolved)
        setMusicPanel(false)
        toast.push('Ссылка прикреплена', 'ok')
        return
      }
      const res = await searchMusic(q, 6)
      setMusicResults(res.tracks)
      if (!res.tracks.length) toast.push('Ничего не нашлось — попробуйте ссылку', 'error')
    } catch {
      toast.push('Поиск не отвечает', 'error')
    } finally {
      setMusicBusy(false)
    }
  }

  const publish = async () => {
    if (busy) return
    const finalTags = Array.from(new Set([...tags, ...extractTags(body)])).slice(0, 8)
    if (!body.trim() && !image && !track) {
      toast.push('Добавьте текст, картинку или трек', 'error')
      return
    }
    setBusy(true)
    try {
      await createPost({ body, tags: finalTags, imageUrl: image, track })
      reset()
      closeComposer()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={composerOpen} onClose={closeComposer} title="НОВЫЙ ПОСТ" width={620}>
      <div className="composer">
        <textarea
          className="composer__text"
          value={body}
          maxLength={MAX}
          autoFocus
          placeholder="Что нового, форум? Ставьте #теги прямо в тексте…"
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void publish()
          }}
        />

        {image && (
          <div className="composer__preview">
            <img src={image} alt="Превью" />
            <button className="btn btn--icon" onClick={() => setImage(null)} title="Убрать картинку">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        {track && (
          <div className="composer__track">
            <Icon name="music" size={16} />
            <span className="composer__track-main">
              <b>{track.title}</b>
              <span>{track.artist}</span>
            </span>
            <button className="btn btn--icon" onClick={() => setTrack(null)} title="Убрать трек">
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        <div className="composer__tags">
          {tags.map((t) => (
            <span key={t} className="tag tag--removable">
              #{t}
              <button onClick={() => setTags((list) => list.filter((x) => x !== t))} aria-label="Убрать тег">
                <Icon name="close" size={10} />
              </button>
            </span>
          ))}
          <input
            className="composer__tag-input"
            value={tagInput}
            placeholder="+ тег"
            maxLength={28}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                e.preventDefault()
                addTag(tagInput)
              }
              if (e.key === 'Backspace' && !tagInput && tags.length) setTags((l) => l.slice(0, -1))
            }}
          />
        </div>

        {musicPanel && (
          <div className="composer__music">
            <div className="inline-form">
              <input
                className="input"
                autoFocus
                value={musicQuery}
                placeholder="Поиск трека или ссылка SoundCloud / Яндекс / mp3"
                onChange={(e) => setMusicQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runMusicSearch()
                }}
              />
              <button className="btn" onClick={() => void runMusicSearch()} disabled={musicBusy}>
                {musicBusy ? <Spinner /> : <Icon name="search" size={14} />}
              </button>
            </div>
            {tracks.length > 0 && (
              <>
                <div className="composer__music-label">МОЯ МУЗЫКА</div>
                <div className="composer__music-list">
                  {tracks.slice(0, 6).map((t) => (
                    <button
                      key={t.id}
                      className="composer__music-item"
                      onClick={() => {
                        setTrack(t.track)
                        setMusicPanel(false)
                      }}
                    >
                      <span>{t.track.title}</span>
                      <span className="muted">{t.track.artist}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {musicResults.length > 0 && (
              <>
                <div className="composer__music-label">НАЙДЕНО В ИНТЕРНЕТЕ</div>
                <div className="composer__music-list">
                  {musicResults.map((t) => (
                    <button
                      key={t.id}
                      className="composer__music-item"
                      onClick={() => {
                        setTrack(t)
                        setMusicPanel(false)
                      }}
                    >
                      <span>{t.title}</span>
                      <span className="muted">{t.artist}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="composer__bar">
          <div className="composer__tools">
            <button className="btn btn--icon" onClick={() => fileRef.current?.click()} title="Картинка" disabled={uploading}>
              <Icon name={uploading ? 'refresh' : 'image'} size={16} />
            </button>
            <button
              className={`btn btn--icon ${track ? 'is-on' : ''}`}
              onClick={() => setMusicPanel((v) => !v)}
              title="Прикрепить трек"
            >
              <Icon name="music" size={16} />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void onImage(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <span className="composer__count">
              {body.length}/{MAX}
            </span>
          </div>
          <button className="btn btn--primary" onClick={() => void publish()} disabled={busy}>
            {busy ? 'ПУБЛИКУЮ…' : 'ОПУБЛИКОВАТЬ'} <Icon name="send" size={14} />
          </button>
        </div>
      </div>
    </Modal>
  )
}
