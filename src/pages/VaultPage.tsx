import { useMemo, useRef, useState } from 'react'
import type { FileItem } from '../types'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { useToast } from '../lib/toast'
import { EmptyState, Modal, Segmented } from '../components/ui'
import { Icon } from '../components/Icon'
import { classNames, downloadUrl, formatBytes, formatDate, timeAgo } from '../lib/util'

type KindFilter = 'all' | FileItem['kind']

const QUOTA = 1024 * 1024 * 1024

const KIND_LABEL: Record<KindFilter, string> = {
  all: 'Все',
  image: 'Картинки',
  audio: 'Аудио',
  video: 'Видео',
  doc: 'Документы',
  archive: 'Архивы',
  other: 'Прочее',
}

export function VaultPage() {
  const { files, user, sendFile, deleteFile, mode } = useApp()
  const { navigate } = useRouter()
  const ui = useUI()
  const toast = useToast()
  const [kind, setKind] = useState<KindFilter>('all')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<FileItem | null>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)


  const filtered = useMemo(
    () =>
      files
        .filter((f) => (kind === 'all' ? true : f.kind === kind))
        .filter((f) => (query ? f.name.toLowerCase().includes(query.toLowerCase()) : true)),
    [files, kind, query],
  )

  const totalSize = files.reduce((s, f) => s + f.size, 0)
  const pct = Math.min(100, (totalSize / QUOTA) * 100)

  if (!user) {
    return (
      <div className="page">
        <EmptyState
          icon="vault"
          title="Личное хранилище"
          hint="Войдите, чтобы загружать файлы. Содержимое видит только владелец аккаунта."
          action={
            <button className="btn btn--primary" onClick={() => ui.openAuth('login')}>
              ВОЙТИ
            </button>
          }
        />
      </div>
    )
  }

  const uploadMany = async (list: FileList | File[]) => {
    const arr = Array.from(list)
    if (!arr.length) return
    setBusy(true)
    for (const file of arr) {
      try {
        await sendFile(file)
      } catch {
        /* toast already shown */
      }
    }
    setBusy(false)
  }

  return (
    <div className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">ХРАНИЛИЩЕ</h1>
          <p className="page__sub">Личные файлы · доступ только у вас · ссылки подписанные</p>
        </div>
        <button className="btn btn--primary" onClick={() => inputRef.current?.click()} disabled={busy}>
          <Icon name="upload" size={14} /> {busy ? 'ЗАГРУЖАЮ…' : 'ЗАГРУЗИТЬ'}
        </button>
      </div>

      <div className="vault-stats">
        <div className="vault-stats__row">
          <span>
            <b>{files.length}</b> файлов
          </span>
          <span>
            <b>{formatBytes(totalSize)}</b> занято
          </span>
          <span className="muted">
            {mode === 'local' ? 'локально (IndexedDB) · лимит 8 МБ на файл' : 'Supabase Storage · лимит 50 МБ на файл'}
          </span>
        </div>
        <div className="meter">
          <div className="meter__fill" style={{ width: `${Math.max(1, pct)}%` }} />
          <span className="meter__label">{pct < 1 ? '<1' : Math.round(pct)}% от 1 ГБ</span>
        </div>
      </div>

      <div
        className={classNames('dropzone', dragging && 'is-drag', busy && 'is-busy')}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void uploadMany(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click()
        }}
      >
        <Icon name={busy ? 'refresh' : 'upload'} size={26} />
        <b>{busy ? 'Загружаю файлы…' : 'Перетащите файлы сюда'}</b>
        <span>или нажмите, чтобы выбрать · картинки, аудио, видео, архивы, документы</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void uploadMany(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      <div className="vault-toolbar">
        <Segmented<KindFilter>
          small
          value={kind}
          onChange={setKind}
          options={(['all', 'image', 'audio', 'video', 'doc', 'archive', 'other'] as KindFilter[]).map((k) => ({
            value: k,
            label: KIND_LABEL[k],
          }))}
        />
        <div className="vault-toolbar__right">
          <div className="chats__search">
            <Icon name="search" size={13} />
            <input value={query} placeholder="Поиск по файлам" onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="viewtoggle">
            <button className={view === 'grid' ? 'is-on' : ''} onClick={() => setView('grid')} title="Сетка">
              <Icon name="grid" size={14} />
            </button>
            <button className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')} title="Список">
              <Icon name="list" size={14} />
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon="vault"
          title={files.length ? 'Ничего не найдено' : 'Хранилище пустое'}
          hint={
            files.length
              ? 'Измените фильтр или поисковый запрос.'
              : 'Загрузите первый файл — он останется только у вас. Картинки можно сразу вставлять в посты.'
          }
        />
      ) : view === 'grid' ? (
        <div className="filegrid">
          {filtered.map((f) => (
            <article key={f.id} className="filecard">
              <button className="filecard__thumb" onClick={() => setPreview(f)}>
                {f.kind === 'image' ? (
                  <img src={f.url} alt={f.name} loading="lazy" />
                ) : (
                  <span className={`filecard__icon filecard__icon--${f.kind}`}>
                    <Icon name={kindIcon(f.kind)} size={30} />
                  </span>
                )}
              </button>
              <div className="filecard__main">
                <div className="filecard__name" title={f.name}>
                  {f.name}
                </div>
                <div className="filecard__meta">
                  {formatBytes(f.size)} · {timeAgo(f.createdAt)}
                </div>
              </div>
              <div className="filecard__actions">
                <button className="btn btn--icon" onClick={() => setPreview(f)} title="Открыть">
                  <Icon name="eye" size={13} />
                </button>
                <button className="btn btn--icon" onClick={() => downloadUrl(f.url, f.name)} title="Скачать">
                  <Icon name="download" size={13} />
                </button>
                <button
                  className="btn btn--icon btn--danger"
                  onClick={() => {
                    if (confirm(`Удалить «${f.name}»?`)) void deleteFile(f.id)
                  }}
                  title="Удалить"
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="filelist">
          {filtered.map((f) => (
            <div key={f.id} className="filerow">
              <span className="filerow__icon">
                <Icon name={kindIcon(f.kind)} size={16} />
              </span>
              <button className="filerow__name" onClick={() => setPreview(f)}>
                {f.name}
              </button>
              <span className="filerow__size">{formatBytes(f.size)}</span>
              <span className="filerow__date">{formatDate(f.createdAt)}</span>
              <span className="filerow__actions">
                <button className="btn btn--icon" onClick={() => downloadUrl(f.url, f.name)} title="Скачать">
                  <Icon name="download" size={13} />
                </button>
                <button
                  className="btn btn--icon btn--danger"
                  onClick={() => {
                    if (confirm(`Удалить «${f.name}»?`)) void deleteFile(f.id)
                  }}
                  title="Удалить"
                >
                  <Icon name="trash" size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.name} width={720}>
        {preview && (
          <div className="preview">
            {preview.kind === 'image' && <img className="preview__img" src={preview.url} alt={preview.name} />}
            {preview.kind === 'audio' && <audio className="preview__audio" src={preview.url} controls />}
            {preview.kind === 'video' && <video className="preview__video" src={preview.url} controls />}
            {preview.kind !== 'image' && preview.kind !== 'audio' && preview.kind !== 'video' && (
              <div className="preview__generic">
                <Icon name={kindIcon(preview.kind)} size={44} />
                <p>Предпросмотр недоступен для этого типа файла.</p>
              </div>
            )}
            <div className="preview__meta">
              <span>{formatBytes(preview.size)}</span>
              <span>{preview.mime}</span>
              <span>{formatDate(preview.createdAt)}</span>
            </div>
            <div className="preview__actions">
              <button className="btn btn--primary" onClick={() => downloadUrl(preview.url, preview.name)}>
                <Icon name="download" size={14} /> СКАЧАТЬ
              </button>
              {preview.kind === 'image' && (
                <button
                  className="btn"
                  onClick={() => {
                    void navigator.clipboard.writeText(preview.url).then(
                      () => toast.push('Ссылка на файл скопирована', 'ok'),
                      () => toast.push('Не удалось скопировать', 'error'),
                    )
                  }}
                >
                  <Icon name="copy" size={14} /> ССЫЛКА
                </button>
              )}
              <button className="btn" onClick={() => navigate('/')}>
                В ЛЕНТУ
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function kindIcon(kind: FileItem['kind']) {
  switch (kind) {
    case 'image':
      return 'image' as const
    case 'audio':
      return 'music' as const
    case 'video':
      return 'play' as const
    case 'doc':
      return 'edit' as const
    case 'archive':
      return 'folder' as const
    default:
      return 'folder' as const
  }
}
