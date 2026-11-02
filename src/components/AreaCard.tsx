import Icon from './Icon'
import IconTile from './IconTile'
import CountUp from './CountUp'
import { useLongPress } from '../lib/useLongPress'
import { MENU_HUE } from '../lib/hues'
import { areaLine, areaTile, type AreaDef, type AreaSummary } from '../lib/tasks'

/**
 * A Home area as a One UI app icon: the tile in the area's colour with a badge
 * for what's urgent (red late, amber this week, green check when all done),
 * the name, and one line under it ("Late", "15 Nov", "Done"). Tap opens its
 * list; hold for a quick look.
 */
export default function AreaCard({ a, s, onOpen, onMore }: { a: AreaDef; s: AreaSummary; onOpen: () => void; onMore: () => void }) {
  const press = useLongPress(onMore)
  const st = areaTile(s)
  return (
    <button type="button" className="atile" aria-label={`${a.label}: ${areaLine(s).text}`} onClick={onOpen} {...press}>
      <span className="atile-icon">
        <IconTile icon={a.icon} hue={MENU_HUE[a.hue]} size={52} />
        {st.badge !== null ? (
          <span className={`atile-badge ${st.tone}`}>
            <CountUp value={st.badge} />
          </span>
        ) : st.tone === 'good' ? (
          <span className="atile-badge good">
            <Icon name="check" size={14} strokeWidth={3.2} />
          </span>
        ) : null}
      </span>
      <span className="atile-name">{a.label}</span>
      <span className={`atile-sub ${st.tone}`}>{st.sub}</span>
    </button>
  )
}
