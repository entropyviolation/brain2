/**
 * components/Home/Tracking/pen-gallery-dialog.tsx — Pen gallery
 *
 * Every pen in every tracking view on one sheet, opened from Tracking
 * settings. A view key row (All views, then each view with its count), one
 * search over name / path / view, and four arrangements: Family (each root
 * pen with the pens that count as it), Color (a hue spectrum), Most used, and
 * A–Z. A card shows the swatch (or the pen photograph), the counts-as path,
 * the level category (`lib/pen-levels.ts`), and painted time. Level groups a
 * view's pens by named rung, broadest first, unleveled last. Picking a card opens a small bench beside the sheet: name,
 * color, hide from the well, and All pen settings… (the one pen-settings
 * dialog through `openPenSettings`). + New pen adds to the view being looked at.
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { openPenSettings } from "@/components/Home/Tracking/open-pen-settings"
import { ancestorChain, rootPen } from "@/lib/pen-tree"
import { penLevel, scopeLevels } from "@/lib/pen-levels"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen } from "@/lib/time-tracking-store"
import "./tracking-chrome.css"
import "./tracking-settings.css"

type Arrange = "family" | "level" | "color" | "used" | "az"

const ARRANGE: { id: Arrange; label: string }[] = [
  { id: "family", label: "Family" },
  { id: "level", label: "Level" },
  { id: "color", label: "Color" },
  { id: "used", label: "Most used" },
  { id: "az", label: "A–Z" },
]

type Usage = { minutes: number; blocks: number }

type Card = {
  scopeId: string
  scopeName: string
  pen: TrackPen
  path: string[]
  rootId: string
  depth: number
  usage: Usage
  hidden: boolean
  /** Named level category, if the pen sits on one. */
  level?: string
  levelRank: number
}

function hue(color: string): number {
  const hex = color.replace("#", "")
  if (!/^[0-9a-f]{6}$/i.test(hex)) return 999
  const r = parseInt(hex.slice(0, 2), 16) / 255
  const g = parseInt(hex.slice(2, 4), 16) / 255
  const b = parseInt(hex.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  // Grays sort after the spectrum, light to dark.
  if (d < 0.06) return 400 + (1 - max) * 100
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return (h * 60 + 360) % 360
}

export function formatPenTime(minutes: number): string {
  if (minutes <= 0) return "—"
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

function toHexColor(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#888888"
}

export function PenGalleryDialog({ onClose, initialScopeId }: { onClose: () => void; initialScopeId?: string }) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const hiddenPenIds = useTimeTrackingStore((s) => s.hiddenPenIds)
  const updatePen = useTimeTrackingStore((s) => s.updatePen)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const toggleHiddenPen = useTimeTrackingStore((s) => s.toggleHiddenPen)

  const [scopeFilter, setScopeFilter] = useState<string>(initialScopeId ?? "all")
  const [query, setQuery] = useState("")
  const [arrange, setArrange] = useState<Arrange>("family")
  const [picked, setPicked] = useState<{ scopeId: string; penId: string } | null>(null)
  const [newName, setNewName] = useState("")

  const usage = useMemo(() => {
    const map = new Map<string, Usage>()
    for (const entry of entries) {
      const key = `${entry.scopeId}:${entry.penId}`
      const row = map.get(key) ?? { minutes: 0, blocks: 0 }
      row.blocks += 1
      if (entry.kind !== "instant") row.minutes += Math.max(0, entry.endMin - entry.startMin)
      map.set(key, row)
    }
    return map
  }, [entries])

  const cards = useMemo(() => {
    const out: Card[] = []
    for (const scope of scopes) {
      const hidden = new Set(hiddenPenIds[scope.id] ?? [])
      for (const pen of scope.pens) {
        const chain = ancestorChain(scope.pens, pen.id)
        out.push({
          scopeId: scope.id,
          scopeName: scope.name,
          pen,
          path: chain.slice(0, -1).map((p) => p.name),
          rootId: rootPen(scope.pens, pen.id)?.id ?? pen.id,
          depth: Math.max(0, chain.length - 1),
          usage: usage.get(`${scope.id}:${pen.id}`) ?? { minutes: 0, blocks: 0 },
          hidden: hidden.has(pen.id),
          level: penLevel(scope, pen.id)?.name,
          levelRank: (() => {
            const id = penLevel(scope, pen.id)?.id
            const rank = scopeLevels(scope).findIndex((l) => l.id === id)
            return rank < 0 ? 999 : rank
          })(),
        })
      }
    }
    return out
  }, [scopes, hiddenPenIds, usage])

  const needle = query.trim().toLowerCase()
  const visible = cards.filter((card) => {
    if (scopeFilter !== "all" && card.scopeId !== scopeFilter) return false
    if (!needle) return true
    return [card.pen.name, card.scopeName, ...card.path, card.pen.variants?.map((v) => v.name).join(" ") ?? ""]
      .join(" ")
      .toLowerCase()
      .includes(needle)
  })

  const shelves = useMemo(() => {
    const byScope = new Map<string, Card[]>()
    for (const card of visible) {
      const list = byScope.get(card.scopeId) ?? []
      list.push(card)
      byScope.set(card.scopeId, list)
    }
    return scopes
      .filter((scope) => byScope.has(scope.id))
      .map((scope) => {
        const list = byScope.get(scope.id)!
        const byName = (a: Card, b: Card) => a.pen.name.localeCompare(b.pen.name)
        if (arrange === "az") list.sort(byName)
        else if (arrange === "used") list.sort((a, b) => b.usage.minutes - a.usage.minutes || b.usage.blocks - a.usage.blocks || byName(a, b))
        else if (arrange === "color") list.sort((a, b) => hue(a.pen.color) - hue(b.pen.color) || byName(a, b))
        else if (arrange === "level") list.sort((a, b) => a.levelRank - b.levelRank || byName(a, b))
        else {
          const rootName = new Map(scope.pens.map((p) => [p.id, p.name]))
          list.sort(
            (a, b) =>
              (rootName.get(a.rootId) ?? "").localeCompare(rootName.get(b.rootId) ?? "") ||
              a.depth - b.depth ||
              byName(a, b),
          )
        }
        const tiers: { name: string; cards: Card[] }[] = []
        if (arrange === "level") {
          for (const card of list) {
            const name = card.level ?? "No level"
            const last = tiers.at(-1)
            if (last && last.name === name) last.cards.push(card)
            else tiers.push({ name, cards: [card] })
          }
        }
        const families: Card[][] = []
        if (arrange === "family") {
          for (const card of list) {
            const last = families.at(-1)
            if (last && last[0]!.rootId === card.rootId) last.push(card)
            else families.push([card])
          }
        }
        return { scope, list, families, tiers }
      })
  }, [visible, scopes, arrange])

  const pickedCard = picked ? cards.find((c) => c.scopeId === picked.scopeId && c.pen.id === picked.penId) : undefined
  const addScopeId = scopeFilter !== "all" ? scopeFilter : (picked?.scopeId ?? scopes[0]?.id)
  const addScopeName = scopes.find((s) => s.id === addScopeId)?.name ?? ""

  const createPen = () => {
    const name = newName.trim()
    if (!name || !addScopeId) return
    const scope = scopes.find((s) => s.id === addScopeId)
    const color = PEN_PALETTE[(scope?.pens.length ?? 0) % PEN_PALETTE.length] ?? "#888888"
    const id = addPen(addScopeId, { name, color })
    setNewName("")
    if (id) setPicked({ scopeId: addScopeId, penId: id })
  }

  const renderCard = (card: Card) => {
    const isPicked = pickedCard?.pen.id === card.pen.id && pickedCard.scopeId === card.scopeId
    return (
      <li key={`${card.scopeId}:${card.pen.id}`} data-depth={arrange === "family" ? Math.min(card.depth, 3) : 0}>
        <button
          type="button"
          data-no95=""
          className="trk-gallery-card"
          aria-pressed={isPicked}
          data-hidden={card.hidden ? "true" : undefined}
          title={[...card.path, card.pen.name].join(" › ")}
          onClick={() => setPicked({ scopeId: card.scopeId, penId: card.pen.id })}
          onDoubleClick={() => openPenSettings(card.scopeId, card.pen.id)}
        >
          <span
            className="trk-gallery-swatch"
            style={{
              background: card.pen.image ? `center / cover url(${card.pen.image}), ${card.pen.color}` : card.pen.color,
            }}
            aria-hidden
          />
          <span className="trk-gallery-name">{card.pen.name}</span>
          {card.path.length || card.level ? (
            <span className="trk-gallery-path">
              {card.level ? <span className="trk-gallery-level">{card.level}</span> : null}
              {card.path.join(" › ")}
            </span>
          ) : null}
          <span className="trk-gallery-meta">
            {formatPenTime(card.usage.minutes)}
            {card.usage.blocks ? ` · ${card.usage.blocks}×` : ""}
            {card.hidden ? " · hidden" : ""}
          </span>
        </button>
      </li>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="trk95 trk-dialog trk-pen-gallery"
        data-ui-name="Pen gallery"
        data-ui-docs="components/Home/Tracking/README.md"
      >
        <DialogHeader className="trk-dialog-head trk-gallery-head">
          <DialogTitle>Pen gallery</DialogTitle>
          <DialogDescription className="trk-help">
            {cards.length} pens across {scopes.length} views. Pick a pen to edit it; double-click for all its settings.
          </DialogDescription>
        </DialogHeader>

        <div className="trk-gallery-controls">
          <input
            type="search"
            className="trk-gallery-search"
            aria-label="Search pens"
            placeholder="Search pens, paths, views…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="trk-gallery-keys" role="group" aria-label="Arrange pens">
            {ARRANGE.map((row) => (
              <button key={row.id} type="button" data-no95="" aria-pressed={arrange === row.id} onClick={() => setArrange(row.id)}>
                {row.label}
              </button>
            ))}
          </div>
        </div>

        <div className="trk-gallery-views" role="tablist" aria-label="Tracking view">
          <button type="button" role="tab" data-no95="" aria-selected={scopeFilter === "all"} onClick={() => setScopeFilter("all")}>
            All views <span>{cards.length}</span>
          </button>
          {scopes.map((scope) => (
            <button
              key={scope.id}
              type="button"
              role="tab"
              data-no95=""
              aria-selected={scopeFilter === scope.id}
              onClick={() => setScopeFilter(scope.id)}
            >
              {scope.name} <span>{scope.pens.length}</span>
            </button>
          ))}
        </div>

        <div className="trk-gallery-deck">
          <div className="trk-gallery-sheet">
            {shelves.length === 0 ? <p className="trk-gallery-empty">No pens match “{query}”.</p> : null}
            {shelves.map(({ scope, list, families, tiers }) => (
              <section key={scope.id} className="trk-gallery-shelf" aria-label={`${scope.name} pens`}>
                <h4>
                  {scope.name}
                  <span>{list.length}</span>
                </h4>
                {arrange === "family" ? (
                  <>
                    {/* Pens that stand alone share one grid; a family (a root with pens under it) gets its own tray. */}
                    {families.some((family) => family.length === 1) ? (
                      <ul className="trk-gallery-grid">
                        {families.filter((family) => family.length === 1).map((family) => renderCard(family[0]!))}
                      </ul>
                    ) : null}
                    {families
                      .filter((family) => family.length > 1)
                      .map((family) => (
                        <ul key={family[0]!.rootId} className="trk-gallery-family" aria-label={`${family[0]!.pen.name} family`}>
                          {family.map(renderCard)}
                        </ul>
                      ))}
                  </>
                ) : arrange === "level" ? (
                  tiers.map((tier) => (
                    <div key={tier.name} className="trk-gallery-tier">
                      <p className="trk-gallery-tier-name">
                        {tier.name} <span>{tier.cards.length}</span>
                      </p>
                      <ul className="trk-gallery-grid">{tier.cards.map(renderCard)}</ul>
                    </div>
                  ))
                ) : (
                  <ul className="trk-gallery-grid">{list.map(renderCard)}</ul>
                )}
              </section>
            ))}
          </div>

          <aside className="trk-gallery-bench" aria-label="Pen bench">
            {pickedCard ? (
              <PenBench
                key={`${pickedCard.scopeId}:${pickedCard.pen.id}`}
                card={pickedCard}
                onSave={(pen) => updatePen(pickedCard.scopeId, pen)}
                onToggleHidden={() => toggleHiddenPen(pickedCard.scopeId, pickedCard.pen.id)}
              />
            ) : (
              <p className="trk-gallery-empty">Pick a pen to rename it, recolor it, or hide it from the well.</p>
            )}
            <div className="trk-gallery-new">
              <p className="trk-section-title">New pen{addScopeName ? ` · ${addScopeName}` : ""}</p>
              <div className="trk-bim-row trk-bim-add">
                <input
                  aria-label="New pen name"
                  placeholder="name"
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      createPen()
                    }
                  }}
                />
                <button type="button" data-no95="" onClick={createPen} disabled={!newName.trim() || !addScopeId}>
                  Add
                </button>
              </div>
            </div>
          </aside>
        </div>

        <div className="trk-dialog-actions">
          <button type="button" onClick={onClose}>
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PenBench({
  card,
  onSave,
  onToggleHidden,
}: {
  card: Card
  onSave: (pen: TrackPen) => void
  onToggleHidden: () => void
}) {
  const [name, setName] = useState(card.pen.name)
  const commitName = () => {
    const next = name.trim()
    if (!next) setName(card.pen.name)
    else if (next !== card.pen.name) onSave({ ...card.pen, name: next, editedAt: Date.now() })
  }
  return (
    <div className="trk-gallery-edit">
      <span
        className="trk-gallery-swatch trk-gallery-swatch-lg"
        style={{ background: card.pen.image ? `center / cover url(${card.pen.image}), ${card.pen.color}` : card.pen.color }}
        aria-hidden
      />
      <p className="trk-gallery-edit-view">
        {card.scopeName}
        {card.path.length ? ` › ${card.path.join(" › ")}` : ""}
      </p>
      <label className="trk-gallery-field">
        <span>Name</span>
        <input
          aria-label="Pen name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commitName()
            }
          }}
        />
      </label>
      <label className="trk-gallery-field">
        <span>Color</span>
        <input
          type="color"
          aria-label="Pen color"
          value={toHexColor(card.pen.color)}
          onChange={(event) => onSave({ ...card.pen, color: event.target.value, editedAt: Date.now() })}
        />
        <code>{card.pen.color}</code>
      </label>
      <p className="trk-gallery-edit-meta">
        {card.usage.blocks === 0
          ? "Never painted"
          : `${formatPenTime(card.usage.minutes)} painted · ${card.usage.blocks} ${card.usage.blocks === 1 ? "mark" : "marks"}`}
        {card.pen.tags?.length ? ` · ${card.pen.tags.length} tags` : ""}
      </p>
      <div className="trk-gallery-edit-keys">
        <button type="button" data-no95="" aria-pressed={card.hidden} onClick={onToggleHidden}>
          {card.hidden ? "Show in well" : "Hide from well"}
        </button>
        <button type="button" data-no95="" onClick={() => openPenSettings(card.scopeId, card.pen.id)}>
          All pen settings…
        </button>
      </div>
    </div>
  )
}
