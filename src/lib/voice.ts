import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './config'

/* ---------------------------------------------------------------------------
 * ГОЛОСОВЫЕ КАНАЛЫ
 *
 * Звук идёт напрямую между участниками (WebRTC mesh, P2P), а сигналинг —
 * через Supabase Realtime broadcast, потому что у статического сайта нет
 * своего сервера. Без Supabase остаётся локальный режим: микрофон работает,
 * слышите только себя — это честно показывается в интерфейсе.
 * ------------------------------------------------------------------------- */

let sharedClient: SupabaseClient | null = null

function client(): SupabaseClient | null {
  if (!supabaseConfigured || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  if (!sharedClient) {
    sharedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return sharedClient
}

export const voiceSignalingAvailable = supabaseConfigured

export interface VoicePeer {
  id: string
  name: string
}

export interface VoiceState {
  status: 'idle' | 'connecting' | 'live' | 'error'
  muted: boolean
  level: number
  peers: VoicePeer[]
  error: string | null
  localOnly: boolean
}

const initialState: VoiceState = {
  status: 'idle',
  muted: false,
  level: 0,
  peers: [],
  error: null,
  localOnly: !voiceSignalingAvailable,
}

interface SignalPayload {
  to: string
  from: string
  name?: string
  kind: 'hello' | 'offer' | 'answer' | 'ice' | 'bye'
  data?: unknown
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
]

export class VoiceRoom {
  private channelId: string
  private me: { id: string; name: string }
  private state: VoiceState = { ...initialState }
  private listeners = new Set<(s: VoiceState) => void>()
  private stream: MediaStream | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private raf = 0
  private channel: RealtimeChannel | null = null
  private pcs = new Map<string, RTCPeerConnection>()
  private remoteAudio = new Map<string, HTMLAudioElement>()
  private muted = false

  constructor(channelId: string, me: { id: string; name: string }) {
    this.channelId = channelId
    this.me = me
  }

  getState(): VoiceState {
    return this.state
  }

  subscribe(listener: (s: VoiceState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  private patch(next: Partial<VoiceState>) {
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener(this.state)
  }

  /* ----------------------------------------------------------- микрофон */

  private async openMic(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Браузер не умеет работать с микрофоном (нужен HTTPS)')
    }
    return navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: false,
    })
  }

  private startMeter(stream: MediaStream) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    this.audioContext = new Ctx()
    const source = this.audioContext.createMediaStreamSource(stream)
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 512
    source.connect(this.analyser)
    const buffer = new Uint8Array(this.analyser.fftSize)
    let last = 0
    const tick = (time: number) => {
      if (!this.analyser) return
      this.analyser.getByteTimeDomainData(buffer)
      let sum = 0
      for (const v of buffer) {
        const x = (v - 128) / 128
        sum += x * x
      }
      const rms = Math.sqrt(sum / buffer.length)
      if (time - last > 90) {
        last = time
        this.patch({ level: Math.min(1, rms * 4) })
      }
      this.raf = requestAnimationFrame(tick)
    }
    this.raf = requestAnimationFrame(tick)
  }

  async join() {
    if (this.state.status === 'connecting' || this.state.status === 'live') return
    this.patch({ status: 'connecting', error: null })
    try {
      this.stream = await this.openMic()
      this.applyMute()
      this.startMeter(this.stream)
    } catch (error) {
      const message =
        error instanceof Error && error.name === 'NotAllowedError'
          ? 'Доступ к микрофону запрещён — разрешите его в настройках браузера'
          : error instanceof Error
            ? error.message
            : 'Не удалось включить микрофон'
      this.patch({ status: 'error', error: message })
      return
    }

    this.patch({ status: 'live' })
    const sb = client()
    if (!sb) return

    try {
      const channel = sb.channel(`voice:${this.channelId}`, {
        config: { broadcast: { self: false }, presence: { key: this.me.id } },
      })
      channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
        void this.handleSignal(payload as SignalPayload)
      })
      channel.on('presence', { event: 'sync' }, () => {
        this.syncPeers()
      })
      channel.on('presence', { event: 'leave' }, ({ key }) => {
        this.dropPeer(String(key))
      })
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({ id: this.me.id, name: this.me.name })
          this.broadcast({ to: '*', from: this.me.id, name: this.me.name, kind: 'hello' })
        }
      })
      this.channel = channel
      this.patch({ localOnly: false })
    } catch (error) {
      this.patch({
        localOnly: true,
        error: error instanceof Error ? error.message : 'Сигналинг недоступен',
      })
    }
  }

  private syncPeers() {
    if (!this.channel) return
    const state = this.channel.presenceState() as Record<string, Array<{ name?: string }>>
    const peers: VoicePeer[] = Object.entries(state)
      .filter(([id]) => id !== this.me.id)
      .map(([id, metas]) => ({ id, name: metas[0]?.name ?? 'УЧАСТНИК' }))
    this.patch({ peers })
  }

  private broadcast(payload: SignalPayload) {
    void this.channel?.send({ type: 'broadcast', event: 'signal', payload })
  }

  private async handleSignal(payload: SignalPayload) {
    if (!payload || payload.from === this.me.id) return
    const from = payload.from
    if (payload.kind === 'hello') {
      // новичок инициирует соединение с теми, кто уже в комнате
      if (!this.pcs.has(from)) await this.offer(from)
      return
    }
    if (payload.kind === 'bye') {
      this.dropPeer(from)
      return
    }
    const pc = this.pcs.get(from)
    if (!pc) return
    if (payload.kind === 'offer') {
      await pc.setRemoteDescription(payload.data as RTCSessionDescriptionInit)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      this.broadcast({ to: from, from: this.me.id, kind: 'answer', data: answer })
      return
    }
    if (payload.kind === 'answer') {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(payload.data as RTCSessionDescriptionInit)
      }
      return
    }
    if (payload.kind === 'ice') {
      try {
        await pc.addIceCandidate(payload.data as RTCIceCandidateInit)
      } catch {
        /* кандидат может прийти слишком рано */
      }
    }
  }

  private ensurePeer(peerId: string): RTCPeerConnection | null {
    const existing = this.pcs.get(peerId)
    if (existing) return existing
    if (!this.stream) return null
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })
    this.pcs.set(peerId, pc)
    for (const track of this.stream.getTracks()) pc.addTrack(track, this.stream)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.broadcast({ to: peerId, from: this.me.id, kind: 'ice', data: event.candidate.toJSON() })
      }
    }
    pc.ontrack = (event) => {
      const [stream] = event.streams
      if (!stream) return
      let audio = this.remoteAudio.get(peerId)
      if (!audio) {
        audio = new Audio()
        audio.autoplay = true
        audio.setAttribute('playsinline', 'true')
        this.remoteAudio.set(peerId, audio)
      }
      audio.srcObject = stream
      void audio.play().catch(() => {
        /* автоплей может требовать жеста — повторяем при клике в интерфейсе */
      })
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.dropPeer(peerId)
    }
    return pc
  }

  private async offer(peerId: string) {
    const pc = this.ensurePeer(peerId)
    if (!pc) return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    this.broadcast({ to: peerId, from: this.me.id, name: this.me.name, kind: 'offer', data: offer })
  }

  private dropPeer(peerId: string) {
    const pc = this.pcs.get(peerId)
    if (pc) {
      pc.onicecandidate = null
      pc.ontrack = null
      pc.close()
      this.pcs.delete(peerId)
    }
    const audio = this.remoteAudio.get(peerId)
    if (audio) {
      audio.srcObject = null
      audio.remove()
      this.remoteAudio.delete(peerId)
    }
    if (this.state.peers.some((p) => p.id === peerId)) {
      this.patch({ peers: this.state.peers.filter((p) => p.id !== peerId) })
    }
  }

  setMuted(next: boolean) {
    this.muted = next
    this.applyMute()
    this.patch({ muted: next })
  }

  toggleMute() {
    this.setMuted(!this.muted)
  }

  private applyMute() {
    for (const track of this.stream?.getAudioTracks() ?? []) track.enabled = !this.muted
  }

  /** Вывести звук снова (если браузер заблокировал автоплей). */
  resumePlayback() {
    for (const audio of this.remoteAudio.values()) void audio.play().catch(() => undefined)
  }

  leave() {
    this.broadcast({ to: '*', from: this.me.id, kind: 'bye' })
    for (const peerId of Array.from(this.pcs.keys())) this.dropPeer(peerId)
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null
    cancelAnimationFrame(this.raf)
    this.raf = 0
    void this.audioContext?.close().catch(() => undefined)
    this.audioContext = null
    this.analyser = null
    if (this.channel) {
      void this.channel.untrack()
      void client()?.removeChannel(this.channel)
      this.channel = null
    }
    this.patch({ status: 'idle', level: 0, peers: [], error: null, muted: false })
  }
}
