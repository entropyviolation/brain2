/**
 * components/ItemDetail/links/SuggestionShelf.tsx — "Might be missing"
 * (LINKS_REDESIGN §7, L4.3). At most five rows: other item, relation, one
 * reason line. ✓ writes a draft link, ✕ stores the key on the item
 * (`dismissedLinkSuggestions`), Mute hides the source everywhere.
 */
"use client"

import { relationLabel } from "@/lib/links"
import type { Suggestion } from "@/lib/graph/densify"

export function SuggestionShelf({
  suggestions,
  title,
  editable,
  onAccept,
  onDismiss,
  onMute,
  onOpen,
}: {
  suggestions: readonly Suggestion[]
  title: (id: string) => string
  editable: boolean
  onAccept: (s: Suggestion) => void
  onDismiss: (s: Suggestion) => void
  onMute: (source: string) => void
  onOpen: (id: string) => void
}) {
  if (!suggestions.length) return null
  return (
    <section className="rl-shelf" aria-label="Might be missing" data-testid="link-shelf">
      <h4 className="rl-ledger-head">Might be missing</h4>
      <ul className="rl-ledger-list">
        {suggestions.map((s) => (
          <li key={s.key} className="rl-shelf-row" data-source={s.source}>
            <button type="button" className="rl-shelf-title" onClick={() => onOpen(s.otherId)}>
              {title(s.otherId)}
            </button>
            <span className="rl-shelf-rel">{relationLabel(s.relation)}</span>
            <span className="rl-shelf-reason" title={s.evidence?.span}>
              {s.reason}
            </span>
            {editable ? (
              <span className="rl-ledger-actions">
                <button type="button" className="rl-key" aria-label={`Accept ${title(s.otherId)}`} onClick={() => onAccept(s)}>
                  ✓
                </button>
                <button type="button" className="rl-key" aria-label={`Dismiss ${title(s.otherId)}`} onClick={() => onDismiss(s)}>
                  ✕
                </button>
                <button type="button" className="rl-key" title={`Stop showing ${s.source} suggestions`} onClick={() => onMute(s.source)}>
                  Mute {s.source}
                </button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}
