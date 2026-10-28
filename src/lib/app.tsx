import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type {
  Attachment,
  Backend,
  Chat,
  Comment,
  Channel,
  ChannelKind,
  FileItem,
  Friendship,
  Group,
  GroupBundle,
  ID,
  Message,
  Notification,
  Playlist,
  Post,
  PostInput,
  Profile,
  SavedTrack,
  Track,
} from '../types'
import { LocalBackend } from './localBackend'
import { SupabaseBackend } from './supabaseBackend'
import { useToast } from './toast'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY)

function createBackend(): Backend {
  if (supabaseConfigured && SUPABASE_URL && SUPABASE_KEY) return new SupabaseBackend(SUPABASE_URL, SUPABASE_KEY)
  return new LocalBackend()
}

export const backend: Backend = createBackend()

export interface DataState {
  profiles: Profile[]
  posts: Post[]
  friendships: Friendship[]
  chats: Chat[]
  groups: Group[]
  files: FileItem[]
  tracks: SavedTrack[]
  playlists: Playlist[]
  notifications: Notification[]
}

const emptyData: DataState = {
  profiles: [],
  posts: [],
  friendships: [],
  chats: [],
  groups: [],
  files: [],
  tracks: [],
  playlists: [],
  notifications: [],
}

interface AppValue extends DataState {
  mode: 'local' | 'supabase'
  booted: boolean
  ready: boolean
  user: Profile | null
  profileById: (id: ID) => Profile | undefined
  friendIds: Set<ID>
  pendingIncoming: Friendship[]
  pendingOutgoing: Friendship[]
  unreadNotifications: number
  unreadMessages: number
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, handle: string, name: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  signInDemo: () => Promise<void>
  reload: () => Promise<void>
  updateProfile: (patch: Partial<Pick<Profile, 'name' | 'bio' | 'avatarUrl' | 'links' | 'handle'>>) => Promise<void>
  createPost: (input: PostInput) => Promise<void>
  deletePost: (id: ID) => Promise<void>
  toggleLike: (id: ID) => Promise<void>
  toggleBookmark: (id: ID) => Promise<void>
  commentsOf: Record<ID, Comment[]>
  loadComments: (postId: ID) => Promise<Comment[]>
  addComment: (postId: ID, body: string) => Promise<void>
  sendFriendRequest: (userId: ID) => Promise<void>
  respondFriendRequest: (id: ID, accept: boolean) => Promise<void>
  removeFriend: (id: ID) => Promise<void>
  sendMessage: (chatId: ID, body: string, attachment?: Attachment | null) => Promise<Message>
  openChat: (chatId: ID, memberIds: ID[]) => Promise<void>
  createGroupChat: (memberIds: ID[], title: string) => Promise<Chat>
  loadGroup: (groupId: ID) => Promise<GroupBundle | null>
  createGroup: (name: string, description: string) => Promise<GroupBundle | null>
  joinGroup: (groupId: ID) => Promise<void>
  leaveGroup: (groupId: ID) => Promise<void>
  updateGroup: (groupId: ID, patch: Partial<Pick<Group, 'name' | 'description' | 'iconUrl'>>) => Promise<void>
  deleteGroup: (groupId: ID) => Promise<void>
  createChannel: (groupId: ID, name: string, kind: ChannelKind) => Promise<Channel | null>
  deleteChannel: (channelId: ID) => Promise<void>
  startDm: (userId: ID) => Promise<Chat>
  loadMessages: (chatId: ID, memberIds: ID[]) => Promise<Message[]>
  messagesOf: Record<ID, Message[]>
  sendFile: (file: File) => Promise<FileItem>
  deleteFile: (id: ID) => Promise<void>
  saveTrack: (track: Track) => Promise<SavedTrack | null>
  toggleTrackLike: (id: ID) => Promise<void>
  removeTrack: (id: ID) => Promise<void>
  createPlaylist: (title: string, description: string) => Promise<Playlist>
  deletePlaylist: (id: ID) => Promise<void>
  addToPlaylist: (playlistId: ID, trackId: ID) => Promise<void>
  removeFromPlaylist: (playlistId: ID, trackId: ID) => Promise<void>
  markNotificationsRead: () => Promise<void>
  searchUsers: (q: string) => Promise<Profile[]>
}

const AppContext = createContext<AppValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const toast = useToast()
  const [booted, setBooted] = useState(false)
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState<Profile | null>(null)
  const [data, setData] = useState<DataState>(emptyData)
  const [messagesOf, setMessagesOf] = useState<Record<ID, Message[]>>({})
  const [commentsOf, setCommentsOf] = useState<Record<ID, Comment[]>>({})
  const userRef = useRef<Profile | null>(null)
  userRef.current = user

  const fail = useCallback(
    (e: unknown) => {
      const text = e instanceof Error ? e.message : String(e)
      toast.push(text, 'error')
    },
    [toast],
  )

  const loadAll = useCallback(async (current: Profile | null) => {
    const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await fn()
      } catch {
        return fallback
      }
    }
    const [profiles, posts, friendships, chats, groups, files, tracks, playlists, notifications] = await Promise.all([
      safe(() => backend.fetchProfiles(), [] as Profile[]),
      safe(() => backend.fetchPosts(), [] as Post[]),
      current ? safe(() => backend.fetchFriendships(), [] as Friendship[]) : Promise.resolve([] as Friendship[]),
      current ? safe(() => backend.fetchChats(), [] as Chat[]) : Promise.resolve([] as Chat[]),
      safe(() => backend.fetchGroups(), [] as Group[]),
      current ? safe(() => backend.fetchFiles(), [] as FileItem[]) : Promise.resolve([] as FileItem[]),
      current ? safe(() => backend.fetchTracks(), [] as SavedTrack[]) : Promise.resolve([] as SavedTrack[]),
      current ? safe(() => backend.fetchPlaylists(), [] as Playlist[]) : Promise.resolve([] as Playlist[]),
      current ? safe(() => backend.fetchNotifications(), [] as Notification[]) : Promise.resolve([] as Notification[]),
    ])
    setData({ profiles, posts, friendships, chats, groups, files, tracks, playlists, notifications })
  }, [])

  const reload = useCallback(async () => {
    await loadAll(userRef.current)
  }, [loadAll])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const initial = await backend.init()
        if (!alive) return
        setUser(initial)
        await loadAll(initial)
      } catch (e) {
        console.error(e)
      } finally {
        if (alive) {
          setBooted(true)
          setReady(true)
        }
      }
    })()
    const unsub = backend.onAuthChange((next) => {
      setUser(next)
      void loadAll(next)
    })
    return () => {
      alive = false
      unsub()
    }
  }, [loadAll])

  const profileById = useCallback(
    (id: ID) => data.profiles.find((p) => p.id === id) ?? (user && user.id === id ? user : undefined),
    [data.profiles, user],
  )

  const friendIds = useMemo(() => {
    if (!user) return new Set<ID>()
    const ids = new Set<ID>()
    for (const f of data.friendships) {
      if (f.status !== 'accepted') continue
      if (f.requesterId === user.id) ids.add(f.addresseeId)
      if (f.addresseeId === user.id) ids.add(f.requesterId)
    }
    return ids
  }, [data.friendships, user])

  const pendingIncoming = useMemo(
    () => (user ? data.friendships.filter((f) => f.addresseeId === user.id && f.status === 'pending') : []),
    [data.friendships, user],
  )
  const pendingOutgoing = useMemo(
    () => (user ? data.friendships.filter((f) => f.requesterId === user.id && f.status === 'pending') : []),
    [data.friendships, user],
  )

  const unreadNotifications = useMemo(() => data.notifications.filter((n) => !n.read).length, [data.notifications])
  const unreadMessages = useMemo(() => data.chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0), [data.chats])

  /* ------------------------------------------------------------------ auth */

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await backend.signIn(email, password)
        setUser(res.user)
        await loadAll(res.user)
        toast.push('Добро пожаловать на LulzForum', 'ok')
      } catch (e) {
        fail(e)
        throw e
      }
    },
    [fail, loadAll, toast],
  )

  const signUp = useCallback(
    async (email: string, password: string, handle: string, name: string) => {
      try {
        const res = await backend.signUp(email, password, handle, name)
        if (res.needsConfirmation) {
          toast.push('Аккаунт создан — подтвердите почту по ссылке из письма', 'ok')
          return { needsConfirmation: true }
        }
        setUser(res.user)
        await loadAll(res.user)
        toast.push('Аккаунт создан. Добро пожаловать!', 'ok')
        return { needsConfirmation: false }
      } catch (e) {
        fail(e)
        throw e
      }
    },
    [fail, loadAll, toast],
  )

  const signOut = useCallback(async () => {
    await backend.signOut()
    setUser(null)
    setMessagesOf({})
    setCommentsOf({})
    await loadAll(null)
    toast.push('Вы вышли из аккаунта')
  }, [loadAll, toast])

  const signInDemo = useCallback(async () => {
    const local = backend as LocalBackend
    if (!('signInDemo' in local)) {
      toast.push('Демо-вход доступен только без Supabase', 'error')
      return
    }
    const res = await local.signInDemo()
    setUser(res.user)
    await loadAll(res.user)
    toast.push('Это демо-аккаунт: можно всё потрогать', 'ok')
  }, [loadAll, toast])

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, 'name' | 'bio' | 'avatarUrl' | 'links' | 'handle'>>) => {
      try {
        const next = await backend.updateProfile(patch)
        setUser(next)
        setData((d) => ({ ...d, profiles: d.profiles.map((p) => (p.id === next.id ? next : p)) }))
        toast.push('Профиль обновлён', 'ok')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  /* ----------------------------------------------------------------- posts */

  const createPost = useCallback(
    async (input: PostInput) => {
      try {
        const post = await backend.createPost(input)
        setData((d) => ({ ...d, posts: [post, ...d.posts] }))
        toast.push('Опубликовано', 'ok')
      } catch (e) {
        fail(e)
        throw e
      }
    },
    [fail, toast],
  )

  const deletePost = useCallback(
    async (id: ID) => {
      try {
        await backend.deletePost(id)
        setData((d) => ({ ...d, posts: d.posts.filter((p) => p.id !== id) }))
        toast.push('Пост удалён')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  const toggleLike = useCallback(
    async (id: ID) => {
      if (!user) {
        toast.push('Войдите, чтобы лайкать', 'error')
        return
      }
      // optimistic
      setData((d) => ({
        ...d,
        posts: d.posts.map((p) =>
          p.id === id ? { ...p, likedByMe: !p.likedByMe, likeCount: Math.max(0, p.likeCount + (p.likedByMe ? -1 : 1)) } : p,
        ),
      }))
      try {
        const res = await backend.toggleLike(id)
        setData((d) => ({
          ...d,
          posts: d.posts.map((p) => (p.id === id ? { ...p, likedByMe: res.liked, likeCount: res.likeCount } : p)),
        }))
      } catch (e) {
        fail(e)
        await reload()
      }
    },
    [fail, reload, toast, user],
  )

  const toggleBookmark = useCallback(
    async (id: ID) => {
      if (!user) {
        toast.push('Войдите, чтобы сохранять посты', 'error')
        return
      }
      setData((d) => ({
        ...d,
        posts: d.posts.map((p) => (p.id === id ? { ...p, bookmarkedByMe: !p.bookmarkedByMe } : p)),
      }))
      try {
        const res = await backend.toggleBookmark(id)
        toast.push(res.bookmarked ? 'Добавлено в закладки' : 'Убрано из закладок')
      } catch (e) {
        fail(e)
        await reload()
      }
    },
    [fail, reload, toast, user],
  )

  const loadComments = useCallback(
    async (postId: ID) => {
      try {
        const list = await backend.fetchComments(postId)
        setCommentsOf((c) => ({ ...c, [postId]: list }))
        return list
      } catch (e) {
        fail(e)
        return [] as Comment[]
      }
    },
    [fail],
  )

  const addComment = useCallback(
    async (postId: ID, body: string) => {
      try {
        const comment = await backend.addComment(postId, body)
        setCommentsOf((c) => ({ ...c, [postId]: [...(c[postId] ?? []), comment] }))
        setData((d) => ({
          ...d,
          posts: d.posts.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)),
        }))
      } catch (e) {
        fail(e)
        throw e
      }
    },
    [fail],
  )

  /* --------------------------------------------------------------- friends */

  const sendFriendRequest = useCallback(
    async (userId: ID) => {
      try {
        const f = await backend.sendFriendRequest(userId)
        setData((d) => ({ ...d, friendships: [...d.friendships.filter((x) => x.id !== f.id), f] }))
        toast.push('Заявка отправлена', 'ok')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  const respondFriendRequest = useCallback(
    async (id: ID, accept: boolean) => {
      try {
        await backend.respondFriendRequest(id, accept)
        setData((d) => ({
          ...d,
          friendships: accept
            ? d.friendships.map((f) => (f.id === id ? { ...f, status: 'accepted' as const } : f))
            : d.friendships.filter((f) => f.id !== id),
        }))
        toast.push(accept ? 'Теперь вы друзья' : 'Заявка отклонена')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  const removeFriend = useCallback(
    async (id: ID) => {
      try {
        await backend.removeFriend(id)
        setData((d) => ({ ...d, friendships: d.friendships.filter((f) => f.id !== id) }))
        toast.push('Убрано из друзей')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  /* ----------------------------------------------------------------- chats */

  const loadMessages = useCallback(
    async (chatId: ID, _memberIds: ID[]) => {
      try {
        const list = await backend.fetchMessages(chatId)
        setMessagesOf((m) => ({ ...m, [chatId]: list }))
        return list
      } catch (e) {
        fail(e)
        return [] as Message[]
      }
    },
    [fail],
  )

  const sendMessage = useCallback(
    async (chatId: ID, body: string, attachment?: Attachment | null) => {
      try {
        const msg = await backend.sendMessage(chatId, body, attachment)
        setMessagesOf((m) => ({ ...m, [chatId]: [...(m[chatId] ?? []), msg] }))
        setData((d) => ({
          ...d,
          chats: d.chats
            .map((c) =>
              c.id === chatId
                ? {
                    ...c,
                    lastMessageAt: msg.createdAt,
                    lastMessageBody: msg.attachment && !msg.body ? `файл: ${msg.attachment.name}` : msg.body.slice(0, 80),
                  }
                : c,
            )
            .sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt)),
        }))
        return msg
      } catch (e) {
        fail(e)
        throw e
      }
    },
    [fail],
  )

  const openChat = useCallback(
    async (chatId: ID, memberIds: ID[]) => {
      setData((d) => ({ ...d, chats: d.chats.map((c) => (c.id === chatId ? { ...c, unreadCount: 0 } : c)) }))
      await loadMessages(chatId, memberIds)
      try {
        await backend.markChatRead(chatId)
      } catch {
        /* non critical */
      }
    },
    [loadMessages],
  )

  const createGroupChat = useCallback(
    async (memberIds: ID[], title: string) => {
      try {
        const chat = await backend.createChat(memberIds, title)
        setData((d) => ({ ...d, chats: [chat, ...d.chats.filter((c) => c.id !== chat.id)] }))
        return chat
      } catch (e) {
        fail(e)
        throw e
      }
    },
    [fail],
  )

  const startDm = useCallback(
    async (userId: ID) => {
      const existing = data.chats.find(
        (c) => c.kind === 'dm' && c.memberIds.length === 2 && c.memberIds.includes(userId),
      )
      if (existing) return existing
      try {
        const chat = await backend.createChat([userId], '')
        setData((d) => ({ ...d, chats: [chat, ...d.chats.filter((c) => c.id !== chat.id)] }))
        return chat
      } catch (e) {
        fail(e)
        throw e
      }
    },
    [data.chats, fail],
  )

  /* ----------------------------------------------------------------- files */

  const sendFile = useCallback(
    async (file: File) => {
      try {
        const item = await backend.uploadFile(file)
        setData((d) => ({ ...d, files: [item, ...d.files] }))
        toast.push(`«${file.name}» загружен`, 'ok')
        return item
      } catch (e) {
        fail(e)
        throw e
      }
    },
    [fail, toast],
  )

  const deleteFile = useCallback(
    async (id: ID) => {
      try {
        await backend.deleteFile(id)
        setData((d) => ({ ...d, files: d.files.filter((f) => f.id !== id) }))
        toast.push('Файл удалён')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  /* ----------------------------------------------------------------- music */

  const saveTrack = useCallback(
    async (track: Track) => {
      if (!user) {
        toast.push('Войдите, чтобы сохранять треки', 'error')
        return null
      }
      const already = data.tracks.find((t) => t.track.id === track.id)
      if (already) {
        toast.push('Трек уже в «Моей музыке»')
        return already
      }
      try {
        const saved = await backend.addTrack(track)
        setData((d) => ({ ...d, tracks: [saved, ...d.tracks] }))
        toast.push('Трек добавлен в «Мою музыку»', 'ok')
        return saved
      } catch (e) {
        fail(e)
        return null
      }
    },
    [data.tracks, fail, toast, user],
  )

  const toggleTrackLike = useCallback(
    async (id: ID) => {
      try {
        const res = await backend.toggleTrackLike(id)
        setData((d) => ({ ...d, tracks: d.tracks.map((t) => (t.id === id ? { ...t, liked: res.liked } : t)) }))
      } catch (e) {
        fail(e)
      }
    },
    [fail],
  )

  const removeTrack = useCallback(
    async (id: ID) => {
      try {
        await backend.removeTrack(id)
        setData((d) => ({
          ...d,
          tracks: d.tracks.filter((t) => t.id !== id),
          playlists: d.playlists.map((p) => ({ ...p, trackIds: p.trackIds.filter((t) => t !== id) })),
        }))
        toast.push('Трек удалён')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  const createPlaylist = useCallback(
    async (title: string, description: string) => {
      try {
        const pl = await backend.createPlaylist(title, description)
        setData((d) => ({ ...d, playlists: [...d.playlists, pl] }))
        toast.push('Плейлист создан', 'ok')
        return pl
      } catch (e) {
        fail(e)
        throw e
      }
    },
    [fail, toast],
  )

  const deletePlaylist = useCallback(
    async (id: ID) => {
      try {
        await backend.deletePlaylist(id)
        setData((d) => ({ ...d, playlists: d.playlists.filter((p) => p.id !== id) }))
        toast.push('Плейлист удалён')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  const addToPlaylist = useCallback(
    async (playlistId: ID, trackId: ID) => {
      try {
        await backend.addToPlaylist(playlistId, trackId)
        setData((d) => ({
          ...d,
          playlists: d.playlists.map((p) =>
            p.id === playlistId && !p.trackIds.includes(trackId) ? { ...p, trackIds: [...p.trackIds, trackId] } : p,
          ),
        }))
        toast.push('Добавлено в плейлист', 'ok')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  const removeFromPlaylist = useCallback(
    async (playlistId: ID, trackId: ID) => {
      try {
        await backend.removeFromPlaylist(playlistId, trackId)
        setData((d) => ({
          ...d,
          playlists: d.playlists.map((p) =>
            p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) } : p,
          ),
        }))
      } catch (e) {
        fail(e)
      }
    },
    [fail],
  )

  /* --------------------------------------------------------- notifications */

  const markNotificationsRead = useCallback(async () => {
    try {
      await backend.markNotificationsRead()
      setData((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }))
    } catch {
      /* ignore */
    }
  }, [])

  /* -------------------------------------------------------------- сообщества */

  const loadGroup = useCallback(
    async (groupId: ID) => {
      try {
        const bundle = await backend.fetchGroup(groupId)
        if (!bundle) return null
        setData((d) => ({
          ...d,
          groups: d.groups.some((g) => g.id === bundle.group.id)
            ? d.groups.map((g) => (g.id === bundle.group.id ? bundle.group : g))
            : [bundle.group, ...d.groups],
          chats: [
            ...d.chats,
            ...bundle.channels
              .filter((ch) => !d.chats.some((c) => c.id === ch.id))
              .map<Chat>((ch) => ({
                id: ch.id,
                kind: 'channel',
                title: ch.name,
                memberIds: bundle.members.map((m) => m.userId),
                groupId: bundle.group.id,
                createdAt: ch.createdAt,
                lastMessageAt: ch.createdAt,
                lastMessageBody: '',
                unreadCount: 0,
              })),
          ],
        }))
        return bundle
      } catch (e) {
        fail(e)
        return null
      }
    },
    [fail],
  )

  const createGroup = useCallback(
    async (name: string, description: string) => {
      if (!user) {
        toast.push('Войдите, чтобы создать сообщество', 'error')
        return null
      }
      try {
        const bundle = await backend.createGroup(name, description)
        setData((d) => ({
          ...d,
          groups: [bundle.group, ...d.groups],
          chats: [
            ...bundle.channels.map<Chat>((ch) => ({
              id: ch.id,
              kind: 'channel',
              title: ch.name,
              memberIds: bundle.members.map((m) => m.userId),
              groupId: bundle.group.id,
              createdAt: ch.createdAt,
              lastMessageAt: ch.createdAt,
              lastMessageBody: '',
              unreadCount: 0,
            })),
            ...d.chats,
          ],
        }))
        toast.push('Сообщество создано', 'ok')
        return bundle
      } catch (e) {
        fail(e)
        return null
      }
    },
    [fail, toast, user],
  )

  const joinGroup = useCallback(
    async (groupId: ID) => {
      if (!user) {
        toast.push('Войдите, чтобы вступить в сообщество', 'error')
        return
      }
      try {
        await backend.joinGroup(groupId)
        setData((d) => ({
          ...d,
          groups: d.groups.map((g) =>
            g.id === groupId ? { ...g, isMember: true, memberCount: g.memberCount + 1 } : g,
          ),
        }))
        toast.push('Вы в сообществе', 'ok')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast, user],
  )

  const leaveGroup = useCallback(
    async (groupId: ID) => {
      try {
        await backend.leaveGroup(groupId)
        setData((d) => ({
          ...d,
          groups: d.groups
            .map((g) => (g.id === groupId ? { ...g, isMember: false, memberCount: Math.max(0, g.memberCount - 1) } : g))
            .filter((g) => g.memberCount > 0),
          chats: d.chats.filter((c) => c.groupId !== groupId),
        }))
        toast.push('Вы покинули сообщество')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  const updateGroup = useCallback(
    async (groupId: ID, patch: Partial<Pick<Group, 'name' | 'description' | 'iconUrl'>>) => {
      try {
        await backend.updateGroup(groupId, patch)
        setData((d) => ({ ...d, groups: d.groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)) }))
        toast.push('Сообщество обновлено', 'ok')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  const deleteGroup = useCallback(
    async (groupId: ID) => {
      try {
        await backend.deleteGroup(groupId)
        setData((d) => ({
          ...d,
          groups: d.groups.filter((g) => g.id !== groupId),
          chats: d.chats.filter((c) => c.groupId !== groupId),
        }))
        toast.push('Сообщество удалено')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  const createChannel = useCallback(
    async (groupId: ID, name: string, kind: ChannelKind) => {
      try {
        const channel = await backend.createChannel(groupId, name, kind)
        toast.push(kind === 'voice' ? 'Голосовой канал создан' : 'Текстовый канал создан', 'ok')
        return channel
      } catch (e) {
        fail(e)
        return null
      }
    },
    [fail, toast],
  )

  const deleteChannel = useCallback(
    async (channelId: ID) => {
      try {
        await backend.deleteChannel(channelId)
        setData((d) => ({ ...d, chats: d.chats.filter((c) => c.id !== channelId) }))
        toast.push('Канал удалён')
      } catch (e) {
        fail(e)
      }
    },
    [fail, toast],
  )

  const searchUsers = useCallback(
    async (q: string) => {
      try {
        return await backend.searchUsers(q)
      } catch {
        return []
      }
    },
    [],
  )

  const value = useMemo<AppValue>(
    () => ({
      ...data,
      mode: backend.mode,
      booted,
      ready,
      user,
      profileById,
      friendIds,
      pendingIncoming,
      pendingOutgoing,
      unreadNotifications,
      unreadMessages,
      signIn,
      signUp,
      signOut,
      signInDemo,
      reload,
      updateProfile,
      createPost,
      deletePost,
      toggleLike,
      toggleBookmark,
      commentsOf,
      loadComments,
      addComment,
      sendFriendRequest,
      respondFriendRequest,
      removeFriend,
      sendMessage,
      openChat,
      createGroupChat,
      loadGroup,
      createGroup,
      joinGroup,
      leaveGroup,
      updateGroup,
      deleteGroup,
      createChannel,
      deleteChannel,
      startDm,
      loadMessages,
      messagesOf,
      sendFile,
      deleteFile,
      saveTrack,
      toggleTrackLike,
      removeTrack,
      createPlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      markNotificationsRead,
      searchUsers,
    }),
    [
      data,
      booted,
      ready,
      user,
      profileById,
      friendIds,
      pendingIncoming,
      pendingOutgoing,
      unreadNotifications,
      unreadMessages,
      signIn,
      signUp,
      signOut,
      signInDemo,
      reload,
      updateProfile,
      createPost,
      deletePost,
      toggleLike,
      toggleBookmark,
      commentsOf,
      loadComments,
      addComment,
      sendFriendRequest,
      respondFriendRequest,
      removeFriend,
      sendMessage,
      openChat,
      createGroupChat,
      loadGroup,
      createGroup,
      joinGroup,
      leaveGroup,
      updateGroup,
      deleteGroup,
      createChannel,
      deleteChannel,
      startDm,
      loadMessages,
      messagesOf,
      sendFile,
      deleteFile,
      saveTrack,
      toggleTrackLike,
      removeTrack,
      createPlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      markNotificationsRead,
      searchUsers,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
