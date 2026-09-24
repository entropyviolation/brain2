/**
 * Item detail History well — Explorer sunken list of what changed, when.
 */
"use client"

import { useEffect, useState } from "react"
import { formatActivityWhen, ITEM_ACTIVITY_STORAGE_KEY, listItemActivity, type ItemActivityEntry } from "@/lib/item-activity"
import "./item-detail-chrome.css"

export function ItemActivityPanel({ itemId }: { itemId: string }) {
  const [entries, setEntries] = useState<ItemActivityEntry[]>(() => listItemActivity(itemId))

  useEffect(() => {
    const refresh = () => setEntries(listItemActivity(itemId))
    refresh()
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === ITEM_ACTIVITY_STORAGE_KEY || e.key === "cogs-item-activity") refresh()
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener(ITEM_ACTIVITY_STORAGE_KEY, refresh)
    window.addEventListener("cogs-item-activity", refresh)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener(ITEM_ACTIVITY_STORAGE_KEY, refresh)
      window.removeEventListener("cogs-item-activity", refresh)
    }
  }, [itemId])

  return (
    <section className="item-activity" aria-label="Item history">
      <h3 className="item-activity-caption">History</h3>
      <p className="item-activity-hint">What changed on this item, and when. Append-only — not undo.</p>
      <div className="item-activity-well" role="list">
        {entries.length === 0 ? (
          <p className="item-activity-empty">No changes recorded yet. Save this item to start the ledger.</p>
        ) : (
          entries.map((entry) => (
            <article key={entry.id} className="item-activity-row" role="listitem">
              <time className="item-activity-when" dateTime={entry.at}>
                {formatActivityWhen(entry.at)}
              </time>
              <div className="item-activity-body">
                <p className="item-activity-summary">{entry.summary}</p>
                {entry.changes.length > 1 && (
                  <ul className="item-activity-changes">
                    {entry.changes.map((c, i) => (
                      <li key={`${entry.id}-${c.field}-${i}`}>
                        {c.label}: {c.from} → {c.to}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}
