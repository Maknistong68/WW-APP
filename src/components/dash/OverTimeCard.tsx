import Chips from './Chips'
import TrendLine from '../charts/TrendLine'
import { kpiStatus } from '../../lib/kpi'
import { sar, sarShort } from '../../lib/money'
import { kpiTone } from '../../lib/tone'
import type { OverTimeChip, OverTimeSeries } from '../../lib/overTime'

/**
 * The Dashboard's Over time: chips pick the series; one line chart with the
 * callout that opens a month's tickets or shows that month.
 */
export default function OverTimeCard({
  chips,
  chip,
  onChip,
  series,
  onOpen,
}: {
  chips: OverTimeChip[]
  chip: string
  onChip: (key: string) => void
  series: OverTimeSeries
  /** A tapped month (YYYY-MM) and what to open there. */
  onOpen: (month: string, open: NonNullable<OverTimeSeries['open']>) => void
}) {
  const open = series.open
  return (
    <div className="chart-card">
      <Chips chips={chips} value={chip} onChange={onChip} label="Over time" />
      <div className="chart-sub">{series.sub}</div>
      <TrendLine
        key={chip}
        data={series.data}
        unit={series.sar ? '' : series.unit}
        mode={series.mode}
        max={series.max}
        guides={series.guides}
        toneOf={series.status ? (v) => kpiTone(kpiStatus(v)) : undefined}
        format={series.sar ? sar : undefined}
        axisFormat={series.sar ? sarShort : undefined}
        onOpen={open && series.mode === 'month' ? (i) => onOpen(series.data[i].date.slice(0, 7), open) : undefined}
        openLabel={open === 'month' ? 'Show month' : 'Open'}
      />
    </div>
  )
}
