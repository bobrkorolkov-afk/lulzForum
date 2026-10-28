/* ---------------------------------------------------------------------------
 * BITMAP FM — нейро-радио LulzForum.
 *
 * Никаких внешних файлов и стримов: музыка синтезируется прямо в браузере
 * через Web Audio. У каждой станции свой «вайб» — лад, темп, набор тембров и
 * характер барабанов, а последовательность аккордов и мелодий выбирает
 * генеративная модель: марковская цепь по ступеням + seeded-случайность.
 * Из-за этого эфир никогда не повторяется, но станция всегда узнаваема.
 *
 * Станцию можно выбрать готовую или собрать по описанию вайба — текст
 * превращается в детерминированный набор параметров, так что «ночной дождь»
 * всегда звучит одинаково мрачно, а «пиксель-диско» — одинаково весело.
 * ------------------------------------------------------------------------- */

export type Mood = 'night' | 'disco' | 'industrial' | 'calm' | 'dawn' | 'space' | 'empty' | 'glitch'

export interface Station {
  id: string
  name: string
  vibe: string
  tags: string[]
  mood: Mood
  bpm: number
  /** Корень в MIDI-нотах. */
  root: number
  /** Лад: полутоны от корня. */
  scale: number[]
  seed: number
  density: number
  bass: boolean
  drums: boolean
  texture: 'rain' | 'vinyl' | 'wind' | 'none' | 'static'
  /** Пользовательская станция, собранная по описанию. */
  custom?: boolean
}

export interface RadioState {
  station: Station | null
  playing: boolean
  loading: boolean
  volume: number
  trackTitle: string
  trackIndex: number
  listeners: number
  error: string | null
}

/* --------------------------------------------------------------- утилиты */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  penta: [0, 3, 5, 7, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
}

const midiToFreq = (note: number) => 440 * Math.pow(2, (note - 69) / 12)

/* ------------------------------------------------------------- станции */

export const STATIONS: Station[] = [
  {
    id: 'night',
    name: 'НОЧНОЙ ЭФИР',
    vibe: 'Медленный дождь за окном, тёплые пэды, никуда не спешим.',
    tags: ['ночь', 'дождь', 'спокойно', 'фон'],
    mood: 'night',
    bpm: 76,
    root: 45,
    scale: SCALES.aeolian,
    seed: 1041,
    density: 0.45,
    bass: true,
    drums: true,
    texture: 'rain',
  },
  {
    id: 'disco',
    name: 'ПИКСЕЛЬ-ДИСКО',
    vibe: 'Четыре удара в пол, арпеджио и полное отсутствие стеснения.',
    tags: ['диско', 'танцы', 'весело', 'энергия'],
    mood: 'disco',
    bpm: 124,
    root: 48,
    scale: SCALES.major,
    seed: 7731,
    density: 0.85,
    bass: true,
    drums: true,
    texture: 'none',
  },
  {
    id: 'bitmap',
    name: 'БИТМАП-ЦЕХ',
    vibe: 'Железо, холодный цех и ритм, который не спрашивает разрешения.',
    tags: ['индастриал', 'жёстко', 'работа', 'ритм'],
    mood: 'industrial',
    bpm: 102,
    root: 43,
    scale: SCALES.phrygian,
    seed: 3312,
    density: 0.7,
    bass: true,
    drums: true,
    texture: 'static',
  },
  {
    id: 'terminal',
    name: 'ТИХИЙ ТЕРМИНАЛ',
    vibe: 'Пустой зал ожидания, мягкие клавиши и шум ленты.',
    tags: ['спокойно', 'фон', 'работа', 'утро'],
    mood: 'calm',
    bpm: 70,
    root: 50,
    scale: SCALES.dorian,
    seed: 9042,
    density: 0.35,
    bass: true,
    drums: false,
    texture: 'vinyl',
  },
  {
    id: 'dawn',
    name: 'РАССВЕТ 8-БИТ',
    vibe: 'Чиптюн-мелодия, как в старых титрах: наивно и очень тепло.',
    tags: ['утро', 'лёгкость', 'чиптюн', 'светло'],
    mood: 'dawn',
    bpm: 96,
    root: 52,
    scale: SCALES.major,
    seed: 2205,
    density: 0.65,
    bass: true,
    drums: true,
    texture: 'none',
  },
  {
    id: 'orbit',
    name: 'ОРБИТА',
    vibe: 'Долгие пэды, эхо и ощущение, что Earth далеко внизу.',
    tags: ['космос', 'фон', 'медитация', 'ночь'],
    mood: 'space',
    bpm: 82,
    root: 41,
    scale: SCALES.lydian,
    seed: 6614,
    density: 0.4,
    bass: true,
    drums: false,
    texture: 'wind',
  },
  {
    id: 'empty',
    name: 'ПУСТОЙ ЭТАЖ',
    vibe: 'Дрон, шаги и гул вентиляции. Тревожно, но завораживающе.',
    tags: ['тревога', 'мрачно', 'дрон', 'ночь'],
    mood: 'empty',
    bpm: 64,
    root: 38,
    scale: SCALES.minor,
    seed: 5150,
    density: 0.3,
    bass: true,
    drums: false,
    texture: 'wind',
  },
  {
    id: 'glitch',
    name: 'СИГНАЛ ПОТЕРЯН',
    vibe: 'Битые сэмплы, шум и ритм, который рассыпается на куски.',
    tags: ['глитч', 'жёстко', 'эксперимент', 'энергия'],
    mood: 'glitch',
    bpm: 112,
    root: 46,
    scale: SCALES.penta,
    seed: 8801,
    density: 0.75,
    bass: true,
    drums: true,
    texture: 'static',
  },
]

const VIBE_CHIPS = [
  'ночь',
  'дождь',
  'диско',
  'космос',
  'работа',
  'утро',
  'тревога',
  'лён',
  'железо',
  'медитация',
]

export { VIBE_CHIPS }

/* --------------------------------------------------- генерация по вайбу */

const ADJECTIVES = ['ПОЛУНОЧНЫЙ', 'ЦИФРОВОЙ', 'МОКРЫЙ', 'НЕОНОВЫЙ', 'РЖАВЫЙ', 'ТИХИЙ', 'ПУСТОЙ', 'ЯРКИЙ', 'ХОЛОДНЫЙ', 'ТЁПЛЫЙ']
const NOUNS = ['ЭФИР', 'СЕКТОР', 'ТЕРМИНАЛ', 'ПОТОК', 'ОКРУГ', 'РЕЖИМ', 'СИГНАЛ', 'КАНАЛ', 'ПОРТ', 'ЭТАЖ']

const MOOD_WORDS: Array<{ mood: Mood; words: string[]; scale: number[]; bpm: number[]; texture: Station['texture']; drums: boolean }> = [
  {
    mood: 'night',
    words: ['ночь', 'ночной', 'дождь', 'дождь', '2am', 'сон', 'темно', 'грусть', 'мрак', 'луна'],
    scale: SCALES.aeolian,
    bpm: [68, 84],
    texture: 'rain',
    drums: true,
  },
  {
    mood: 'disco',
    words: ['диско', 'танц', 'вечеринк', 'весел', 'пляс', 'фанк', 'хит', 'праздник', 'энерг'],
    scale: SCALES.major,
    bpm: [118, 132],
    texture: 'none',
    drums: true,
  },
  {
    mood: 'industrial',
    words: ['железо', 'индастр', 'завод', 'цех', 'жёстк', 'жестк', 'механ', 'бетон', 'работа', 'фокус'],
    scale: SCALES.phrygian,
    bpm: [96, 116],
    texture: 'static',
    drums: true,
  },
  {
    mood: 'calm',
    words: ['спокой', 'тих', 'лён', 'лен', 'мягк', 'утро', 'чай', 'кот', 'лёгк', 'легк', 'уют'],
    scale: SCALES.dorian,
    bpm: [64, 80],
    texture: 'vinyl',
    drums: false,
  },
  {
    mood: 'space',
    words: ['космос', 'орбит', 'звезд', 'звёзд', 'невесом', 'медитац', 'далёк', 'далек', 'планет', 'эмбиент'],
    scale: SCALES.lydian,
    bpm: [72, 88],
    texture: 'wind',
    drums: false,
  },
  {
    mood: 'empty',
    words: ['тревог', 'страх', 'пусто', 'одинок', 'дрон', 'туман', 'холод', 'странн'],
    scale: SCALES.minor,
    bpm: [58, 74],
    texture: 'wind',
    drums: false,
  },
  {
    mood: 'glitch',
    words: ['глитч', 'бит', 'шум', 'сбой', 'ошибк', 'хак', 'эксперимент', 'ломай'],
    scale: SCALES.penta,
    bpm: [104, 124],
    texture: 'static',
    drums: true,
  },
]

/** Превращает свободное описание в станцию: детерминированно и без сети. */
export function stationFromVibe(text: string): Station {
  const clean = text.trim().slice(0, 60)
  const seed = hashString(clean.toLowerCase() || 'bitmap fm')
  const rnd = mulberry32(seed)
  const lower = clean.toLowerCase()
  const matched = MOOD_WORDS.find((entry) => entry.words.some((word) => lower.includes(word))) ?? MOOD_WORDS[Math.floor(rnd() * MOOD_WORDS.length)]
  const [bpmMin, bpmMax] = matched.bpm
  const bpm = Math.round(bpmMin + rnd() * (bpmMax - bpmMin))
  const root = 38 + Math.floor(rnd() * 12)
  const name = clean
    ? `${ADJECTIVES[Math.floor(rnd() * ADJECTIVES.length)]} ${NOUNS[Math.floor(rnd() * NOUNS.length)]}`
    : 'СЛУЧАЙНЫЙ ЭФИР'

  return {
    id: `custom:${seed.toString(36)}`,
    name,
    vibe: clean ? `Станция по вайбу «${clean}» — собрана нейросетью LulzForum.` : 'Станция, собранная случайным образом.',
    tags: clean ? clean.split(/[\s,]+/).filter(Boolean).slice(0, 4) : ['случайно'],
    mood: matched.mood,
    bpm,
    root,
    scale: matched.scale,
    seed,
    density: 0.35 + rnd() * 0.5,
    bass: true,
    drums: matched.drums,
    texture: matched.texture,
    custom: true,
  }
}

/* --------------------------------------------------------- названия треков */

const TRACK_WORDS: Record<Mood, { a: string[]; b: string[] }> = {
  night: { a: ['МОКРЫЙ', 'ПОЛУНОЧНЫЙ', 'ТИХИЙ', 'СЕРЫЙ'], b: ['АСФАЛЬТ', 'ЭФИР', 'ДОЖДЬ', 'ФОНАРЬ'] },
  disco: { a: ['НЕОНОВЫЙ', 'ЛИПКИЙ', 'ЯРКИЙ', 'ПЛАСТИКОВЫЙ'], b: ['ПОЛ', 'РИТМ', 'КЛУБ', 'ГЛИТТЕР'] },
  industrial: { a: ['РЖАВЫЙ', 'ХОЛОДНЫЙ', 'ТЯЖЁЛЫЙ', 'МЕТАЛЛИЧЕСКИЙ'], b: ['ЦЕХ', 'ПРЕСС', 'КОНВЕЙЕР', 'ГУЛ'] },
  calm: { a: ['ТЁПЛЫЙ', 'МЯГКИЙ', 'ПУСТОЙ', 'УТРЕННИЙ'], b: ['ТЕРМИНАЛ', 'ЗАЛ', 'ЧАЙ', 'СВЕТ'] },
  dawn: { a: ['РАННИЙ', 'СВЕТЛЫЙ', 'НАИВНЫЙ', 'ЖЁЛТЫЙ'], b: ['РАССВЕТ', 'ТИТРЫ', 'ДВОР', 'ЛУЧ'] },
  space: { a: ['ДАЛЁКИЙ', 'НЕВЕСОМЫЙ', 'ХОЛОДНЫЙ', 'ЗВЁЗДНЫЙ'], b: ['ОРБИТА', 'СЕКТОР', 'ДРЕЙФ', 'ВАКУУМ'] },
  empty: { a: ['ПУСТОЙ', 'ГУЛКИЙ', 'СТРАННЫЙ', 'НОЧНОЙ'], b: ['ЭТАЖ', 'КОРИДОР', 'ВЕНТИЛЯЦИЯ', 'ТЕНЬ'] },
  glitch: { a: ['БИТЫЙ', 'СБИТЫЙ', 'ШУМНЫЙ', 'СЛОМАННЫЙ'], b: ['СИГНАЛ', 'ПАКЕТ', 'БУФЕР', 'ПОМЕХА'] },
}

function trackTitle(station: Station, index: number): string {
  const words = TRACK_WORDS[station.mood]
  const rnd = mulberry32(station.seed + index * 977)
  const a = words.a[Math.floor(rnd() * words.a.length)]
  const b = words.b[Math.floor(rnd() * words.b.length)]
  return `${a} ${b} · ${String(index + 1).padStart(3, '0')}`
}

const DJ_LINES = [
  'не переключайтесь, это BITMAP FM',
  'нейросеть собрала следующий трек из вашего вайба',
  '1 бит на канал — больше и не нужно',
  'эфир без рекламы, только шум и ритм',
  'если кажется, что это повтор — это не повтор',
  'сигнал идёт прямо из браузера, без сервера',
]

/* ------------------------------------------------------------- движок */

type Ctx = AudioContext

export class BitmapFmEngine {
  private ctx: Ctx | null = null
  private master: GainNode | null = null
  private analyserNode: AnalyserNode | null = null
  private textureGain: GainNode | null = null
  private textureSource: AudioBufferSourceNode | null = null
  private delay: DelayNode | null = null
  private timer: number | null = null
  private step = 0
  private nextTime = 0
  private station: Station | null = null
  private rnd: () => number = Math.random
  private chordDegree = 0
  private barInTrack = 0
  private trackLength = 32
  private volume = 0.7
  private onTrack: ((title: string, index: number) => void) | null = null
  private onDj: ((line: string) => void) | null = null

  get context(): Ctx | null {
    return this.ctx
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyserNode
  }

  private ensureContext(): Ctx {
    if (this.ctx) return this.ctx
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) throw new Error('Браузер не поддерживает Web Audio')
    const ctx = new Ctor()
    const master = ctx.createGain()
    master.gain.value = this.volume
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -10
    limiter.knee.value = 6
    limiter.ratio.value = 8
    limiter.attack.value = 0.003
    limiter.release.value = 0.25
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.75

    master.connect(limiter)
    limiter.connect(analyser)
    analyser.connect(ctx.destination)

    const delay = ctx.createDelay(1.5)
    delay.delayTime.value = 0.36
    const feedback = ctx.createGain()
    feedback.gain.value = 0.28
    const wet = ctx.createGain()
    wet.gain.value = 0.25
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wet)
    wet.connect(master)

    this.ctx = ctx
    this.master = master
    this.analyserNode = analyser
    this.delay = delay
    return ctx
  }

  /* --------------------------------------------------- инструменты */

  private env(time: number, dur: number, peak: number, attack = 0.01, release = 0.2): GainNode {
    const ctx = this.ensureContext()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, time)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + dur + release)
    return gain
  }

  private kick(time: number, vel = 1) {
    const ctx = this.ensureContext()
    const osc = ctx.createOscillator()
    const gain = this.env(time, 0.16, 0.9 * vel, 0.002, 0.05)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140, time)
    osc.frequency.exponentialRampToValueAtTime(46, time + 0.14)
    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(time)
    osc.stop(time + 0.3)
  }

  private noiseBuffer(dur = 1): AudioBuffer {
    const ctx = this.ensureContext()
    const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    return buffer
  }

  private snare(time: number, vel = 1) {
    const ctx = this.ensureContext()
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(0.3)
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 1800
    band.Q.value = 0.9
    const gain = this.env(time, 0.12, 0.32 * vel, 0.002, 0.08)
    src.connect(band)
    band.connect(gain)
    gain.connect(this.master!)
    src.start(time)
    src.stop(time + 0.25)
  }

  private hat(time: number, vel = 1, open = false) {
    const ctx = this.ensureContext()
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(open ? 0.4 : 0.1)
    const high = ctx.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 7200
    const gain = this.env(time, open ? 0.18 : 0.04, 0.16 * vel, 0.001, 0.03)
    src.connect(high)
    high.connect(gain)
    gain.connect(this.master!)
    src.start(time)
    src.stop(time + (open ? 0.5 : 0.12))
  }

  private bassNote(time: number, freq: number, dur: number, vel = 1) {
    const ctx = this.ensureContext()
    const osc = ctx.createOscillator()
    const filter = ctx.createBiquadFilter()
    const gain = this.env(time, dur, 0.34 * vel, 0.01, 0.08)
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(560, time)
    filter.frequency.exponentialRampToValueAtTime(180, time + dur)
    filter.Q.value = 6
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.master!)
    osc.start(time)
    osc.stop(time + dur + 0.2)
  }

  private pad(time: number, freqs: number[], dur: number, vel = 1) {
    const ctx = this.ensureContext()
    const gain = this.env(time, dur, 0.1 * vel, 0.6, 0.9)
    gain.connect(this.master!)
    for (const freq of freqs) {
      for (const detune of [-6, 6]) {
        const osc = ctx.createOscillator()
        osc.type = 'triangle'
        osc.frequency.value = freq
        osc.detune.value = detune
        const filter = ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 1400
        osc.connect(filter)
        filter.connect(gain)
        osc.start(time)
        osc.stop(time + dur + 1.4)
      }
    }
  }

  private arp(time: number, freq: number, vel = 1) {
    const ctx = this.ensureContext()
    const osc = ctx.createOscillator()
    const gain = this.env(time, 0.1, 0.12 * vel, 0.004, 0.1)
    osc.type = 'square'
    osc.frequency.value = freq
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 2400
    osc.connect(filter)
    filter.connect(gain)
    gain.connect(this.master!)
    if (this.delay) gain.connect(this.delay)
    osc.start(time)
    osc.stop(time + 0.3)
  }

  private blip(time: number, freq: number, vel = 1) {
    const ctx = this.ensureContext()
    const osc = ctx.createOscillator()
    osc.type = 'square'
    osc.frequency.setValueAtTime(freq, time)
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, time + 0.06)
    const gain = this.env(time, 0.06, 0.1 * vel, 0.002, 0.05)
    osc.connect(gain)
    gain.connect(this.master!)
    osc.start(time)
    osc.stop(time + 0.2)
  }

  /* --------------------------------------------------- текстура */

  private startTexture(kind: Station['texture']) {
    this.stopTexture()
    if (kind === 'none' || !this.ctx || !this.master) return
    const ctx = this.ctx
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(4)
    src.loop = true
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()

    if (kind === 'rain') {
      filter.type = 'bandpass'
      filter.frequency.value = 4200
      filter.Q.value = 0.5
      gain.gain.value = 0.05
      lfo.frequency.value = 0.12
      lfoGain.gain.value = 900
    } else if (kind === 'vinyl') {
      filter.type = 'highpass'
      filter.frequency.value = 2400
      gain.gain.value = 0.022
      lfo.frequency.value = 0.07
      lfoGain.gain.value = 400
    } else if (kind === 'wind') {
      filter.type = 'lowpass'
      filter.frequency.value = 620
      filter.Q.value = 1.2
      gain.gain.value = 0.09
      lfo.frequency.value = 0.05
      lfoGain.gain.value = 260
    } else {
      filter.type = 'highpass'
      filter.frequency.value = 3400
      gain.gain.value = 0.028
      lfo.frequency.value = 1.7
      lfoGain.gain.value = 1200
    }

    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start()
    lfo.start()
    this.textureSource = src
    this.textureGain = gain
    // LFO держим живым через ссылку в источнике
    ;(src as unknown as { __lfo?: OscillatorNode }).__lfo = lfo
  }

  private stopTexture() {
    if (this.textureSource) {
      try {
        this.textureSource.stop()
      } catch {
        /* уже остановлен */
      }
      const lfo = (this.textureSource as unknown as { __lfo?: OscillatorNode }).__lfo
      try {
        lfo?.stop()
      } catch {
        /* ignore */
      }
      this.textureSource.disconnect()
      this.textureSource = null
    }
    if (this.textureGain) {
      this.textureGain.disconnect()
      this.textureGain = null
    }
  }

  /* --------------------------------------------------- секвенсор */

  start(station: Station, handlers: { onTrack?: (t: string, i: number) => void; onDj?: (line: string) => void } = {}) {
    const ctx = this.ensureContext()
    if (ctx.state === 'suspended') void ctx.resume()
    this.stop()
    this.station = station
    this.rnd = mulberry32(station.seed)
    this.step = 0
    this.barInTrack = 0
    this.trackLength = 16 + Math.floor(this.rnd() * 24)
    this.nextTime = ctx.currentTime + 0.12
    this.onTrack = handlers.onTrack ?? null
    this.onDj = handlers.onDj ?? null
    this.chordDegree = Math.floor(this.rnd() * station.scale.length)
    this.startTexture(station.texture)
    this.onTrack?.(trackTitle(station, 0), 0)
    this.onDj?.(DJ_LINES[Math.floor(this.rnd() * DJ_LINES.length)])

    this.timer = window.setInterval(() => this.tick(), 25)
  }

  private tick() {
    const ctx = this.ctx
    const station = this.station
    if (!ctx || !station || !this.master) return
    const stepDur = 60 / station.bpm / 4
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.scheduleStep(this.step, this.nextTime, station)
      this.nextTime += stepDur
      this.step += 1
    }
  }

  private degreeNote(degree: number, octave = 0): number {
    const station = this.station!
    const scale = station.scale
    const idx = ((degree % scale.length) + scale.length) % scale.length
    const oct = Math.floor(degree / scale.length) + octave
    return station.root + scale[idx] + oct * 12
  }

  private scheduleStep(step: number, time: number, station: Station) {
    const bar = Math.floor(step / 16)
    const inBar = step % 16
    const rnd = this.rnd
    const mood = station.mood

    if (inBar === 0) {
      // смена аккорда: марковская цепь по ступеням лада
      if (bar % 2 === 0) {
        const options = [0, 0, 3, 5, 1, 4]
        this.chordDegree = (this.chordDegree + options[Math.floor(rnd() * options.length)]) % station.scale.length
      }
      const chordTones = [this.chordDegree, this.chordDegree + 2, this.chordDegree + 4].map((d) =>
        midiToFreq(this.degreeNote(d, 1)),
      )
      const padDur = (60 / station.bpm) * 4 * (mood === 'space' || mood === 'empty' ? 2 : 1)
      this.pad(time, chordTones, padDur, mood === 'space' ? 1.2 : 0.8)

      if (mood === 'space' || mood === 'empty') {
        // редкие «капли» поверх дрона
        if (rnd() < 0.5) {
          this.blip(time + (60 / station.bpm) * 2, midiToFreq(this.degreeNote(this.chordDegree + 5, 3)), 0.5)
        }
      }
    }

    // барабаны
    if (station.drums) {
      const kickPattern =
        mood === 'disco'
          ? [0, 4, 8, 12]
          : mood === 'industrial'
            ? [0, 3, 8, 11]
            : mood === 'glitch'
              ? [0, 6, 10]
              : [0, 8]
      if (kickPattern.includes(inBar)) this.kick(time, mood === 'disco' ? 1 : 0.85)
      if (inBar === 4 || inBar === 12) this.snare(time, mood === 'glitch' ? 0.7 : 1)
      if (inBar % 2 === 0 && rnd() < 0.9) this.hat(time, inBar % 4 === 0 ? 1 : 0.6, inBar === 14 && rnd() < 0.4)
      if (mood === 'glitch' && rnd() < 0.12) this.blip(time, midiToFreq(this.degreeNote(Math.floor(rnd() * 7), 3)), 0.6)
    }

    // бас
    if (station.bass) {
      const bassSteps = mood === 'disco' ? [0, 3, 6, 8, 11, 14] : mood === 'industrial' ? [0, 6, 8, 14] : [0, 8]
      if (bassSteps.includes(inBar)) {
        const note = this.degreeNote(this.chordDegree + (inBar % 8 === 0 ? 0 : 4), -2)
        this.bassNote(time, midiToFreq(note), (60 / station.bpm) * (mood === 'disco' ? 0.35 : 0.8))
      }
    }

    // мелодия: плотность станции решает, как часто звучит арпеджио
    if (rnd() < station.density * (mood === 'dawn' || mood === 'disco' ? 0.55 : 0.32)) {
      const degree = this.chordDegree + [0, 2, 4, 7][Math.floor(rnd() * 4)]
      this.arp(time, midiToFreq(this.degreeNote(degree, mood === 'dawn' ? 2 : 1)), 0.9)
    }

    // границы «трека»: на каждом переходе меняется название и слегка характер
    if (inBar === 0) {
      this.barInTrack += 1
      if (this.barInTrack >= this.trackLength) {
        this.barInTrack = 0
        this.trackLength = 12 + Math.floor(rnd() * 24)
        const index = Math.floor(rnd() * 900)
        this.onTrack?.(trackTitle(station, index), index)
        if (rnd() < 0.35) this.onDj?.(DJ_LINES[Math.floor(rnd() * DJ_LINES.length)])
      }
    }
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value))
    if (this.master) this.master.gain.value = this.volume
  }

  /** Уровень сигнала 0..1 для пиксельного визуализатора. */
  level(): number {
    if (!this.analyserNode) return 0
    const data = new Uint8Array(this.analyserNode.frequencyBinCount)
    this.analyserNode.getByteFrequencyData(data)
    let sum = 0
    for (const v of data) sum += v
    return Math.min(1, sum / data.length / 128)
  }

  /** Спектр для столбиков визуализатора. */
  spectrum(bars: number): number[] {
    if (!this.analyserNode) return new Array(bars).fill(0)
    const data = new Uint8Array(this.analyserNode.frequencyBinCount)
    this.analyserNode.getByteFrequencyData(data)
    const out: number[] = []
    const chunk = Math.floor(data.length / bars) || 1
    for (let i = 0; i < bars; i++) {
      let sum = 0
      for (let j = 0; j < chunk; j++) sum += data[i * chunk + j] ?? 0
      out.push(Math.min(1, sum / chunk / 170))
    }
    return out
  }

  stop() {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.stopTexture()
    this.station = null
    const ctx = this.ctx
    if (ctx && ctx.state === 'running') void ctx.suspend()
  }

  dispose() {
    this.stop()
    void this.ctx?.close().catch(() => undefined)
    this.ctx = null
    this.master = null
    this.analyserNode = null
    this.delay = null
  }
}

export const bitmapFm = new BitmapFmEngine()
