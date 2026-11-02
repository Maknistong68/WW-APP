import { useNavigate } from 'react-router-dom'
import Icon from './Icon'
import StatusChip from './StatusChip'
import type { AuditItem } from '../lib/audits'
import { STATUS_LABEL, kpiStatus } from '../lib/kpi'
import { kpiTone } from '../lib/tone'

/**
 * Audits, newest first: quarterly scores open their month, inspections open
 * themselves. The chip is the score with its status icon (the word is read out),
 * so the title keeps its room. `flush` sits the rows inside another card.
 */
export default function AuditList({ items, flush }: { items: AuditItem[]; flush?: boolean }) {
  const navigate = useNavigate()
  return (
    <div className={`list${flush ? ' flush' : ''}`}>
      {items.map((a) => {
        const st = kpiStatus(a.pct)
        return (
          <button key={a.key} className="row" onClick={() => navigate(a.to)}>
            <span className="row-main">
              <div className="row-title">{a.title}</div>
              <div className="row-sub">{a.detail}</div>
            </span>
            <StatusChip tone={kpiTone(st)}>
              {a.pct === null ? (
                'Not scored'
              ) : (
                <>
                  {a.pct}%<span className="sr-only">, {STATUS_LABEL[st]}</span>
                </>
              )}
            </StatusChip>
            <span className="row-chev">
              <Icon name={a.kind === 'inspection' ? 'clipboard' : 'chevron-right'} size={18} />
            </span>
          </button>
        )
      })}
    </div>
  )
}
