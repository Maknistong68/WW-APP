import { useId, type ReactNode } from 'react'

// Tab bar icons drawn in Samsung One UI's style: simple rounded shapes with
// 1.8px strokes and round joins. Each has an outline and a filled version;
// the selected tab cross-fades to the filled one (details like the door or
// the chart bars are cut out of it with a mask).

export type TabIconName = 'home' | 'tickets' | 'dashboard' | 'library'

interface Shape {
  /** Drawn as 1.8px lines when not selected. */
  outline: ReactNode
  /** Filled (and stroked, so it is the same size as the outline) when selected. */
  solid: ReactNode
  /** Black shapes cut out of the filled version. */
  cut?: ReactNode
}

const HOUSE = 'M4.5 10.4 L10.9 4.9 A1.7 1.7 0 0 1 13.1 4.9 L19.5 10.4 V18.5 A2 2 0 0 1 17.5 20.5 H6.5 A2 2 0 0 1 4.5 18.5 Z'
const TICKET =
  'M5.5 6.5 H18.5 A2 2 0 0 1 20.5 8.5 V10.2 A1.8 1.8 0 0 0 20.5 13.8 V15.5 A2 2 0 0 1 18.5 17.5 H5.5 A2 2 0 0 1 3.5 15.5 V13.8 A1.8 1.8 0 0 0 3.5 10.2 V8.5 A2 2 0 0 1 5.5 6.5 Z'
const PERFORATION = 'M14.5 9 v1 M14.5 11.5 v1 M14.5 14 v1'
const PANEL = 'M6 4 H18 A2 2 0 0 1 20 6 V18 A2 2 0 0 1 18 20 H6 A2 2 0 0 1 4 18 V6 A2 2 0 0 1 6 4 Z'
const BARS = 'M8.5 16.5 V13.5 M12 16.5 V8 M15.5 16.5 V11'
const GRID = [
  [4, 4],
  [13.4, 4],
  [4, 13.4],
  [13.4, 13.4],
]

const SHAPES: Record<TabIconName, Shape> = {
  home: {
    outline: (
      <>
        <path d={HOUSE} />
        <path d="M9.8 20.5 V16.1 A2.2 2.2 0 0 1 14.2 16.1 V20.5" />
      </>
    ),
    solid: <path d={HOUSE} />,
    cut: <path d="M10.1 23 V16.3 A1.9 1.9 0 0 1 13.9 16.3 V23 Z" fill="black" />,
  },
  tickets: {
    outline: (
      <>
        <path d={TICKET} />
        <path d={PERFORATION} />
      </>
    ),
    solid: <path d={TICKET} />,
    cut: <path d={PERFORATION} stroke="black" strokeWidth={1.7} strokeLinecap="round" fill="none" />,
  },
  dashboard: {
    outline: (
      <>
        <path d={PANEL} />
        <path d={BARS} />
      </>
    ),
    solid: <path d={PANEL} />,
    cut: <path d={BARS} stroke="black" strokeWidth={1.9} strokeLinecap="round" fill="none" />,
  },
  library: {
    outline: (
      <>
        {GRID.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={6.6} height={6.6} rx={1.9} />
        ))}
      </>
    ),
    solid: (
      <>
        {GRID.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={6.6} height={6.6} rx={1.9} />
        ))}
      </>
    ),
  },
}

export default function TabIcon({ name, on }: { name: TabIconName; on: boolean }) {
  const id = `ti${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const s = SHAPES[name]
  return (
    <svg className={`tab-svg${on ? ' on' : ''}`} width={24} height={24} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {s.cut && (
        <mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={24} height={24}>
          <rect width={24} height={24} fill="white" />
          {s.cut}
        </mask>
      )}
      <g className="ti-line" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {s.outline}
      </g>
      <g
        className="ti-solid"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinejoin="round"
        mask={s.cut ? `url(#${id})` : undefined}
      >
        {s.solid}
      </g>
    </svg>
  )
}
