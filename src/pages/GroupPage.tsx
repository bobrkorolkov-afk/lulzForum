import { useEffect, useMemo, useRef, useState } from 'react'
import type { Channel, ChannelKind, GroupBundle } from '../types'
import { useApp } from '../lib/app'
import { useRouter } from '../lib/router'
import { useUI } from '../lib/ui'
import { useToast } from '../lib/toast'
import { VoiceRoom, voiceSignalingAvailable, type VoiceState } from '../lib/voice'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { ChatStream } from '../components/ChatStream'
import { EmptyState } from '../components/ui'
import { timeAgo } from '../lib/util'

export function GroupPage({ groupId, channelId }: { groupId: string; channelId?: string }) {
  const { user, groups, loadGroup, joinGroup, leaveGroup, deleteGroup, createChannel, deleteChannel, profileById } =
    useApp()
  const { navigate } = useRouter()
  const ui = useUI()
  const toast = useToast()
  const [bundle, setBundle] = useState<GroupBundle | null>(null)
  const [loading, setLoading] = useState(true)

  const group = bundle?.group ?? groups.find((g) => g.id === groupId) ?? null

  useEffect(() => {
    let alive = true
    setLoading(true)
    void loadGroup(groupId).then((next) => {
      if (!alive) return
      setBundle(next)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [groupId, loadGroup])

  const channels = bundle?.channels ?? []
  const textChannels = channels.filter((c) => c.kind === 'text')
  const voiceChannels = channels.filter((c) => c.kind === 'voice')
  const active = channels.find((c) => c.id === channelId) ?? textChannels[0] ?? channels[0] ?? null
  const activeChat = useMemo(
    () => (active && user ? { ...chatFromChannel(active, bundle!) } : null),
    [active, bundle, user],
  )

  if (!user) {
    return (
      <div className="page">
        <EmptyState
          icon="users"
          title="Сообщества доступны после входа"
          hint="Войдите, чтобы видеть каналы, писать и говорить."
          action={
            <button className="btn btn--primary" onClick={() => ui.openAuth('login')}>
              ВОЙТИ
            </button>
          }
        />
      </div>
    )
  }

  if (loading && !bundle) {
    return (
      <div className="page">
        <div className="skeleton skeleton--block" />
      </div>
    )
  }

  if (!group) {
    return (
      <div className="page">
        <EmptyState
          icon="users"
          title="Сообщество не найдено"
          hint="Возможно, его удалили или ссылка устарела."
          action={
            <button className="btn btn--primary" onClick={() => navigate('/groups')}>
              К СООБЩЕСТВАМ
            </button>
          }
        />
      </div>
    )
  }

  const isOwner = group.ownerId === user.id
  const memberProfiles = (bundle?.members ?? [])
    .map((m) => ({ membership: m, profile: profileById(m.userId) }))
    .sort((a, b) => (a.membership.role === 'owner' ? -1 : b.membership.role === 'owner' ? 1 : 0))

  const addChannel = async (kind: ChannelKind) => {
    const fallback = kind === 'voice' ? 'ГОЛОСОВАЯ' : 'новый-канал'
    const name = window.prompt(kind === 'voice' ? 'Название голосового канала' : 'Название текстового канала', fallback)
    if (!name?.trim()) return
    const created = await createChannel(group.id, name, kind)
    if (!created) return
    const next = await loadGroup(group.id)
    setBundle(next)
    navigate(`/g/${group.id}/${created.id}`)
  }

  return (
    <div className="page page--flush">
      <div className="group">
        <aside className="group__rail">
          <button className="group__back" onClick={() => navigate('/groups')}>
            <Icon name="arrowLeft" size={13} /> ВСЕ СООБЩЕСТВА
          </button>

          <header className="group__head">
            <Avatar seed={group.id} name={group.name} src={group.iconUrl} size={42} />
            <div>
              <b>{group.name}</b>
              <span>
                <Icon name="users" size={11} /> {group.memberCount} · создано {timeAgo(group.createdAt)}
              </span>
            </div>
          </header>

          {group.description && <p className="group__desc">{group.description}</p>}

          <div className="group__actions">
            {group.isMember ? (
              <button
                className="btn btn--sm"
                onClick={() => {
                  if (confirm(`Покинуть «${group.name}»?`)) {
                    void leaveGroup(group.id)
                    navigate('/groups')
                  }
                }}
              >
                ПОКИНУТЬ
              </button>
            ) : (
              <button
                className="btn btn--primary btn--sm"
                onClick={() => {
                  void joinGroup(group.id).then(() => void loadGroup(group.id).then(setBundle))
                }}
              >
                ВСТУПИТЬ
              </button>
            )}
            {isOwner && (
              <button
                className="btn btn--sm btn--danger"
                onClick={() => {
                  if (confirm(`Удалить «${group.name}» вместе со всеми каналами?`)) {
                    void deleteGroup(group.id)
                    navigate('/groups')
                  }
                }}
              >
                <Icon name="trash" size={12} />
              </button>
            )}
          </div>

          <nav className="group__channels">
            <div className="group__label">
              ТЕКСТОВЫЕ
              <button className="group__add" onClick={() => void addChannel('text')} title="Новый текстовый канал">
                <Icon name="plus" size={11} />
              </button>
            </div>
            {textChannels.map((ch) => (
              <ChannelRow
                key={ch.id}
                channel={ch}
                active={active?.id === ch.id}
                onOpen={() => navigate(`/g/${group.id}/${ch.id}`)}
                onDelete={isOwner ? () => void removeChannel(ch) : undefined}
              />
            ))}
            {textChannels.length === 0 && <p className="muted small">Нет каналов</p>}

            <div className="group__label">
              ГОЛОСОВЫЕ
              <button className="group__add" onClick={() => void addChannel('voice')} title="Новый голосовой канал">
                <Icon name="plus" size={11} />
              </button>
            </div>
            {voiceChannels.map((ch) => (
              <ChannelRow
                key={ch.id}
                channel={ch}
                active={active?.id === ch.id}
                onOpen={() => navigate(`/g/${group.id}/${ch.id}`)}
                onDelete={isOwner ? () => void removeChannel(ch) : undefined}
              />
            ))}
            {voiceChannels.length === 0 && <p className="muted small">Нет каналов</p>}
          </nav>

          <div className="group__members">
            <div className="group__label">УЧАСТНИКИ · {group.memberCount}</div>
            {memberProfiles.slice(0, 12).map(({ membership, profile }) => (
              <button
                key={membership.userId}
                className="person-row person-row--flat"
                onClick={() => profile && navigate(`/u/${profile.handle}`)}
              >
                <Avatar seed={profile?.handle ?? membership.userId} name={profile?.name} src={profile?.avatarUrl} size={24} />
                <span className="person-row__text">
                  <b>{profile?.name ?? 'УЧАСТНИК'}</b>
                </span>
                {membership.role === 'owner' && <span className="tag-mini">ВЛАДЕЛЕЦ</span>}
              </button>
            ))}
            {group.memberCount > 12 && <p className="muted small">и ещё {group.memberCount - 12}…</p>}
          </div>
        </aside>

        <section className="chat group__main">
          {!active && (
            <div className="chat__placeholder">
              <EmptyState
                icon="users"
                title="В сообществе нет каналов"
                hint="Создайте текстовый или голосовой канал — кнопка «+» у заголовка группы."
                action={
                  <button className="btn btn--primary" onClick={() => void addChannel('text')}>
                    НОВЫЙ КАНАЛ
                  </button>
                }
              />
            </div>
          )}

          {active && active.kind === 'text' && activeChat && (
            <>
              <header className="chat__head">
                <button className="btn btn--icon chat__back" onClick={() => navigate('/groups')} aria-label="Назад">
                  <Icon name="arrowLeft" size={15} />
                </button>
                <span className="group__hash">
                  <Icon name="hash" size={16} />
                </span>
                <div className="chat__head-text">
                  <b>{active.name}</b>
                  <span>{group.name} · текстовый канал</span>
                </div>
                {isOwner && (
                  <button
                    className="btn btn--icon"
                    title="Удалить канал"
                    onClick={() => void removeChannel(active)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                )}
              </header>
              <ChatStream chat={activeChat} showAuthors placeholder={`Сообщение в #${active.name}`} />
            </>
          )}

          {active && active.kind === 'voice' && (
            <VoicePanel
              channel={active}
              groupName={group.name}
              canDelete={isOwner}
              onDelete={() => void removeChannel(active)}
            />
          )}
        </section>
      </div>
    </div>
  )

  async function removeChannel(channel: Channel) {
    if (!group) return
    if (!confirm(`Удалить канал «${channel.name}»? Сообщения тоже удалятся.`)) return
    const groupIdSafe = group.id
    await deleteChannel(channel.id)
    const next = await loadGroup(groupIdSafe)
    setBundle(next)
    if (next) {
      const fallback = next.channels.find((c) => c.id !== channel.id)
      navigate(fallback ? `/g/${groupIdSafe}/${fallback.id}` : `/g/${groupIdSafe}`)
    }
    toast.push('Канал удалён')
  }
}

function chatFromChannel(channel: Channel, bundle: GroupBundle) {
  const members = bundle.members.map((m) => m.userId)
  return {
    id: channel.id,
    kind: 'channel' as const,
    title: channel.name,
    memberIds: members,
    groupId: bundle.group.id,
    createdAt: channel.createdAt,
    lastMessageAt: channel.createdAt,
    lastMessageBody: '',
    unreadCount: 0,
  }
}

function ChannelRow({
  channel,
  active,
  onOpen,
  onDelete,
}: {
  channel: Channel
  active: boolean
  onOpen: () => void
  onDelete?: () => void
}) {
  return (
    <div className={`channel-row ${active ? 'is-active' : ''}`}>
      <button className="channel-row__main" onClick={onOpen}>
        <Icon name={channel.kind === 'voice' ? 'speaker' : 'hash'} size={13} />
        <span>{channel.name}</span>
      </button>
      {onDelete && (
        <button className="channel-row__del" onClick={onDelete} title="Удалить канал">
          <Icon name="close" size={10} />
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- голосовая */

function VoicePanel({
  channel,
  groupName,
  canDelete,
  onDelete,
}: {
  channel: Channel
  groupName: string
  canDelete: boolean
  onDelete: () => void
}) {
  const { user, profileById } = useApp()
  const toast = useToast()
  const roomRef = useRef<VoiceRoom | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const [state, setState] = useState<VoiceState>({
    status: 'idle',
    muted: false,
    level: 0,
    peers: [],
    error: null,
    localOnly: !voiceSignalingAvailable,
  })

  useEffect(() => {
    roomRef.current?.leave()
    roomRef.current = null
    unsubRef.current?.()
    unsubRef.current = null
    setState({
      status: 'idle',
      muted: false,
      level: 0,
      peers: [],
      error: null,
      localOnly: !voiceSignalingAvailable,
    })
    return () => {
      roomRef.current?.leave()
      roomRef.current = null
      unsubRef.current?.()
      unsubRef.current = null
    }
  }, [channel.id])

  const join = async () => {
    if (!user) return
    roomRef.current?.leave()
    unsubRef.current?.()
    const room = new VoiceRoom(channel.id, { id: user.id, name: user.name })
    roomRef.current = room
    unsubRef.current = room.subscribe(setState)
    await room.join()
    if (room.getState().status === 'live') toast.push('Вы в голосовом канале', 'ok')
  }

  const leave = () => {
    roomRef.current?.leave()
    roomRef.current = null
    unsubRef.current?.()
    unsubRef.current = null
  }

  const live = state.status === 'live'
  const connecting = state.status === 'connecting'
  const members = state.peers.length

  return (
    <>
      <header className="chat__head">
        <span className="group__hash">
          <Icon name="speaker" size={16} />
        </span>
        <div className="chat__head-text">
          <b>{channel.name}</b>
          <span>{groupName} · голосовой канал</span>
        </div>
        {canDelete && (
          <button className="btn btn--icon" title="Удалить канал" onClick={onDelete}>
            <Icon name="trash" size={14} />
          </button>
        )}
      </header>

      <div className="voice">
        <div className="voice__hero">
          <span className={`voice__pulse ${live ? 'is-live' : ''}`}>
            <Icon name="speaker" size={22} />
          </span>
          <h2>{live ? 'ВЫ В ЭФИРЕ' : connecting ? 'ПОДКЛЮЧАЕМ МИКРОФОН…' : 'ГОЛОСОВОЙ КАНАЛ'}</h2>
          <p className="muted small">
            {live
              ? state.localOnly
                ? 'Локальный режим: без Supabase звук не передаётся другим — вы слышите только себя.'
                : `P2P-звук через WebRTC · ${members} ${members === 1 ? 'собеседник' : 'собеседников'}`
              : 'Звук идёт напрямую между участниками. Микрофон включается только по кнопке.'}
          </p>

          {state.error && <p className="voice__error">{state.error}</p>}

          <div className="voice__controls">
            {!live ? (
              <button className="btn btn--primary" onClick={() => void join()} disabled={connecting}>
                <Icon name="mic" size={14} /> {connecting ? 'ПОДКЛЮЧАЮ…' : 'ПОДКЛЮЧИТЬСЯ'}
              </button>
            ) : (
              <>
                <button
                  className={`btn ${state.muted ? 'btn--primary' : ''}`}
                  onClick={() => roomRef.current?.toggleMute()}
                >
                  <Icon name={state.muted ? 'micOff' : 'mic'} size={14} /> {state.muted ? 'ВКЛ. МИКРОФОН' : 'ЗАГЛУШИТЬ'}
                </button>
                <button className="btn" onClick={() => roomRef.current?.resumePlayback()}>
                  <Icon name="volume" size={14} /> ЗВУК
                </button>
                <button className="btn btn--danger" onClick={leave}>
                  <Icon name="logout" size={14} /> ВЫЙТИ
                </button>
              </>
            )}
          </div>
        </div>

        <div className="voice__grid">
          {live && user && (
            <div className={`voice-tile is-self ${state.muted ? 'is-muted' : ''}`}>
              <Avatar seed={user.handle} name={user.name} src={user.avatarUrl} size={48} />
              <b>{user.name}</b>
              <span className="voice-tile__meter">
                <i style={{ width: `${Math.round((state.muted ? 0 : state.level) * 100)}%` }} />
              </span>
              <span className="voice-tile__state">{state.muted ? 'МИКРОФОН ВЫКЛ' : 'ГОВОРИТЕ'}</span>
            </div>
          )}

          {live &&
            state.peers.map((peer) => {
              const profile = profileById(peer.id)
              return (
                <div key={peer.id} className="voice-tile">
                  <Avatar seed={profile?.handle ?? peer.id} name={peer.name} src={profile?.avatarUrl} size={48} />
                  <b>{profile?.name ?? peer.name}</b>
                  <span className="voice-tile__state">В КОМНАТЕ</span>
                </div>
              )
            })}

          {!live && (
            <div className="voice-tile voice-tile--ghost">
              <Icon name="users" size={26} />
              <b>НИКОГО</b>
              <span className="voice-tile__state">Подключитесь первым</span>
            </div>
          )}
        </div>

        <p className="voice__hint">
          {voiceSignalingAvailable
            ? 'Совет: для стабильной связи нужен HTTPS и разрешение на микрофон. Голос идёт напрямую, без записи на сервер.'
            : 'Чтобы голос работал между людьми, подключите Supabase (VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY) — он используется как сигнальный сервер.'}
        </p>
      </div>
    </>
  )
}
