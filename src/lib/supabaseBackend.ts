import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  Attachment,
  AuthResult,
  Backend,
  Channel,
  ChannelKind,
  Chat,
  Comment,
  FileItem,
  Friendship,
  Group,
  GroupBundle,
  GroupMember,
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
import { extractTags, fileKind, safeNick, uid } from './util'
import { authRedirectUrl } from './config'

/* ------------------------------------------------------------------ parsing */

type Row = Record<string, unknown>

const mapProfile = (r: Row): Profile => ({
  id: String(r.id),
  handle: String(r.handle ?? 'user'),
  name: String(r.name ?? r.handle ?? 'USER'),
  bio: String(r.bio ?? ''),
  avatarUrl: (r.avatar_url as string | null) ?? null,
  links: Array.isArray(r.links) ? (r.links as string[]) : [],
  createdAt: String(r.created_at ?? new Date().toISOString()),
})

const mapPost = (r: Row): Post => ({
  id: String(r.id),
  authorId: String(r.author_id),
  body: String(r.body ?? ''),
  tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
  imageUrl: (r.image_url as string | null) ?? null,
  track: (r.track as Track | null) ?? null,
  createdAt: String(r.created_at),
  likeCount: Number(r.like_count ?? 0),
  commentCount: Number(r.comment_count ?? 0),
  pinned: Boolean(r.pinned),
  repostOf: (r.repost_of as string | null) ?? null,
})

const mapComment = (r: Row): Comment => ({
  id: String(r.id),
  postId: String(r.post_id),
  authorId: String(r.author_id),
  body: String(r.body ?? ''),
  createdAt: String(r.created_at),
})

const mapFriendship = (r: Row): Friendship => ({
  id: String(r.id),
  requesterId: String(r.requester_id),
  addresseeId: String(r.addressee_id),
  status: r.status as Friendship['status'],
  createdAt: String(r.created_at),
})

const mapMessage = (r: Row): Message => ({
  id: String(r.id),
  chatId: String(r.chat_id),
  senderId: String(r.sender_id),
  body: String(r.body ?? ''),
  attachment: (r.attachment as Attachment | null) ?? null,
  createdAt: String(r.created_at),
  readBy: Array.isArray(r.read_by) ? (r.read_by as string[]) : [],
})

const mapFile = (r: Row): FileItem => ({
  id: String(r.id),
  ownerId: String(r.owner_id),
  name: String(r.name),
  size: Number(r.size ?? 0),
  mime: String(r.mime ?? 'application/octet-stream'),
  url: String(r.url ?? ''),
  createdAt: String(r.created_at),
  kind: fileKind(String(r.mime ?? ''), String(r.name ?? '')),
})

const mapGroup = (r: Row, meId: ID | null): Group => {
  const members = (r.group_members as Array<{ user_id: string }> | undefined) ?? []
  return {
    id: String(r.id),
    name: String(r.name ?? 'ГРУППА'),
    description: String(r.description ?? ''),
    ownerId: String(r.owner_id),
    iconUrl: (r.icon_url as string | null) ?? null,
    createdAt: String(r.created_at),
    memberCount: members.length,
    isMember: Boolean(meId && members.some((m) => String(m.user_id) === meId)),
  }
}

const mapChannel = (r: Row): Channel => ({
  id: String(r.id),
  groupId: String(r.group_id),
  name: String(r.name ?? 'канал'),
  kind: (r.kind as ChannelKind) ?? 'text',
  position: Number(r.position ?? 0),
  createdAt: String(r.created_at),
})

const mapGroupMember = (r: Row): GroupMember => ({
  groupId: String(r.group_id),
  userId: String(r.user_id),
  role: (r.role as GroupMember['role']) ?? 'member',
  joinedAt: String(r.joined_at),
})

const mapSavedTrack = (r: Row): SavedTrack => ({
  id: String(r.id),
  ownerId: String(r.owner_id),
  track: r.track as Track,
  liked: Boolean(r.liked),
  note: (r.note as string) ?? '',
  createdAt: String(r.created_at),
})

/* ------------------------------------------------------------------ backend */

export class SupabaseBackend implements Backend {
  mode = 'supabase' as const
  private sb: SupabaseClient
  private user: Profile | null = null
  private listeners = new Set<(u: Profile | null) => void>()

  private url: string
  private anonKey: string
  private authSubscribed = false

  constructor(url: string, anonKey: string) {
    this.url = url
    this.anonKey = anonKey
    this.sb = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  }

  /** Быстрая проверка: отвечает ли проект Supabase и есть ли таблицы. */
  async probe(): Promise<boolean> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    try {
      const res = await fetch(`${this.url}/rest/v1/profiles?select=id&limit=1`, {
        signal: controller.signal,
        headers: { apikey: this.anonKey, Accept: 'application/json' },
      })
      return res.ok || res.status === 401
    } catch {
      return false
    } finally {
      clearTimeout(timer)
    }
  }

  /** Вход через Google: уводим браузер на страницу согласия Supabase. */
  async signInWithProvider(provider: 'google'): Promise<boolean> {
    const { error } = await this.sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: authRedirectUrl(), queryParams: { prompt: 'select_account' } },
    })
    if (error) throw new Error(translateAuthError(error.message))
    return true
  }

  /** Magic link: письмо со ссылкой вместо пароля. */
  async signInWithMagicLink(email: string): Promise<void> {
    const address = email.trim()
    if (!address) throw new Error('Введите e-mail')
    const { error } = await this.sb.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: true },
    })
    if (error) throw new Error(translateAuthError(error.message))
  }

  /**
   * Гостевой вход в один клик.
   *
   * Сначала пробуем настоящий anonymous sign-in. Если в проекте он выключен
   * (это настройка дашборда, а не кода), тихо создаём обычный аккаунт со
   * случайными данными: почта подтверждения не требует (autoconfirm), пароль
   * остаётся в localStorage, и позже его можно заменить на свой.
   */
  async signInAnonymously(): Promise<AuthResult> {
    const { data, error } = await this.sb.auth.signInAnonymously()
    if (!error && data.user) {
      const profile = await this.ensureProfile({
        id: data.user.id,
        email: data.user.email ?? null,
        user_metadata: data.user.user_metadata,
      })
      if (!profile) throw new Error('Профиль гостя не создался')
      this.user = profile
      this.emit()
      return { user: profile }
    }
    return this.createThrowawayAccount()
  }

  /** Запасной путь для гостя: обычная регистрация с одноразовыми данными. */
  private async createThrowawayAccount(): Promise<AuthResult> {
    const random = Math.random().toString(36).slice(2, 10)
    const handle = `guest_${random}`
    const email = `${handle}@guest.lulzforum.app`
    const password = `${random}-${Math.random().toString(36).slice(2, 12)}-${Date.now().toString(36)}`
    const { data, error } = await this.sb.auth.signUp({
      email,
      password,
      options: { data: { handle, name: 'ГОСТЬ' }, emailRedirectTo: undefined },
    })
    if (error) throw new Error(translateAuthError(error.message))
    if (!data.user) throw new Error('Не удалось создать гостевой аккаунт')
    if (!data.session) {
      throw new Error(
        'Гостевой вход не сработал: в проекте включено подтверждение почты. Включите anonymous sign-in в Supabase или отключите Confirm email.',
      )
    }
    try {
      localStorage.setItem('lulzforum:guest', JSON.stringify({ email, password }))
    } catch {
      /* приватный режим */
    }
    const profile = await this.ensureProfile({
      id: data.user.id,
      email: data.user.email ?? email,
      user_metadata: { handle, name: 'ГОСТЬ' },
    })
    if (!profile) throw new Error('Профиль гостя не создался')
    this.user = profile
    this.emit()
    return { user: profile }
  }

  /** Профиль из auth-пользователя: если строки нет — создаём из метаданных. */
  private async ensureProfile(user: {
    id: string
    email: string | null
    user_metadata: Record<string, unknown>
  }): Promise<Profile | null> {
    const existing = await this.loadProfile(user.id)
    if (existing) return existing
    const meta = (user.user_metadata ?? {}) as Record<string, string>
    const rawHandle =
      safeNick(meta.handle ?? meta.user_name ?? meta.preferred_username ?? user.email?.split('@')[0] ?? '') || ''
    const handle = rawHandle || `guest${user.id.replace(/-/g, '').slice(0, 6)}`
    const name = (meta.full_name || meta.name || (user.email ? handle.toUpperCase() : 'ГОСТЬ')).slice(0, 40)
    const { data: created, error } = await this.sb
      .from('profiles')
      .upsert({
        id: user.id,
        handle,
        name,
        avatar_url: meta.avatar_url ?? meta.picture ?? null,
        bio: '',
      })
      .select('*')
      .maybeSingle()
    if (error) throw error
    return created ? mapProfile(created as Row) : null
  }

  /** Подписка на изменения авторизации — ровно один раз за жизнь клиента. */
  private subscribeAuth() {
    if (this.authSubscribed) return
    this.authSubscribed = true
    this.sb.auth.onAuthStateChange((event, session) => {
      void (async () => {
        try {
          if (event === 'SIGNED_OUT') {
            this.user = null
            this.emit()
            return
          }
          if (!session?.user) return
          const profile = await this.ensureProfile({
            id: session.user.id,
            email: session.user.email ?? null,
            user_metadata: session.user.user_metadata ?? {},
          })
          if (profile) {
            this.user = profile
            this.emit()
          }
        } catch (error) {
          console.error('auth state change failed', error)
        }
      })()
    })
  }

  private emit() {
    for (const l of this.listeners) l(this.user)
  }

  private get me(): Profile {
    if (!this.user) throw new Error('Нужно войти в аккаунт')
    return this.user
  }

  private async loadProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.sb.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) throw error
    if (!data) return null
    return mapProfile(data as Row)
  }

  async init(): Promise<Profile | null> {
    this.subscribeAuth()
    const { data } = await this.sb.auth.getSession()
    const authUser = data.session?.user
    if (!authUser) return null
    const profile = await this.ensureProfile({
      id: authUser.id,
      email: authUser.email ?? null,
      user_metadata: authUser.user_metadata ?? {},
    })
    this.user = profile
    return profile
  }

  onAuthChange(cb: (u: Profile | null) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(translateAuthError(error.message))
    if (!data.user) throw new Error('Не удалось войти')
    const profile = await this.loadProfile(data.user.id)
    this.user = profile
    this.emit()
    return { user: profile }
  }

  async signUp(email: string, password: string, handle: string, name: string): Promise<AuthResult> {
    const nick = safeNick(handle)
    if (!nick) throw new Error('Некорректный ник')
    const { data: taken } = await this.sb.from('profiles').select('id').eq('handle', nick).maybeSingle()
    if (taken) throw new Error('Такой ник уже занят')
    const { data, error } = await this.sb.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { handle: nick, name: (name || nick).toUpperCase() }, emailRedirectTo: window.location.href },
    })
    if (error) throw new Error(translateAuthError(error.message))
    if (!data.session) return { user: null, needsConfirmation: true }
    const authId = data.user?.id
    if (!authId) throw new Error('Не удалось создать аккаунт')
    const { data: created, error: profileError } = await this.sb
      .from('profiles')
      .upsert({ id: authId, handle: nick, name: (name || nick).toUpperCase(), bio: '' })
      .select('*')
      .maybeSingle()
    if (profileError) throw profileError
    this.user = created ? mapProfile(created as Row) : null
    this.emit()
    return { user: this.user }
  }

  async signOut(): Promise<void> {
    await this.sb.auth.signOut()
    this.user = null
    this.emit()
  }

  async updateProfile(patch: Partial<Pick<Profile, 'name' | 'bio' | 'avatarUrl' | 'links' | 'handle'>>): Promise<Profile> {
    const me = this.me
    const payload: Row = {}
    if (patch.name !== undefined) payload.name = patch.name.slice(0, 40)
    if (patch.bio !== undefined) payload.bio = patch.bio.slice(0, 400)
    if (patch.avatarUrl !== undefined) payload.avatar_url = patch.avatarUrl
    if (patch.links !== undefined) payload.links = patch.links.slice(0, 5)
    if (patch.handle !== undefined) {
      const nick = safeNick(patch.handle)
      if (!nick) throw new Error('Некорректный ник')
      payload.handle = nick
    }
    const { data, error } = await this.sb.from('profiles').update(payload).eq('id', me.id).select('*').single()
    if (error) throw new Error(error.message.includes('duplicate') ? 'Такой ник уже занят' : error.message)
    this.user = mapProfile(data as Row)
    this.emit()
    return this.user
  }

  async fetchProfiles(): Promise<Profile[]> {
    const { data, error } = await this.sb.from('profiles').select('*').order('created_at', { ascending: true }).limit(200)
    if (error) throw error
    return (data ?? []).map((r) => mapProfile(r as Row))
  }

  async fetchPosts(): Promise<Post[]> {
    const meId = this.user?.id ?? null
    const { data, error } = await this.sb
      .from('posts')
      .select('*, comments(count)')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(120)
    if (error) throw error
    const rows = (data ?? []) as Row[]
    const postIds = rows.map((r) => String(r.id))
    let liked = new Set<ID>()
    let bookmarked = new Set<ID>()
    if (meId && postIds.length) {
      const [{ data: likes }, { data: marks }] = await Promise.all([
        this.sb.from('post_likes').select('post_id').eq('user_id', meId).in('post_id', postIds),
        this.sb.from('bookmarks').select('post_id').eq('user_id', meId).in('post_id', postIds),
      ])
      liked = new Set((likes ?? []).map((r) => String((r as Row).post_id)))
      bookmarked = new Set((marks ?? []).map((r) => String((r as Row).post_id)))
    }
    return rows.map((r) => {
      const post = mapPost(r)
      const counts = r.comments as Array<{ count: number }> | undefined
      post.commentCount = counts?.[0]?.count ?? 0
      post.likedByMe = liked.has(post.id)
      post.bookmarkedByMe = bookmarked.has(post.id)
      return post
    })
  }

  async createPost(input: PostInput): Promise<Post> {
    const me = this.me
    const body = input.body.trim().slice(0, 4000)
    if (!body && !input.imageUrl && !input.track) throw new Error('Пост не может быть пустым')
    const { data, error } = await this.sb
      .from('posts')
      .insert({
        author_id: me.id,
        body,
        tags: extractTags(input.body, input.tags),
        image_url: input.imageUrl ?? null,
        track: input.track ?? null,
      })
      .select('*')
      .single()
    if (error) throw error
    return mapPost(data as Row)
  }

  async deletePost(id: ID): Promise<void> {
    const { error } = await this.sb.from('posts').delete().eq('id', id).eq('author_id', this.me.id)
    if (error) throw error
  }

  async toggleLike(postId: ID): Promise<{ liked: boolean; likeCount: number }> {
    const me = this.me
    const { data: existing } = await this.sb
      .from('post_likes')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', me.id)
      .maybeSingle()
    if (existing) {
      const { error } = await this.sb.from('post_likes').delete().eq('post_id', postId).eq('user_id', me.id)
      if (error) throw error
    } else {
      const { error } = await this.sb.from('post_likes').insert({ post_id: postId, user_id: me.id })
      if (error) throw error
    }
    const { count } = await this.sb.from('post_likes').select('post_id', { count: 'exact', head: true }).eq('post_id', postId)
    return { liked: !existing, likeCount: count ?? 0 }
  }

  async toggleBookmark(postId: ID): Promise<{ bookmarked: boolean }> {
    const me = this.me
    const { data: existing } = await this.sb
      .from('bookmarks')
      .select('post_id')
      .eq('post_id', postId)
      .eq('user_id', me.id)
      .maybeSingle()
    if (existing) {
      await this.sb.from('bookmarks').delete().eq('post_id', postId).eq('user_id', me.id)
      return { bookmarked: false }
    }
    await this.sb.from('bookmarks').insert({ post_id: postId, user_id: me.id })
    return { bookmarked: true }
  }

  async fetchComments(postId: ID): Promise<Comment[]> {
    const { data, error } = await this.sb
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((r) => mapComment(r as Row))
  }

  async addComment(postId: ID, body: string): Promise<Comment> {
    const text = body.trim().slice(0, 1000)
    if (!text) throw new Error('Пустой комментарий')
    const { data, error } = await this.sb
      .from('comments')
      .insert({ post_id: postId, author_id: this.me.id, body: text })
      .select('*')
      .single()
    if (error) throw error
    return mapComment(data as Row)
  }

  async fetchFriendships(): Promise<Friendship[]> {
    const me = this.me
    const { data, error } = await this.sb
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`)
    if (error) throw error
    return (data ?? []).map((r) => mapFriendship(r as Row))
  }

  async sendFriendRequest(userId: ID): Promise<Friendship> {
    const me = this.me
    const { data, error } = await this.sb
      .from('friendships')
      .insert({ requester_id: me.id, addressee_id: userId, status: 'pending' })
      .select('*')
      .single()
    if (error) {
      if (error.code === '23505' || error.code === '23P01') {
        const { data: existing } = await this.sb
          .from('friendships')
          .select('*')
          .or(
            `and(requester_id.eq.${me.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${me.id})`,
          )
          .maybeSingle()
        if (existing) return mapFriendship(existing as Row)
      }
      throw error
    }
    return mapFriendship(data as Row)
  }

  async respondFriendRequest(id: ID, accept: boolean): Promise<void> {
    if (accept) {
      const { error } = await this.sb.from('friendships').update({ status: 'accepted' }).eq('id', id)
      if (error) throw error
    } else {
      const { error } = await this.sb.from('friendships').delete().eq('id', id)
      if (error) throw error
    }
  }

  async removeFriend(id: ID): Promise<void> {
    const { error } = await this.sb.from('friendships').delete().eq('id', id)
    if (error) throw error
  }

  private async chatMembers(chatIds: ID[]): Promise<Record<ID, ID[]>> {
    if (!chatIds.length) return {}
    const { data } = await this.sb.from('chat_members').select('chat_id, user_id').in('chat_id', chatIds)
    const out: Record<ID, ID[]> = {}
    for (const row of data ?? []) {
      const r = row as Row
      const cid = String(r.chat_id)
      ;(out[cid] ??= []).push(String(r.user_id))
    }
    return out
  }

  async fetchChats(): Promise<Chat[]> {
    const me = this.me
    const { data: memberships, error } = await this.sb.from('chat_members').select('chat_id').eq('user_id', me.id)
    if (error) throw error
    const chatIds = (memberships ?? []).map((r) => String((r as Row).chat_id))
    if (!chatIds.length) return []
    const { data, error: chatsError } = await this.sb
      .from('chats')
      .select('*')
      .in('id', chatIds)
      .in('kind', ['dm', 'group'])
      .order('last_message_at', { ascending: false })
    if (chatsError) throw chatsError
    const members = await this.chatMembers(chatIds)
    const unread: Record<string, number> = {}
    const { data: counts } = await this.sb.rpc('unread_counts')
    for (const row of (counts ?? []) as Row[]) {
      unread[String(row.chat_id)] = Number(row.unread ?? 0)
    }
    return (data ?? []).map((r) => {
      const row = r as Row
      const id = String(row.id)
      return {
        id,
        kind: (row.kind as Chat['kind']) ?? 'dm',
        title: String(row.title ?? ''),
        memberIds: members[id] ?? [],
        createdAt: String(row.created_at),
        lastMessageAt: String(row.last_message_at ?? row.created_at),
        lastMessageBody: String(row.last_message_body ?? ''),
        groupId: (row.group_id as string | null) ?? null,
        unreadCount: unread[id] ?? 0,
      }
    })
  }

  /* ------------------------------------------------------------- сообщества */

  async fetchGroups(): Promise<Group[]> {
    const me = this.user?.id ?? null
    const { data, error } = await this.sb
      .from('groups')
      .select('*, group_members(user_id)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return (data ?? []).map((r) => mapGroup(r as Row, me))
  }

  async fetchGroup(groupId: ID): Promise<GroupBundle | null> {
    const me = this.user?.id ?? null
    const { data: groupRow, error } = await this.sb
      .from('groups')
      .select('*, group_members(user_id)')
      .eq('id', groupId)
      .maybeSingle()
    if (error) throw error
    if (!groupRow) return null
    const [{ data: channels, error: chError }, { data: members, error: memError }] = await Promise.all([
      this.sb.from('channels').select('*').eq('group_id', groupId).order('position', { ascending: true }),
      this.sb.from('group_members').select('*').eq('group_id', groupId),
    ])
    if (chError) throw chError
    if (memError) throw memError
    return {
      group: mapGroup(groupRow as Row, me),
      channels: (channels ?? []).map((r) => mapChannel(r as Row)),
      members: (members ?? []).map((r) => mapGroupMember(r as Row)),
    }
  }

  private async createChannelRow(groupId: ID, name: string, kind: ChannelKind, position: number): Promise<Channel> {
    const me = this.me
    const { data, error } = await this.sb
      .from('channels')
      .insert({ group_id: groupId, name, kind, position })
      .select('*')
      .single()
    if (error) throw error
    const channel = mapChannel(data as Row)
    const { error: chatError } = await this.sb.from('chats').insert({
      id: channel.id,
      kind: 'channel',
      title: channel.name,
      group_id: groupId,
      created_by: me.id,
    })
    if (chatError) throw chatError
    return channel
  }

  async createGroup(name: string, description: string): Promise<GroupBundle> {
    const me = this.me
    const { data: groupRow, error } = await this.sb
      .from('groups')
      .insert({
        name: name.trim().slice(0, 60) || 'НОВАЯ ГРУППА',
        description: description.trim().slice(0, 300),
        owner_id: me.id,
      })
      .select('*')
      .single()
    if (error) throw error
    const groupId = String((groupRow as Row).id)

    const { error: memberError } = await this.sb
      .from('group_members')
      .insert({ group_id: groupId, user_id: me.id, role: 'owner' })
    if (memberError) throw memberError

    const text = await this.createChannelRow(groupId, 'общий', 'text', 0)
    const voice = await this.createChannelRow(groupId, 'ГОЛОСОВАЯ', 'voice', 1)
    await this.sb.from('chat_members').upsert([
      { chat_id: text.id, user_id: me.id },
      { chat_id: voice.id, user_id: me.id },
    ])

    return {
      group: mapGroup({ ...(groupRow as Row), group_members: [{ user_id: me.id }] }, me.id),
      channels: [text, voice],
      members: [{ groupId, userId: me.id, role: 'owner', joinedAt: new Date().toISOString() }],
    }
  }

  async joinGroup(groupId: ID): Promise<void> {
    const me = this.me
    const { error } = await this.sb
      .from('group_members')
      .insert({ group_id: groupId, user_id: me.id, role: 'member' })
    if (error && error.code !== '23505') throw error
    const { data: channels } = await this.sb.from('channels').select('id').eq('group_id', groupId)
    const rows = (channels ?? []).map((c) => ({ chat_id: String((c as Row).id), user_id: me.id }))
    if (rows.length) {
      const { error: memberError } = await this.sb.from('chat_members').upsert(rows, { ignoreDuplicates: true })
      if (memberError) throw memberError
    }
  }

  async leaveGroup(groupId: ID): Promise<void> {
    const me = this.me
    const { error } = await this.sb
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', me.id)
    if (error) throw error
    const { data: channels } = await this.sb.from('channels').select('id').eq('group_id', groupId)
    for (const c of channels ?? []) {
      await this.sb.from('chat_members').delete().eq('chat_id', String((c as Row).id)).eq('user_id', me.id)
    }
  }

  async updateGroup(groupId: ID, patch: Partial<Pick<Group, 'name' | 'description' | 'iconUrl'>>): Promise<void> {
    const payload: Row = {}
    if (patch.name !== undefined) payload.name = patch.name.slice(0, 60)
    if (patch.description !== undefined) payload.description = patch.description.slice(0, 300)
    if (patch.iconUrl !== undefined) payload.icon_url = patch.iconUrl
    const { error } = await this.sb.from('groups').update(payload).eq('id', groupId)
    if (error) throw error
  }

  async deleteGroup(groupId: ID): Promise<void> {
    const { error } = await this.sb.from('groups').delete().eq('id', groupId)
    if (error) throw error
  }

  async createChannel(groupId: ID, name: string, kind: ChannelKind): Promise<Channel> {
    const me = this.me
    const { count } = await this.sb
      .from('channels')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', groupId)
    const channel = await this.createChannelRow(
      groupId,
      name.trim().replace(/^#/, '').slice(0, 40).toLowerCase() || 'канал',
      kind,
      count ?? 0,
    )
    const { data: members } = await this.sb.from('group_members').select('user_id').eq('group_id', groupId)
    const rows = (members ?? []).map((m) => ({ chat_id: channel.id, user_id: String((m as Row).user_id) }))
    if (rows.length) await this.sb.from('chat_members').upsert(rows, { ignoreDuplicates: true })
    if (!rows.some((r) => r.user_id === me.id)) {
      await this.sb.from('chat_members').upsert({ chat_id: channel.id, user_id: me.id }, { ignoreDuplicates: true })
    }
    return channel
  }

  async deleteChannel(channelId: ID): Promise<void> {
    const { error } = await this.sb.from('channels').delete().eq('id', channelId)
    if (error) throw error
  }

  async createChat(memberIds: ID[], title: string): Promise<Chat> {
    const me = this.me
    const members = Array.from(new Set([me.id, ...memberIds]))
    const kind: Chat['kind'] = members.length > 2 ? 'group' : 'dm'
    const { data, error } = await this.sb
      .from('chats')
      .insert({ kind, title: kind === 'group' ? title || 'НОВАЯ ГРУППА' : '', created_by: me.id })
      .select('*')
      .single()
    if (error) throw error
    const chatId = String((data as Row).id)
    const { error: memberError } = await this.sb
      .from('chat_members')
      .insert(members.map((user_id) => ({ chat_id: chatId, user_id })))
    if (memberError) throw memberError
    return {
      id: chatId,
      kind,
      title: String((data as Row).title ?? ''),
      memberIds: members,
      createdAt: String((data as Row).created_at),
      lastMessageAt: String((data as Row).last_message_at ?? (data as Row).created_at),
      lastMessageBody: '',
      unreadCount: 0,
    }
  }

  async fetchMessages(chatId: ID): Promise<Message[]> {
    const { data, error } = await this.sb
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true })
      .limit(300)
    if (error) throw error
    return (data ?? []).map((r) => mapMessage(r as Row))
  }

  async sendMessage(chatId: ID, body: string, attachment?: Attachment | null): Promise<Message> {
    const me = this.me
    const text = body.trim().slice(0, 4000)
    if (!text && !attachment) throw new Error('Пустое сообщение')
    const { data, error } = await this.sb
      .from('messages')
      .insert({ chat_id: chatId, sender_id: me.id, body: text, attachment: attachment ?? null, read_by: [me.id] })
      .select('*')
      .single()
    if (error) throw error
    await this.sb
      .from('chats')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_body: attachment && !text ? `файл: ${attachment.name}` : text.slice(0, 80),
      })
      .eq('id', chatId)
    return mapMessage(data as Row)
  }

  async markChatRead(chatId: ID): Promise<void> {
    const me = this.me
    const { data } = await this.sb.from('messages').select('id, read_by').eq('chat_id', chatId)
    const unread = (data ?? []).filter((r) => !((r as Row).read_by as string[] | null)?.includes(me.id))
    for (const row of unread) {
      const current = ((row as Row).read_by as string[] | null) ?? []
      await this.sb
        .from('messages')
        .update({ read_by: [...current, me.id] })
        .eq('id', String((row as Row).id))
    }
  }

  subscribeChat(chatId: ID, cb: (m: Message) => void): () => void {
    const channel = this.sb
      .channel(`chat:${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => cb(mapMessage(payload.new as Row)),
      )
      .subscribe()
    return () => {
      void this.sb.removeChannel(channel)
    }
  }

  async fetchFiles(): Promise<FileItem[]> {
    const { data, error } = await this.sb
      .from('files')
      .select('*')
      .eq('owner_id', this.me.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    const items = (data ?? []).map((r) => mapFile(r as Row))
    // Refresh signed URLs for private objects.
    return Promise.all(
      items.map(async (item) => {
        const path = item.url.startsWith('storage:') ? item.url.slice(8) : null
        if (!path) return item
        const { data: signed } = await this.sb.storage.from('vault').createSignedUrl(path, 60 * 60 * 24 * 7)
        return { ...item, url: signed?.signedUrl ?? '' }
      }),
    )
  }

  async uploadFile(file: File): Promise<FileItem> {
    const me = this.me
    if (file.size > 50 * 1024 * 1024) throw new Error('Лимит 50 МБ на файл')
    const id = uid('fl')
    const path = `${me.id}/${id}-${file.name.replace(/[^\w.\-]+/g, '_')}`
    const { error: uploadError } = await this.sb.storage.from('vault').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    })
    if (uploadError) throw new Error(`Не удалось загрузить: ${uploadError.message}`)
    const { data: signed } = await this.sb.storage.from('vault').createSignedUrl(path, 60 * 60 * 24 * 7)
    const { data, error } = await this.sb
      .from('files')
      .insert({
        id,
        owner_id: me.id,
        name: file.name,
        size: file.size,
        mime: file.type || 'application/octet-stream',
        url: `storage:${path}`,
      })
      .select('*')
      .single()
    if (error) throw error
    return { ...mapFile(data as Row), url: signed?.signedUrl ?? '' }
  }

  async deleteFile(id: ID): Promise<void> {
    const { data } = await this.sb.from('files').select('url').eq('id', id).eq('owner_id', this.me.id).maybeSingle()
    const stored = String((data as Row | null)?.url ?? '')
    if (stored.startsWith('storage:')) {
      await this.sb.storage.from('vault').remove([stored.slice(8)])
    }
    const { error } = await this.sb.from('files').delete().eq('id', id).eq('owner_id', this.me.id)
    if (error) throw error
  }

  async fetchTracks(): Promise<SavedTrack[]> {
    const { data, error } = await this.sb
      .from('saved_tracks')
      .select('*')
      .eq('owner_id', this.me.id)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r) => mapSavedTrack(r as Row))
  }

  async addTrack(track: Track): Promise<SavedTrack> {
    const { data, error } = await this.sb
      .from('saved_tracks')
      .upsert(
        { owner_id: this.me.id, track, liked: false },
        { onConflict: 'owner_id,track_id', ignoreDuplicates: true },
      )
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (data) return mapSavedTrack(data as Row)
    const { data: existing } = await this.sb
      .from('saved_tracks')
      .select('*')
      .eq('owner_id', this.me.id)
      .eq('track->>id', track.id)
      .maybeSingle()
    if (!existing) throw new Error('Не удалось сохранить трек')
    return mapSavedTrack(existing as Row)
  }

  async toggleTrackLike(id: ID): Promise<{ liked: boolean }> {
    const { data } = await this.sb.from('saved_tracks').select('liked').eq('id', id).maybeSingle()
    const liked = !Boolean((data as Row | null)?.liked)
    const { error } = await this.sb.from('saved_tracks').update({ liked }).eq('id', id).eq('owner_id', this.me.id)
    if (error) throw error
    return { liked }
  }

  async removeTrack(id: ID): Promise<void> {
    const { error } = await this.sb.from('saved_tracks').delete().eq('id', id).eq('owner_id', this.me.id)
    if (error) throw error
  }

  async fetchPlaylists(): Promise<Playlist[]> {
    const { data, error } = await this.sb
      .from('playlists')
      .select('*, playlist_tracks(track_id)')
      .eq('owner_id', this.me.id)
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data ?? []).map((r) => {
      const row = r as Row
      const links = (row.playlist_tracks as Array<{ track_id: string }> | undefined) ?? []
      return {
        id: String(row.id),
        ownerId: String(row.owner_id),
        title: String(row.title ?? ''),
        description: String(row.description ?? ''),
        trackIds: links.map((l) => String(l.track_id)),
        createdAt: String(row.created_at),
      }
    })
  }

  async createPlaylist(title: string, description: string): Promise<Playlist> {
    const { data, error } = await this.sb
      .from('playlists')
      .insert({
        owner_id: this.me.id,
        title: title.trim().slice(0, 60) || 'НОВЫЙ ПЛЕЙЛИСТ',
        description: description.trim().slice(0, 200),
      })
      .select('*')
      .single()
    if (error) throw error
    const row = data as Row
    return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      title: String(row.title),
      description: String(row.description ?? ''),
      trackIds: [],
      createdAt: String(row.created_at),
    }
  }

  async deletePlaylist(id: ID): Promise<void> {
    const { error } = await this.sb.from('playlists').delete().eq('id', id).eq('owner_id', this.me.id)
    if (error) throw error
  }

  async addToPlaylist(playlistId: ID, trackId: ID): Promise<void> {
    const { error } = await this.sb
      .from('playlist_tracks')
      .upsert({ playlist_id: playlistId, track_id: trackId }, { ignoreDuplicates: true })
    if (error) throw error
  }

  async removeFromPlaylist(playlistId: ID, trackId: ID): Promise<void> {
    const { error } = await this.sb
      .from('playlist_tracks')
      .delete()
      .eq('playlist_id', playlistId)
      .eq('track_id', trackId)
    if (error) throw error
  }

  async fetchNotifications(): Promise<Notification[]> {
    const { data, error } = await this.sb
      .from('notifications')
      .select('*')
      .eq('user_id', this.me.id)
      .order('created_at', { ascending: false })
      .limit(60)
    if (error) throw error
    return (data ?? []).map((r) => {
      const row = r as Row
      return {
        id: String(row.id),
        userId: String(row.user_id),
        kind: row.kind as Notification['kind'],
        actorId: String(row.actor_id ?? ''),
        postId: (row.post_id as string | null) ?? null,
        chatId: (row.chat_id as string | null) ?? null,
        text: (row.text as string | null) ?? '',
        createdAt: String(row.created_at),
        read: Boolean(row.read),
      }
    })
  }

  async markNotificationsRead(): Promise<void> {
    const { error } = await this.sb.from('notifications').update({ read: true }).eq('user_id', this.me.id).eq('read', false)
    if (error) throw error
  }

  async searchUsers(query: string): Promise<Profile[]> {
    const q = query.trim()
    if (!q) return []
    const { data, error } = await this.sb
      .from('profiles')
      .select('*')
      .or(`handle.ilike.%${q}%,name.ilike.%${q}%`)
      .limit(20)
    if (error) throw error
    return (data ?? []).map((r) => mapProfile(r as Row))
  }

  async uploadPublicImage(file: File): Promise<string> {
    const me = this.me
    const safeName = file.name.replace(/[^\w.-]+/g, '_')
    const path = `images/${me.id}/${Date.now()}-${safeName}`
    const { error } = await this.sb.storage.from('public').upload(path, file, { upsert: true, cacheControl: '3600' })
    if (error) throw new Error(error.message)
    const { data } = this.sb.storage.from('public').getPublicUrl(path)
    return data.publicUrl
  }
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Неверная почта или пароль'
  if (m.includes('email not confirmed')) return 'Почта не подтверждена — проверьте письмо'
  if (m.includes('already registered')) return 'Такая почта уже занята'
  if (m.includes('password') && m.includes('6')) return 'Пароль должен быть не короче 6 символов'
  if (m.includes('rate limit')) return 'Слишком много попыток, подождите минуту'
  if (m.includes('provider is not enabled') || m.includes('unsupported provider')) {
    return 'Этот способ входа не включён в Supabase. Включите провайдера в Authentication → Providers, или войдите по почте / гостем.'
  }
  if (m.includes('anonymous') && m.includes('disabled')) {
    return 'Гостевой вход выключен в Supabase (Authentication → Providers → Anonymous)'
  }
  return message
}
