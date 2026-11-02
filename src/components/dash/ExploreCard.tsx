import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Chips from './Chips'
import CompareGrid from '../CompareGrid'
import Icon from '../Icon'
import RankBars from '../charts/RankBars'
import { TicketRow } from '../../pages/TicketsPage'
import { memberCounts } from '../../lib/groups'
import { sar } from '../../lib/money'
import { useLongPress } from '../../lib/useLongPress'
import type { DashView } from '../../lib/dashboard'
import { EXPLORE_CHIPS, type ExploreData, type ExploreHold, type ExploreItem } from '../../lib/explore'
import type { AllData } from '../../lib/kpiData'

const FORMAT: Record<ExploreData['format'], (v: number) => string> = {
  count: (v) => v.toLocaleString('en-US'),
  sar: (v) => sar(v),
  pct: (v) => `${Math.round(v)}%`,
}

/** A list row (button.row) that also opens a pop-up when held. */
function Row({ item, onOpen, onHold }: { item: ExploreItem; onOpen?: () => void; onHold?: () => void }) {
  const press = useLongPress(onHold)
  const inner: ReactNode = (
    <>
      <span className={`status-dot ${item.tone ?? 'none'}`} />
      <span className="row-main">
        <div className="row-title" style={item.key === 'overall' ? { fontWeight: 600 } : undefined}>
          {item.label}
          {item.tag && <span className="xrow-tag">{item.tag}</span>}
        </div>
        {item.detail && <div className="row-sub">{item.detail}</div>}
      </span>
      {item.text && <span className="row-trail">{item.text}</span>}
      <span className="row-chev">
        <Icon name="chevron-right" size={18} />
      </span>
    </>
  )
  return onOpen ? (
    <button type="button" className="row" onClick={onOpen} {...press}>
      {inner}
    </button>
  ) : (
    <div className="row" {...press}>
      {inner}
    </div>
  )
}

/**
 * The Dashboard's Explore: chips pick one breakdown; one picture at a time
 * (ranked bars, rows, ticket rows or the compare grid). Tap opens the list
 * behind an item, hold opens its pop-up.
 */
export default function ExploreCard({
  view,
  chip,
  onChip,
  data,
  d,
  onHold,
}: {
  view: DashView
  chip: string
  onChip: (key: string) => void
  data: ExploreData
  d: AllData
  onHold: (hold: ExploreHold) => void
}) {
  const navigate = useNavigate()
  const format = FORMAT[data.format]
  const groups = data.kind === 'tickets' ? memberCounts(d.tickets) : null
  const empty = data.kind === 'tickets' ? !data.tickets?.length : data.kind === 'grid' ? !data.grid?.rows.length : data.items.length === 0
  return (
    <div className="chart-card xcard">
      <Chips chips={EXPLORE_CHIPS[view]} value={chip} onChange={onChip} label="Explore" />
      <div className="chart-sub">{data.sub}</div>
      {empty ? (
        <div className="note">{data.empty}</div>
      ) : data.kind === 'bars' ? (
        <RankBars
          format={format}
          scale={data.scale}
          other={data.other}
          items={data.items.map((i) => ({
            key: i.key,
            label: i.label,
            value: i.value,
            text: i.text,
            detail: i.detail,
            tone: i.tone,
            tag: i.tag,
            onOpen: i.to ? () => navigate(i.to!) : undefined,
            onHold: i.hold ? () => onHold(i.hold!) : undefined,
          }))}
        />
      ) : data.kind === 'rows' ? (
        <div className="list xlist">
          {data.items.map((i) => (
            <Row key={i.key} item={i} onOpen={i.to ? () => navigate(i.to!) : undefined} onHold={i.hold ? () => onHold(i.hold!) : undefined} />
          ))}
        </div>
      ) : data.kind === 'tickets' ? (
        <div className="list xlist">
          {data.tickets!.map((t) => (
            <TicketRow key={t.uuid} t={t} contractors={d.byUuid} wos={d.woByUuid} group={groups?.get(t.uuid) ? `${(groups.get(t.uuid) ?? 0) + 1} tickets` : undefined} />
          ))}
        </div>
      ) : (
        <>
          <CompareGrid
            rows={data.grid!.rows}
            months={data.grid!.months}
            onOpenCell={(r, m) => navigate(`/contractors/${r.contractorUuid}?m=${m}`)}
            onOpenRow={(r) => navigate(`/contractors/${r.contractorUuid}?tab=trends`)}
            onHoldRow={(r) => onHold({ kind: 'contractor', uuid: r.contractorUuid })}
            label="Overall KPI, the 5 lowest contractors"
          />
          <button className="compare-link" onClick={() => navigate('/compare')}>
            Open full grid ›
          </button>
        </>
      )}
    </div>
  )
}
