/**
 * components/Lists/dialogs/list-properties/ListPropertiesParts.tsx — List Settings furniture
 *
 * The pieces the tabbed List Settings sheet is built from (see
 * docs/LIST_SETTINGS_REDESIGN.md): the identity monitor, the Places map, the
 * Type / Show / Hide panel switch, view cards, and the safety cover over
 * Clear and Delete. Each part reads or writes the same fields the old single
 * column did; none of them owns persistence.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { useTaskStore } from "@/lib/task-store"
import type { ItemDetailPanel, List, ListDisplayMode } from "@/lib/types"
import { foldersContainingList } from "@/lib/folder-membership"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { linksForList } from "@/lib/list-links"
import { folderFor } from "@/components/Icons/Icon"
import { iconFor } from "@/components/Lists/lib/icon-utils"
import { listDisplayCaption } from "@/components/Lists/lib/velvet-icon-grid"

/* ---------- live counts for the status row and the Places tab ---------- */

export function useListPlaces(listId: string) {
  const folders = useTaskStore((s) => s.folders)
  const lists = useTaskStore((s) => s.lists)
  return useMemo(() => {
    const inFolders = foldersContainingList(folders, listId)
    const children = lists.filter((l) => l.parentListId === listId && !isFolderAllItemsCategoryId(l.id))
    const links = linksForList(lists, listId).map((link) => {
      const otherId = link.role === "push" ? link.targetListId : link.sourceListId
      return { ...link, otherId, other: lists.find((l) => l.id === otherId) }
    })
    return { inFolders, children, links }
  }, [folders, lists, listId])
}

/* ---------- identity: the list's orb on velvet in a beige monitor ---------- */

export function ListMonitor({
  list,
  nameRef,
  onOpenIconPicker,
  interactive,
}: {
  list: List
  /** Imperative label so typing the name does not re-render the sheet. */
  nameRef?: React.RefObject<HTMLSpanElement | null>
  onOpenIconPicker?: () => void
  interactive: boolean
}) {
  const glass = (
    <span className="lp-glass">
      <span className="lp-glass-ring" style={{ ["--lp-ring" as string]: list.color || "transparent" }} aria-hidden />
      <img src={iconFor(list.id, list.icon)} alt="" draggable={false} loading="lazy" decoding="async" />
      <span className="lp-glass-name" ref={nameRef}>
        {list.name}
      </span>
    </span>
  )
  return (
    <div className="lp-monitor" aria-hidden={!interactive}>
      {interactive ? (
        <button type="button" className="lp-crtcase" onClick={onOpenIconPicker} title="Change icon" aria-label="Change icon">
          {glass}
        </button>
      ) : (
        <span className="lp-crtcase">{glass}</span>
      )}
      <span className="lp-stand" />
    </div>
  )
}

/* ---------- Places map: folders above, nested below, connections at the sides ---------- */

type MapNode = { key: string; name: string; img?: string; x: number; y: number; ghost?: boolean; folder?: boolean }

export function PlacesMap({ list }: { list: List }) {
  const { inFolders, children, links } = useListPlaces(list.id)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(720)
  useEffect(() => {
    const el = boardRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth || 720))
    ro.observe(el)
    setWidth(el.clientWidth || 720)
    return () => ro.disconnect()
  }, [])

  const H = 236
  const cx = width / 2
  const cy = 116
  const spread = (count: number, maxW: number) => {
    const n = Math.max(count, 1)
    const w = Math.min(maxW, n * 112)
    return (i: number) => cx - w / 2 + w / n / 2 + i * (w / n)
  }
  const shownFolders = inFolders.slice(0, 6)
  const shownKids = children.slice(0, 6)
  const outs = links.filter((l) => l.role === "push").slice(0, 4)
  const ins = links.filter((l) => l.role === "receive").slice(0, 4)

  const fx = spread(shownFolders.length, width * 0.7)
  const kx = spread(shownKids.length, width * 0.7)
  const folderNodes: MapNode[] = shownFolders.length
    ? shownFolders.map((f, i) => ({ key: `f:${f.id}`, name: f.name, img: f.icon || folderFor(f.id), x: fx(i), y: 34, folder: true }))
    : [{ key: "f:none", name: "folder", x: cx, y: 34, ghost: true, folder: true }]
  const kidNodes: MapNode[] = shownKids.length
    ? shownKids.map((c, i) => ({ key: `k:${c.id}`, name: c.name, img: iconFor(c.id, c.icon), x: kx(i), y: 202 }))
    : [{ key: "k:none", name: "nest", x: cx, y: 202, ghost: true }]
  const side = (arr: typeof links, x: number, slot: "in" | "out"): MapNode[] =>
    arr.length
      ? arr.map((l, i) => ({
          key: `${l.role}:${l.otherId}`,
          name: l.other?.name ?? l.otherId,
          img: iconFor(l.otherId, l.other?.icon),
          x,
          y: cy + (i - (arr.length - 1) / 2) * 50,
        }))
      : [{ key: `${slot}:none`, name: "connect", x, y: cy, ghost: true }]
  const rightNodes = side(outs, width - 92, "out")
  const leftNodes = side(ins, 92, "in")

  const trace = (pts: [number, number][], ghost?: boolean, arrow?: boolean) => {
    const d = pts.map((p) => p.join(",")).join(" ")
    return (
      <g opacity={ghost ? 0.4 : 1}>
        <polyline points={d} className="lp-trace" strokeDasharray={ghost ? "5 5" : undefined} markerEnd={arrow ? "url(#lp-arrow)" : undefined} />
        <polyline points={d} className="lp-trace-hi" strokeDasharray={ghost ? "5 5" : undefined} transform="translate(0,1.6)" />
      </g>
    )
  }
  const pad = (x: number, y: number, key: string) => (
    <g key={key}>
      <circle cx={x} cy={y} r={4.5} className="lp-pad" />
      <circle cx={x} cy={y} r={1.6} className="lp-pad-hole" />
    </g>
  )

  return (
    <div className="lp-board" ref={boardRef} role="img" aria-label={`Where ${list.name} lives: ${inFolders.length} folders, ${children.length} nested lists, ${links.length} connections`}>
      <svg viewBox={`0 0 ${width} ${H}`} preserveAspectRatio="none" aria-hidden>
        <defs>
          <marker id="lp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L10 5L0 10z" className="lp-arrowhead" />
          </marker>
        </defs>
        {folderNodes.map((f) => (
          <g key={f.key}>
            {trace([[f.x, f.y + 22], [f.x, 72], [cx, 72], [cx, cy - 36]], f.ghost)}
            {pad(f.x, f.y + 22, `${f.key}:pad`)}
          </g>
        ))}
        {kidNodes.map((k) => (
          <g key={k.key}>
            {trace([[cx, cy + 40], [cx, 166], [k.x, 166], [k.x, k.y - 22]], k.ghost)}
            {pad(k.x, k.y - 22, `${k.key}:pad`)}
          </g>
        ))}
        {rightNodes.map((r) => (
          <g key={r.key}>{trace([[cx + 40, cy], [cx + 120, cy], [cx + 120, r.y], [r.x - 30, r.y]], r.ghost, !r.ghost)}</g>
        ))}
        {leftNodes.map((l) => (
          <g key={l.key}>{trace([[l.x + 30, l.y], [cx - 120, l.y], [cx - 120, cy], [cx - 42, cy]], l.ghost, !l.ghost)}</g>
        ))}
        {pad(cx, cy - 36, "me-top")}
        {pad(cx, cy + 40, "me-bottom")}
      </svg>
      <span className="lp-board-tag" style={{ left: 12, top: 8 }}>Folders</span>
      <span className="lp-board-tag" style={{ left: 12, bottom: 8 }}>Nested</span>
      <span className="lp-board-tag" style={{ right: 12, top: 8 }}>Connected →</span>
      <span className="lp-board-tag" style={{ left: 12, top: cy - 44 }}>← Connected</span>
      {[...folderNodes, ...kidNodes, ...rightNodes, ...leftNodes].map((n) => (
        <span key={n.key} className={`lp-bnode${n.ghost ? " is-ghost" : ""}${n.folder ? " is-folder" : ""}`} style={{ left: n.x, top: n.y }}>
          {n.ghost ? <span className="lp-bnode-slot">+</span> : <img src={n.img} alt="" draggable={false} />}
          <span className="lp-bnode-name">{n.name}</span>
        </span>
      ))}
      <span className="lp-bnode is-me" style={{ left: cx, top: cy }}>
        <img src={iconFor(list.id, list.icon)} alt="" draggable={false} />
        <span className="lp-bnode-name">{list.name}</span>
      </span>
    </div>
  )
}

/* ---------- item-detail panels: one Type / Show / Hide switch per panel ---------- */

const PANELS: ItemDetailPanel[] = [
  "details",
  "scheduling",
  "dependencies",
  "subtasks",
  "analysis",
  "time",
  "body",
  "notes",
  "resources",
]
/** `details` always renders, so it can be added but never hidden (same as before). */
const HIDEABLE = new Set<ItemDetailPanel>([
  "scheduling",
  "dependencies",
  "subtasks",
  "analysis",
  "time",
  "body",
  "notes",
  "resources",
])
type PanelState = "type" | "show" | "hide"

export function panelState(list: List, panel: ItemDetailPanel): PanelState {
  // Hidden wins at resolve time (lib/item-types.ts), so it wins here too.
  if (HIDEABLE.has(panel) && (list.hiddenDetailPanels ?? []).includes(panel)) return "hide"
  if ((list.detailPanels ?? []).includes(panel)) return "show"
  return "type"
}

export function setPanelState(list: List, panel: ItemDetailPanel, state: PanelState): List {
  const added = (list.detailPanels ?? []).filter((p) => p !== panel)
  const hidden = (list.hiddenDetailPanels ?? []).filter((p) => p !== panel)
  if (state === "show") added.push(panel)
  if (state === "hide" && HIDEABLE.has(panel)) hidden.push(panel)
  return {
    ...list,
    detailPanels: added.length ? added : undefined,
    hiddenDetailPanels: hidden.length ? hidden : undefined,
  }
}

export function DetailPanelSwitches({ list, onChange }: { list: List; onChange: (list: List) => void }) {
  return (
    <table className="lp-tri">
      <tbody>
        {PANELS.map((panel) => {
          const state = panelState(list, panel)
          return (
            <tr key={panel}>
              <th scope="row">{panel}</th>
              <td>
                <span className="lp-seg" role="radiogroup" aria-label={`${panel} panel`}>
                  {(["type", "show", "hide"] as const).map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      role="radio"
                      aria-checked={state === opt}
                      className={`lp-seg-key${state === opt ? " is-on" : ""}`}
                      disabled={opt === "hide" && !HIDEABLE.has(panel)}
                      onClick={() => onChange(setPanelState(list, panel, opt))}
                    >
                      {opt === "type" ? "Type" : opt === "show" ? "Show" : "Hide"}
                    </button>
                  ))}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ---------- view cards: a little drawing of each view, lamp = offered ---------- */

function ViewThumb({ mode }: { mode: ListDisplayMode }) {
  if (mode === "icons") {
    return (
      <span className="lp-thumb is-velvet" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <i key={i} className="lp-thumb-orb" />
        ))}
      </span>
    )
  }
  if (mode === "checklist") {
    return (
      <span className="lp-thumb" aria-hidden>
        {[true, false, true].map((on, i) => (
          <span key={i} className="lp-thumb-check">
            <i className={on ? "is-x" : ""} />
            <b />
          </span>
        ))}
      </span>
    )
  }
  if (mode === "table" || mode === "spreadsheet") {
    const cols = mode === "table" ? 3 : 5
    return (
      <span className="lp-thumb" aria-hidden>
        <span className="lp-thumb-grid" style={{ gridTemplateColumns: mode === "table" ? "2fr 1fr 1fr" : `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols * (mode === "table" ? 4 : 5) }, (_, i) => (
            <i key={i} className={i < cols ? "is-head" : ""} />
          ))}
        </span>
      </span>
    )
  }
  return (
    <span className="lp-thumb" aria-hidden>
      <b className="lp-thumb-line is-strong" />
      <b className="lp-thumb-line" />
      <b className="lp-thumb-line is-strong" style={{ width: "55%" }} />
      <b className="lp-thumb-line" />
    </span>
  )
}

export function ViewModeCards({
  modes,
  enabled,
  active,
  onSelect,
  onToggleOffered,
}: {
  modes: readonly ListDisplayMode[]
  enabled: readonly ListDisplayMode[]
  active: ListDisplayMode
  onSelect: (mode: ListDisplayMode) => void
  onToggleOffered: (mode: ListDisplayMode) => void
}) {
  return (
    <div className="lp-views">
      {modes.map((mode) => {
        const caption = listDisplayCaption(mode)
        const offered = enabled.includes(mode)
        const onlyOne = offered && enabled.length === 1
        return (
          <div key={mode} className={`lp-vcard${active === mode ? " is-active" : ""}`}>
            <button type="button" className="lp-vcard-face" aria-pressed={active === mode} onClick={() => onSelect(mode)} aria-label={`${caption} view settings`}>
              <ViewThumb mode={mode} />
              <span className="lp-vcard-caption">{caption}</span>
            </button>
            <button
              type="button"
              role="switch"
              aria-checked={offered}
              aria-label={`Offer ${caption} on the toolbar`}
              title={onlyOne ? "A list must offer at least one view." : undefined}
              className="lp-offer"
              onClick={() => onToggleOffered(mode)}
            >
              <span className={`lp-lamp${offered ? " is-green" : ""}`} aria-hidden />
              {offered ? "On" : "Off"}
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- swatches: list color without the platform picker as the only door ---------- */

const SWATCHES = ["#7e14ff", "#a35cff", "#2a6ad8", "#3b82f6", "#9ad7ff", "#1a8a6a", "#22c55e", "#7dffc4", "#c8b860", "#ef4444", "#e86aa8", "#5a5e62", "#111111"]

export function ColorSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const current = (value || "").toLowerCase()
  const known = SWATCHES.some((c) => c.toLowerCase() === current)
  return (
    <div className="lp-swatches" role="radiogroup" aria-label="List color">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={c.toLowerCase() === current}
          aria-label={c}
          className={`lp-sw${c.toLowerCase() === current ? " is-on" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
      {!known && value ? <span className="lp-sw is-on" style={{ background: value }} title={value} aria-hidden /> : null}
      <label className="lp-sw-custom" title="Custom color">
        <input id="edit-category-color" type="color" value={value || "#3b82f6"} onChange={(e) => onChange(e.target.value)} aria-label="Custom color" />
        Custom…
      </label>
    </div>
  )
}

/* ---------- safety cover: lift, then press ---------- */

export function SafetyCover({ label, children }: { label: string; children: (armed: boolean) => ReactNode }) {
  const [open, setOpen] = useState(false)
  const timer = useRef<number | null>(null)
  const close = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(false), 2400)
  }
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])
  return (
    <span
      className={`lp-guard${open ? " is-open" : ""}`}
      onMouseLeave={() => open && close()}
      onMouseEnter={() => timer.current && window.clearTimeout(timer.current)}
    >
      {children(open)}
      <button
        type="button"
        className="lp-cover"
        aria-label={`Lift cover for ${label}`}
        aria-expanded={open}
        tabIndex={open ? -1 : 0}
        onClick={() => setOpen(true)}
      >
        Lift
      </button>
    </span>
  )
}
