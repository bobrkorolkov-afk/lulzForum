import { useMemo, useRef, useState } from 'react'
import { backend, useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { useToast } from '../lib/toast'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PostCard } from '../components/PostCard'
import { TrackRow } from '../components/TrackRow'
import { EmptyState, Modal, Segmented, Stat } from '../components/ui'
import { formatDate, formatCount } from '../lib/util'
import { usePlayer } from '../lib/player'

type Tab = 'posts' | 'music' | 'about'

export function ProfilePage({ handle }: { handle: string }) {
  const {
    profiles,
    posts,
    user,
    friendships,
    friendIds,
    profileById,
    sendFriendRequest,
    respondFriendRequest,
    removeFriend,
    startDm,
    updateProfile,
    tracks,
    playlists,
    toggleTrackLike,
  } = useApp()
  const { navigate } = useRouter()
  const ui = useUI()
  const toast = useToast()
  const player = usePlayer()
  const [tab, setTab] = useState<Tab>('posts')
  const [editOpen, setEditOpen] = useState(false)

  const profile = useMemo(
    () => profiles.find((p) => p.handle.toLowerCase() === handle.toLowerCase()) ?? (user?.handle.toLowerCase() === handle.toLowerCase() ? user : undefined),
    [profiles, handle, user],
  )

  const myPosts = useMemo(
    () => (profile ? posts.filter((p) => p.authorId === profile.id) : []),
    [posts, profile],
  )

  const likesReceived = myPosts.reduce((s, p) => s + p.likeCount, 0)
  const isMe = user?.id === profile?.id

  const friendship = profile
    ? friendships.find(
        (f) =>
          (f.requesterId === user?.id && f.addresseeId === profile.id) ||
          (f.addresseeId === user?.id && f.requesterId === profile.id),
      )
    : undefined
  const isFriend = profile ? friendIds.has(profile.id) : false

  if (!profile) {
    return (
      <div className="page">
        <EmptyState
          icon="user"
          title="Пользователь не найден"
          hint={`Пользователя @${handle} нет на форуме.`}
          action={
            <button className="btn btn--primary" onClick={() => navigate('/')}>
              В ЛЕНТУ
            </button>
          }
        />
      </div>
    )
  }

  const friendButton = () => {
    if (isMe) {
      return (
        <button className="btn btn--primary" onClick={() => setEditOpen(true)}>
          <Icon name="edit" size={14} /> РЕДАКТИРОВАТЬ ПРОФИЛЬ
        </button>
      )
    }
    if (isFriend) {
      return (
        <button className="btn" onClick={() => friendship && void removeFriend(friendship.id)}>
          <Icon name="check" size={14} /> В ДРУЗЬЯХ
        </button>
      )
    }
    if (friendship?.status === 'pending' && friendship.addresseeId === user?.id) {
      return (
        <button className="btn btn--primary" onClick={() => void respondFriendRequest(friendship.id, true)}>
          ПРИНЯТЬ ЗАЯВКУ
        </button>
      )
    }
    if (friendship?.status === 'pending') {
      return (
        <button className="btn" onClick={() => void removeFriend(friendship.id)}>
          ЗАЯВКА ОТПРАВЛЕНА
        </button>
      )
    }
    return (
      <button className="btn btn--primary" onClick={() => void sendFriendRequest(profile.id)}>
        <Icon name="plus" size={14} /> В ДРУЗЬЯ
      </button>
    )
  }

  return (
    <div className="page page--profile">
      <div className="profile-cover" aria-hidden="true" />

      <div className="profile-head">
        <Avatar seed={profile.handle} name={profile.name} src={profile.avatarUrl} size={96} className="profile-avatar" />
        <div className="profile-head__main">
          <h1 className="profile-head__name">
            {profile.name}
            {isMe && <span className="chip chip--tiny">это вы</span>}
          </h1>
          <div className="profile-head__handle">
            @{profile.handle} <i className="dot" /> <span>был(а) в сети недавно</span>
          </div>
          {profile.bio && <p className="profile-head__bio">{profile.bio}</p>}
          <div className="profile-head__meta">
            <span>
              <Icon name="user" size={12} /> на форуме с {formatDate(profile.createdAt)}
            </span>
            {profile.links?.map((l) => (
              <a key={l} href={l} target="_blank" rel="noopener noreferrer">
                <Icon name="link" size={12} /> {l.replace(/^https?:\/\//, '').slice(0, 30)}
              </a>
            ))}
          </div>
        </div>
        <div className="profile-head__actions">
          {friendButton()}
          {!isMe && (
            <button
              className="btn"
              onClick={async () => {
                const chat = await startDm(profile.id)
                navigate(`/chats/${chat.id}`)
              }}
            >
              <Icon name="chat" size={14} /> НАПИСАТЬ
            </button>
          )}
          <button
            className="btn btn--icon"
            onClick={() => {
              void navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}#/u/${profile.handle}`).then(
                () => toast.push('Ссылка на профиль скопирована', 'ok'),
                () => toast.push('Не удалось скопировать', 'error'),
              )
            }}
            title="Скопировать ссылку"
          >
            <Icon name="copy" size={14} />
          </button>
        </div>
      </div>

      <div className="profile-stats">
        <Stat label="постов" value={formatCount(myPosts.length)} onClick={() => setTab('posts')} />
        <Stat label="лайков получил" value={formatCount(likesReceived)} />
        <Stat label="друзей" value={formatCount(isMe ? friendIds.size : friendships.filter((f) => f.status === 'accepted' && (f.requesterId === profile.id || f.addresseeId === profile.id)).length)} />
        <Stat label="музыки" value={formatCount(isMe ? tracks.length : 0)} onClick={isMe ? () => setTab('music') : undefined} />
      </div>

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'posts', label: `Посты (${myPosts.length})`, icon: 'home' },
          ...(isMe ? [{ value: 'music' as Tab, label: `Музыка (${tracks.length})`, icon: 'music' as const }] : []),
          { value: 'about', label: 'О себе', icon: 'user' },
        ]}
      />

      {tab === 'posts' && (
        <div className="stack stack--posts">
          {myPosts.length === 0 ? (
            <EmptyState
              icon="edit"
              title={isMe ? 'Вы ещё ничего не писали' : 'Постов пока нет'}
              hint={isMe ? 'Первый пост — самый важный.' : undefined}
              action={
                isMe ? (
                  <button className="btn btn--primary" onClick={() => ui.openComposer()}>
                    НАПИСАТЬ ПОСТ
                  </button>
                ) : undefined
              }
            />
          ) : (
            myPosts.map((p) => <PostCard key={p.id} post={p} />)
          )}
        </div>
      )}

      {tab === 'music' && isMe && (
        <div className="stack">
          <div className="music-library__bar">
            <span className="muted small">{tracks.length} треков · {playlists.length} плейлистов</span>
            <button
              className="btn"
              onClick={() => player.playQueue(tracks.map((t) => t.track), 0)}
              disabled={!tracks.length}
            >
              <Icon name="play" size={13} /> ИГРАТЬ ВСЁ
            </button>
            <button className="btn" onClick={() => navigate('/music')}>
              ОТКРЫТЬ МУЗЫКУ
            </button>
          </div>
          {tracks.length === 0 && <EmptyState icon="music" title="Музыки нет" hint="Найдите треки в разделе «Музыка»." />}
          {tracks.map((t) => (
            <TrackRow
              key={t.id}
              track={t.track}
              saved={t}
              onLike={() => void toggleTrackLike(t.id)}
              onShare={() => window.open(t.track.externalUrl, '_blank', 'noopener')}
              queue={tracks.map((x) => x.track)}
            />
          ))}
        </div>
      )}

      {tab === 'about' && (
        <div className="about-grid">
          <section className="card">
            <h3>О пользователе</h3>
            <p>{profile.bio || 'Пользователь не заполнил описание.'}</p>
            <dl className="kv">
              <dt>Ник</dt>
              <dd>@{profile.handle}</dd>
              <dt>Дата регистрации</dt>
              <dd>{formatDate(profile.createdAt)}</dd>
              <dt>ID</dt>
              <dd className="mono">{profile.id.slice(0, 12)}…</dd>
            </dl>
          </section>
          <section className="card">
            <h3>Друзья</h3>
            <div className="friend-chips">
              {Array.from(friendIds)
                .map((id) => profileById(id))
                .filter(Boolean)
                .slice(0, 12)
                .map((f) => (
                  <button key={f!.id} className="chip chip--btn" onClick={() => navigate(`/u/${f!.handle}`)}>
                    <Avatar seed={f!.handle} name={f!.name} src={f!.avatarUrl} size={18} /> {f!.name}
                  </button>
                ))}
              {friendIds.size === 0 && <p className="muted small">Пока нет друзей.</p>}
            </div>
            <h3 style={{ marginTop: 18 }}>Теги пользователя</h3>
            <div className="friend-chips">
              {Array.from(new Set(myPosts.flatMap((p) => p.tags))).map((t) => (
                <button key={t} className="tag" onClick={() => navigate(`/tag/${encodeURIComponent(t)}`)}>
                  #{t}
                </button>
              ))}
              {myPosts.flatMap((p) => p.tags).length === 0 && <p className="muted small">Тегов пока нет.</p>}
            </div>
          </section>
        </div>
      )}

      {isMe && (
        <EditProfileModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          initial={{ name: profile.name, handle: profile.handle, bio: profile.bio, links: profile.links ?? [], avatarUrl: profile.avatarUrl ?? null }}
          onSave={async (patch) => {
            await updateProfile(patch)
            setEditOpen(false)
          }}
        />
      )}
    </div>
  )
}

function EditProfileModal({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean
  onClose: () => void
  initial: { name: string; handle: string; bio: string; links: string[]; avatarUrl: string | null }
  onSave: (patch: { name: string; handle: string; bio: string; links: string[]; avatarUrl: string | null }) => Promise<void>
}) {
  const toast = useToast()
  const [name, setName] = useState(initial.name)
  const [handle, setHandle] = useState(initial.handle)
  const [bio, setBio] = useState(initial.bio)
  const [links, setLinks] = useState(initial.links.join(', '))
  const [avatar, setAvatar] = useState<string | null>(initial.avatarUrl)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <Modal open={open} onClose={onClose} title="РЕДАКТИРОВАТЬ ПРОФИЛЬ" width={520}>
      <div className="stack">
        <div className="avatar-edit">
          <Avatar seed={handle} name={name} src={avatar} size={72} />
          <div className="avatar-edit__actions">
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="image" size={13} /> ЗАГРУЗИТЬ АВАТАР
            </button>
            {avatar && (
              <button className="btn" onClick={() => setAvatar(null)}>
                СБРОСИТЬ
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  setAvatar(await backend.uploadPublicImage(file))
                } catch {
                  toast.push('Не удалось загрузить аватар', 'error')
                }
              }}
            />
          </div>
        </div>

        <label className="field">
          <span>Имя</span>
          <input className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Ник</span>
          <input className="input" value={handle} maxLength={24} onChange={(e) => setHandle(e.target.value.toLowerCase())} />
        </label>
        <label className="field">
          <span>О себе</span>
          <textarea className="input input--area" value={bio} maxLength={400} rows={4} onChange={(e) => setBio(e.target.value)} />
        </label>
        <label className="field">
          <span>Ссылки (через запятую)</span>
          <input className="input" value={links} onChange={(e) => setLinks(e.target.value)} placeholder="https://github.com/you" />
        </label>

        <button
          className="btn btn--primary btn--wide"
          disabled={busy || !name.trim() || !handle.trim()}
          onClick={async () => {
            setBusy(true)
            try {
              await onSave({
                name: name.trim(),
                handle,
                bio,
                links: links
                  .split(',')
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .slice(0, 5),
                avatarUrl: avatar,
              })
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'СОХРАНЯЮ…' : 'СОХРАНИТЬ'}
        </button>
      </div>
    </Modal>
  )
}
