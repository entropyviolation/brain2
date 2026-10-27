/**
 * components/ItemDetail/tabs/links/LinkMatrix.tsx — Matrix view (L6.1). Rows and
 * columns are the item and its neighbours; a filled cell is a link, hued by
 * family; an outlined empty cell is an open triad.
 */
"use client"

import { egoMatrix } from "@/lib/graph/ego-matrix"
import type { LinkIndex } from "@/lib/graph/link-index"
import { relationLabel } from "@/lib/links"

export function LinkMatrix({ itemId, links, title }: { itemId: string; links: LinkIndex; title: (id: string) => string }) {
  const m = egoMatrix(itemId, links)
  if (m.ids.length < 2) return <p className="rl-empty">No links yet.</p>
  return (
    <div className="rl-matrix-wrap" data-testid="link-matrix">
      <table className="rl-matrix">
        <thead>
          <tr>
            <th />
            {m.ids.map((id) => (
              <th key={id} scope="col" title={title(id)}>
                <span>{title(id)}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {m.ids.map((r, i) => (
            <tr key={r}>
              <th scope="row">{title(r)}</th>
              {m.cells[i].map((c, j) => (
                <td
                  key={j}
                  className={c.family ? `is-link rl-hue-${c.family}` : c.open ? "is-open" : undefined}
                  title={c.relation ? `${title(r)} ${relationLabel(c.relation)} ${title(m.ids[j])}` : c.open ? "Open triad" : undefined}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
