import Icon from './Icon'
import CountUp from './CountUp'
import { useLongPress } from '../lib/useLongPress'
import { MENU_HUE } from '../lib/hues'
import { areaLine, areaStatus, type AreaDef, type AreaSummary } from '../lib/tasks'

/**
 * A Home card, kept plain: a line icon in the card's colour, the name, and one
 * status line with the most urgent count big ("3 late", "Next 15 Nov", "All
 * done"). Tap opens its list; hold for a quick look.
 */
export default function AreaCard({ a, s, onOpen, onMore }: { a: AreaDef; s: AreaSummary; onOpen: () => void; onMore: () => void }) {
  const press = useLongPress(onMore)
  const st = areaStatus(s)
  return (
    <button className="acard" aria-label={`${a.label}: ${areaLine(s).text}`} onClick={onOpen} {...press}>
      <Icon name={a.icon} size={22} className={`hicon h-${MENU_HUE[a.hue]}`} />
      <span className="acard-name">{a.label}</span>
      <span className={`acard-status ${st.tone}`}>
        {st.n !== null ? (
          <b>
            <CountUp value={st.n} />
          </b>
        ) : st.tone === 'good' ? (
          <Icon name="check" size={16} strokeWidth={3} />
        ) : null}
        <span>{st.word}</span>
      </span>
    </button>
  )
}
