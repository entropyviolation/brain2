/**
 * components/Home/Tracking/pen-settings/cross-view-detail-picker.tsx — Detail from another view
 *
 * Pen settings, under "Break this pen down by…". Pick another view (Company is
 * first when it exists), search its pens, click one to add it as a detail of
 * this pen. The detail is a label that mirrors that pen's name and color; no
 * counts-as link crosses views (`addCrossViewDetail`). Pens already linked are
 * left out.
 */
"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { orderPens } from "@/lib/pen-sort"
import { COMPANY_SCOPE_ID } from "@/lib/people-i-know"
import { useTimeTrackingStore, type TrackPen } from "@/lib/time-tracking-store"
import "../tracking-chrome.css"

const LIMIT = 24

export function CrossViewDetailPicker({
  ownerScopeId,
  pen,
  onAdd,
}: {
  ownerScopeId: string
  pen: TrackPen
  onAdd: (scopeId: string, penId: string) => void
}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const others = useMemo(() => {
    const list = scopes.filter((s) => s.id !== ownerScopeId)
    return [...list.filter((s) => s.id === COMPANY_SCOPE_ID), ...list.filter((s) => s.id !== COMPANY_SCOPE_ID)]
  }, [scopes, ownerScopeId])
  const [viewId, setViewId] = useState<string>(() => others[0]?.id ?? "")
  const [query, setQuery] = useState("")
  const view = others.find((s) => s.id === viewId) ?? others[0]
  const needle = query.trim().toLowerCase()

  const linked = new Set((pen.variants ?? []).filter((v) => v.scopeId === view?.id).map((v) => v.penId))
  const results = view
    ? orderPens(
        view.pens.filter((p) => !linked.has(p.id) && (!needle || p.name.toLowerCase().includes(needle))),
        "recent",
      ).slice(0, LIMIT)
    : []

  if (others.length === 0) return null

  return (
    <div className="trk-xview" role="group" aria-label="Detail from another view">
      <span className="trk-xview-title">From another view</span>
      <div className="trk-xview-views" role="group" aria-label="View to pick from">
        {others.map((s) => (
          <button key={s.id} type="button" aria-pressed={s.id === view?.id} onClick={() => setViewId(s.id)}>
            {s.name}
          </button>
        ))}
      </div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${view?.name ?? ""} pens…`}
        aria-label={`Search ${view?.name ?? "other view"} pens`}
        className="h-7 text-sm"
      />
      <div className="trk-xview-results">
        {results.length === 0 ? (
          <span className="trk-help">{needle ? "No pens match." : "Every pen here is already a detail."}</span>
        ) : (
          results.map((other) => (
            <button
              key={other.id}
              type="button"
              className="trk-chain-node"
              title={`Add ${other.name} (${view?.name}) as a detail of ${pen.name}`}
              onClick={() => view && onAdd(view.id, other.id)}
            >
              <span className="trk-chain-bead" style={{ background: other.color }} aria-hidden />
              {other.name}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
