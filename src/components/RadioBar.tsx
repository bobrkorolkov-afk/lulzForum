import { useRouter } from '../lib/router'
import { useRadio } from '../lib/radio'
import { Icon } from './Icon'

/** Компактная полоса эфира — видна на всех страницах, кроме самой радиостудии. */
export function RadioBar() {
  const radio = useRadio()
  const { route, navigate } = useRouter()
  if (!radio.playing || route.path.startsWith('/radio')) return null

  return (
    <div className="radio-bar">
      <button className="radio-bar__main" onClick={() => navigate('/radio')} title="Открыть BITMAP FM">
        <span className="radio-bar__dot" />
        <span className="radio-bar__text">
          <b>{radio.station?.name ?? 'BITMAP FM'}</b>
          <span>{radio.trackTitle || 'эфир'}</span>
        </span>
      </button>
      <div className="radio-bar__controls">
        <button className="btn btn--icon" onClick={radio.toggle} title={radio.playing ? 'Пауза' : 'В эфир'}>
          <Icon name={radio.playing ? 'pause' : 'play'} size={14} />
        </button>
        <button className="btn btn--icon" onClick={radio.nextTrack} title="Другой трек">
          <Icon name="refresh" size={13} />
        </button>
        <button className="btn btn--icon" onClick={radio.stop} title="Выключить радио">
          <Icon name="close" size={12} />
        </button>
      </div>
    </div>
  )
}
