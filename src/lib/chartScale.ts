/** Axis top: the value rounded up to 1, 2 or 5 × a power of ten (at least 5). */
export function niceMax(v: number) {
  if (v <= 5) return 5
  const step = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / step
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * step
}

/** Runs of indexes with a value; a null (no data) breaks the line instead of dropping to 0. */
export function segments(values: (number | null)[]): number[][] {
  const out: number[][] = []
  let run: number[] = []
  values.forEach((v, i) => {
    if (v === null) {
      if (run.length) out.push(run)
      run = []
    } else run.push(i)
  })
  if (run.length) out.push(run)
  return out
}
