import type { ReactNode } from 'react'

/** The green header button of a sheet. Stays put while saving (no second tap). */
export default function SaveButton({ saving, onClick, children }: { saving: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className="nav-btn strong" disabled={saving} aria-busy={saving} onClick={onClick}>
      {children}
    </button>
  )
}
