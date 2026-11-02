import { scoreInspection, type InspectionScore } from './score'
import { getTemplate } from '../templates'
import type { Inspection } from '../types'

// An inspection's score, worked out once per inspection object. Charts and the
// comparison grid ask for the same audit scores many times (every month,
// every work order); the records are replaced on edit, so a WeakMap is safe.

const cache = new WeakMap<Inspection, InspectionScore | null>()

export function inspectionScore(ins: Inspection): InspectionScore | null {
  if (cache.has(ins)) return cache.get(ins)!
  const t = getTemplate(ins.templateId)
  const s = t ? scoreInspection(t, ins) : null
  cache.set(ins, s)
  return s
}

/** 0–100, or null when nothing scoreable is answered (or the template is unknown). */
export const inspectionPct = (ins: Inspection) => inspectionScore(ins)?.pct ?? null
