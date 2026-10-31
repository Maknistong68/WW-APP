import type { ReactNode } from 'react'

/** A rounded card holding rows with hairlines between them, with an optional heading. */
export default function CardList({ title, count, children }: { title?: ReactNode; count?: number; children: ReactNode }) {
  return (
    <section className="clist">
      {title && (
        <h2 className="clist-head">
          {title}
          {count !== undefined && <span className="clist-count">{count}</span>}
        </h2>
      )}
      <div className="clist-body">{children}</div>
    </section>
  )
}
