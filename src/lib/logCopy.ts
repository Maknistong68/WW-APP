// The technical log as Settings shows it and as the Copy log button copies it.

export interface LogLine {
  time: string
  event: string
  detail: string
}

/** The database log plus the localStorage copy, newest first, each line once. */
export function mergeLogs<T extends LogLine>(dbLogs: T[] | undefined, local: LogLine[]): LogLine[] {
  const seen = new Set<string>()
  const out: LogLine[] = []
  for (const l of [...(dbLogs ?? []), ...local]) {
    const key = `${l.time}|${l.event}|${l.detail}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ time: l.time, event: l.event, detail: l.detail })
  }
  return out.sort((x, y) => y.time.localeCompare(x.time))
}

/** Plain text to paste into a message: a version line, then one line per entry. */
export function logText(header: string, lines: LogLine[]): string {
  return [header, ...lines.map((l) => `${l.time}  ${l.event}${l.detail ? ` — ${l.detail}` : ''}`)].join('\n')
}
