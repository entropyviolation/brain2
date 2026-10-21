/**
 * components/Home/Tracking/pen-palette.tsx — What you are about to paint with
 *
 * A Win95 panel: Show as / Sort / Expand↔Conceal, plus a Look well of Hide /
 * View / Tags latches (`TrkLatchesWell`). View modes (Activity / Location /
 * Mood / …) live in `pen-mode-bar.tsx`, rendered by the parent under this
 * tray so they sit against the Time Grid. **Log activity** is a grid action
 * on that same rail (`LogActivityLatch` in `log-activity-dialog.tsx`), not
 * this tray. The selected pen is a swatch + name + its own Settings. Draw,
 * Erase, and Scissors sit in `TrackingToolsTray` on the far-right
 * `.trk-tools-rail`. The pen tray (selected + search + beads) shows only
 * while Draw is selected. Beads default to one row; **Expand** (right of
 * Tree) unwraps them and the key reads **Conceal** while the well is open.
 * **+ New pen** sits at the bottom of the well whenever it is expanded.
 * Collapsed, **Create new pen** appears only when a search matches nothing,
 * with that query already the name. The well is plain steel — no photograph.
 * View settings (commands, log keywords, cell size, fill range, hidden pens) is a separate dialog so
 * it cannot be mistaken for pen settings. Infinite scroll toggles next to
 * Day/Week on the grid, not in that dialog.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Settings2 } from "lucide-react"
import { orbFor } from "@/components/Icons"
import { restoreOccupiedScope, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { PEN_SORT_LABELS, PEN_SORT_MODES, type PenSortMode } from "@/lib/pen-sort"
import { openPenSettings } from "@/components/Home/Tracking/open-pen-settings"
import { TrackingViewSettingsDialog } from "@/components/Home/Tracking/tracking-view-settings-dialog"
import { TrackingTagsPanel } from "@/components/Home/Tracking/tracking-tags-panel"
import { VariantChips } from "@/components/Home/Tracking/variant-chips"
import { PenSwatches } from "@/components/Home/Tracking/pen-swatches"
import { DepthControl } from "@/components/Home/Tracking/depth-control"
import { TrackingToolsTray, TrackingViewLatches } from "@/components/Home/Tracking/tracking-tools-tray"
import { TrkLatchesWell, TrkPenToolsRow } from "@/components/Home/Tracking/trk-instrument"
import { PushKey, ScopePanel, ScopeSection } from "@/components/Home/Tracking/trk-scope"
import {
  nextPaintPenId,
  rememberDrawPenId,
  showPenTray,
  trackingPaintTool,
} from "@/components/Home/Tracking/tracking-tool-mode"
import { setTrackingViewPrefs, useTrackingViewPrefs } from "@/components/Home/Tracking/tracking-view-prefs"
import "./tracking-chrome.css"

export { ERASE, SCISSORS } from "./tracking-tool-mode"

/** A pen still named by raw coordinates ("32.7381,-117.2402") — a place waiting for a name. */
export function isUnnamedPlace(name: string): boolean {
  return /^\s*-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?\s*$/.test(name)
}

export function PenPalette({
  embedded = false,
  variant = "panel",
}: {
  embedded?: boolean
  /** `rack` — the Home Tracking desk's left bay: a scope panel, one pen per row. */
  variant?: "panel" | "rack"
} = {}) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const tags = useTimeTrackingStore((s) => s.tags)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const selectedPenId = useTimeTrackingStore((s) => s.selectedPenId)
  const selectedVariantIds = useTimeTrackingStore((s) => s.selectedVariantIds)
  const penSort = useTimeTrackingStore((s) => s.penSort)
  const hiddenPenIds = useTimeTrackingStore((s) => s.hiddenPenIds)
  const setSelectedPen = useTimeTrackingStore((s) => s.setSelectedPen)
  const setPenSort = useTimeTrackingStore((s) => s.setPenSort)
  const toggleSelectedVariant = useTimeTrackingStore((s) => s.toggleSelectedVariant)
  const toggleHiddenPen = useTimeTrackingStore((s) => s.toggleHiddenPen)
  const addPen = useTimeTrackingStore((s) => s.addPen)
  const addVariant = useTimeTrackingStore((s) => s.addVariant)
  const setScopeDisplayDepth = useTimeTrackingStore((s) => s.setScopeDisplayDepth)
  const prefs = useTrackingViewPrefs()

  const [manage, setManage] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [viewSettings, setViewSettings] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const state = useTimeTrackingStore.getState()
    const next = restoreOccupiedScope(state)
    if (next.activeScopeId && next.activeScopeId !== state.activeScopeId) {
      state.setActiveScope(next.activeScopeId)
    }
  }, [])

  useEffect(() => {
    rememberDrawPenId(selectedPenId)
  }, [selectedPenId])

  useEffect(() => {
    if (!sortOpen) return
    const close = (event: MouseEvent) => {
      const root = sortRef.current
      if (root && event.target instanceof Node && root.contains(event.target)) return
      setSortOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSortOpen(false)
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [sortOpen])

  const scope = scopes.find((s) => s.id === activeScopeId) || scopes[0]
  const hidden = new Set(hiddenPenIds[scope?.id ?? ""] ?? [])
  const visiblePens = (scope?.pens ?? []).filter((p) => !hidden.has(p.id))
  const selectedPen = scope?.pens.find((p) => p.id === selectedPenId) ?? null
  const paintTool = trackingPaintTool(selectedPenId)

  if (!scope) return null

  const sortMode = (PEN_SORT_MODES as readonly string[]).includes(penSort) ? penSort : "recent"

  if (variant === "rack") {
    const detailCount = selectedPen?.variants?.length ?? 0
    const rackPens = visiblePens.length ? visiblePens : scope.pens
    // Coordinate-named leaves go in one drawer; a coordinate pen with children stays in the tree.
    const unnamed = rackPens.filter(
      (pen) => isUnnamedPlace(pen.name) && !rackPens.some((other) => other.parentId === pen.id || other.parentIds?.includes(pen.id)),
    )
    const unnamedIds = new Set(unnamed.map((pen) => pen.id))
    const namedPens = rackPens.filter((pen) => !unnamedIds.has(pen.id))
    return (
      <ScopePanel
        as="aside"
        className="trk-rack"
        badge="PEN"
        name={`RACK · ${visiblePens.length} PEN${visiblePens.length === 1 ? "" : "S"}`}
        power="INK"
        label="Pens"
        julia={0}
        data-ui-name="Tracking control panel"
        data-ui-docs="components/Home/Tracking/README.md"
      >
        <ScopeSection band="Selected">
          <div className="trk-rack-plate trk-selected">
            {selectedPen ? (
              <>
                <div className="trk-rack-row">
                  <span
                    className="trk-rack-swatch"
                    style={{
                      background: selectedPen.color,
                      backgroundImage: selectedPen.image ? `url("${selectedPen.image}")` : undefined,
                    }}
                    title={`Double-click to open ${selectedPen.name} settings`}
                    onDoubleClick={() => openPenSettings(scope.id, selectedPen.id)}
                    aria-hidden
                  />
                  <span className="trk-rack-name">{selectedPen.name}</span>
                  {detailCount ? (
                    <span className="trk-digit" title={`${detailCount} detail options`}>
                      {detailCount}
                    </span>
                  ) : null}
                </div>
                <VariantChips
                  pen={selectedPen}
                  selected={selectedVariantIds}
                  size="sm"
                  onToggle={toggleSelectedVariant}
                  onCreate={(name) => {
                    const id = addVariant(scope.id, selectedPen.id, name)
                    if (id) toggleSelectedVariant(id)
                  }}
                  onOpenPen={(penId, viewId) => openPenSettings(viewId ?? scope.id, penId)}
                />
                <button
                  type="button"
                  className="trk-rack-settings"
                  onClick={() => openPenSettings(scope.id, selectedPen.id)}
                  title={`Settings, tags and category for ${selectedPen.name}`}
                >
                  Pen settings
                </button>
              </>
            ) : (
              <span className="trk-selected-meta">
                {paintTool === "erase"
                  ? "Erasing — pick a pen to paint again"
                  : paintTool === "scissors"
                    ? "Scissors — pick a pen to paint again"
                    : paintTool === "point"
                      ? "Point — clicks open blocks, nothing paints"
                    : "Pick a pen"}
              </span>
            )}
          </div>
        </ScopeSection>

        <ScopeSection band="Pens" grow>
          <div className="trk-push-row" role="group" aria-label="Sort pens">
            {PEN_SORT_MODES.map((mode) => (
              <PushKey
                key={mode}
                stacked
                label={PEN_SORT_LABELS[mode]}
                pressed={sortMode === mode}
                onClick={() => setPenSort(mode as PenSortMode)}
                title={`Sort pens ${PEN_SORT_LABELS[mode]}`}
              />
            ))}
          </div>
          <div className="trk-rack-latches" role="group" aria-label="View latches">
            <button
              type="button"
              aria-pressed={hiding}
              onClick={() => setHiding((h) => !h)}
              title="Hide pens from this view's well"
            >
              Hide
            </button>
            <button
              type="button"
              onClick={() => setViewSettings(true)}
              title="Tracking settings — pen gallery, hidden pens, each view, BIM commands"
            >
              View
            </button>
            <button type="button" aria-pressed={manage} onClick={() => setManage((m) => !m)} title="Tag library">
              Tags
            </button>
          </div>
          <PenSwatches
            pens={namedPens}
            tags={tags}
            selectedId={selectedPen ? selectedPenId : null}
            onSelect={setSelectedPen}
            onCreate={(name, color) => {
              const id = addPen(scope.id, { name, color })
              if (id) setSelectedPen(id)
            }}
            onOpenPen={(id) => openPenSettings(scope.id, id)}
            creator="always"
            sortMode={sortMode}
            searchPlaceholder="Find a pen…"
            layout="list"
          />
          {unnamed.length > 0 ? (
            <details className="trk-unnamed" data-ui-name="Unnamed places">
              <summary title="Places still named by raw coordinates — open one to give it a name">
                <span className="trk-unnamed-swatches" aria-hidden>
                  {unnamed.slice(0, 8).map((pen) => (
                    <span key={pen.id} style={{ background: pen.color }} />
                  ))}
                </span>
                <span className="trk-unnamed-title">Unnamed places</span>
                <span className="trk-digit">{unnamed.length}</span>
              </summary>
              <div className="trk-unnamed-list">
                {unnamed.map((pen) => (
                  <div key={pen.id} className="trk-unnamed-row">
                    <button
                      type="button"
                      data-no95=""
                      className="trk-pen-node"
                      data-selected={selectedPenId === pen.id ? "true" : "false"}
                      onClick={() => setSelectedPen(pen.id)}
                      title={`Paint with ${pen.name}`}
                    >
                      <span className="trk-pen-node-swatch" style={{ backgroundColor: pen.color }} aria-hidden />
                      <span className="trk-pen-node-name">{pen.name}</span>
                    </button>
                    <button
                      type="button"
                      className="trk-unnamed-name"
                      aria-label={`Name ${pen.name}`}
                      onClick={() => openPenSettings(scope.id, pen.id)}
                    >
                      Name…
                    </button>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          {hiding && (
            <div className="trk-hide-plate">
              {scope.pens.map((pen) => (
                <button
                  key={pen.id}
                  type="button"
                  aria-pressed={hidden.has(pen.id)}
                  title={hidden.has(pen.id) ? `Show ${pen.name}` : `Hide ${pen.name} from this well`}
                  onClick={() => toggleHiddenPen(scope.id, pen.id)}
                >
                  <span className="inline-block h-2.5 w-2.5" style={{ background: pen.color }} />
                  {hidden.has(pen.id) ? `Show ${pen.name}` : `Hide ${pen.name}`}
                </button>
              ))}
            </div>
          )}
          {manage && <TrackingTagsPanel />}
        </ScopeSection>

        <div className="trk-rack-foot">
          <span>
            {visiblePens.length} pen{visiblePens.length === 1 ? "" : "s"}
            {hidden.size ? ` · ${hidden.size} hidden` : ""} · {scope.name}
          </span>
          <span>sorted {PEN_SORT_LABELS[sortMode].toLowerCase()}</span>
        </div>
        {viewSettings && <TrackingViewSettingsDialog scopeId={scope.id} onClose={() => setViewSettings(false)} />}
      </ScopePanel>
    )
  }

  return (
    <div
      className="trk95"
      data-ui-name="Tracking control panel"
      data-ui-help="Pens, views, and paint tools for the time grid."
      data-ui-docs="components/Home/Tracking/README.md"
      data-ui-docs-anchor="cabinet-looks"
    >
      <div className={embedded ? "trk-panel" : "trk-window"}>
        {!embedded && (
          <div className="trk-title-bar">
            <img src={orbFor("tracking-pens")} alt="" className="trk-title-orb" />
            <h2>Pens — {scope.name}</h2>
            <div className="trk-title-bar-controls" aria-hidden>
              <span className="trk-title-btn">_</span>
              <span className="trk-title-btn">□</span>
            </div>
          </div>
        )}

        <div className="trk-toolbar">
          <div className="trk-toolbar-row">
            <DepthControl
              pens={scope.pens}
              labels={scope.depthLabels}
              value={scope.displayDepth ?? null}
              onChange={(depth) => setScopeDisplayDepth(scope.id, depth)}
              ariaLabel={`${scope.name} detail level`}
            />

            <span className="trk-toolbar-split" aria-hidden />

            <div className="trk-module-sort" ref={sortRef} role="group" aria-label="Sort pens">
              <span className="trk-silk">Sort</span>
              <button
                type="button"
                className="trk-sort-readout"
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
                aria-label={`Sort pens ${PEN_SORT_LABELS[sortMode]}`}
                title="Recent, A–Z, or Tree"
                onClick={() => setSortOpen((open) => !open)}
              >
                {PEN_SORT_LABELS[sortMode]}
              </button>
              {sortOpen && (
                <div className="trk-sort-menu" role="listbox" aria-label="Sort pens">
                  {PEN_SORT_MODES.map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      role="option"
                      aria-selected={sortMode === mode}
                      aria-label={`Sort pens ${PEN_SORT_LABELS[mode]}`}
                      onClick={() => {
                        setPenSort(mode as PenSortMode)
                        setSortOpen(false)
                      }}
                    >
                      {PEN_SORT_LABELS[mode]}
                    </button>
                  ))}
                </div>
              )}
              <span className="trk-toolbar-split" aria-hidden />
              <button
                type="button"
                aria-pressed={prefs.penWellExpanded}
                aria-label={prefs.penWellExpanded ? "Conceal" : "Expand"}
                title={prefs.penWellExpanded ? "Show one row of pens" : "Show all pens"}
                onClick={() => setTrackingViewPrefs({ penWellExpanded: !prefs.penWellExpanded })}
              >
                {prefs.penWellExpanded ? "Conceal" : "Expand"}
              </button>
            </div>

            <span className="trk-toolbar-split" aria-hidden />

            <TrkLatchesWell>
              <TrackingViewLatches
                hiding={hiding}
                manage={manage}
                onToggleHiding={() => setHiding((h) => !h)}
                onOpenViewSettings={() => setViewSettings(true)}
                onToggleManage={() => setManage((m) => !m)}
              />
            </TrkLatchesWell>
          </div>
        </div>

        <TrkPenToolsRow
          showPens={showPenTray(paintTool)}
          pens={
            <>
              <div className="trk-selected">
                {selectedPen ? (
                  <>
                    <span
                      className="trk-selected-swatch"
                      style={{
                        background: selectedPen.color,
                        backgroundImage: selectedPen.image ? `url("${selectedPen.image}")` : undefined,
                      }}
                      title={`Double-click to open ${selectedPen.name} settings`}
                      onDoubleClick={() => openPenSettings(scope.id, selectedPen.id)}
                      aria-hidden
                    />
                    <div className="trk-selected-plate">
                      <div className="trk-selected-name">{selectedPen.name}</div>
                      <div className="trk-selected-meta">Selected pen for this view</div>
                    </div>
                    <button
                      type="button"
                      className="trk-latch"
                      onClick={() => openPenSettings(scope.id, selectedPen.id)}
                      title={`Settings, tags and category for ${selectedPen.name}`}
                    >
                      <Settings2 /> Settings
                    </button>
                  </>
                ) : (
                  <span className="trk-selected-plate">
                    <span className="trk-selected-meta">Pick a pen</span>
                  </span>
                )}
              </div>

              <div className="trk-body">
                <PenSwatches
                  pens={visiblePens.length ? visiblePens : scope.pens}
                  tags={tags}
                  selectedId={selectedPen ? selectedPenId : null}
                  onSelect={setSelectedPen}
                  onCreate={(name, color) => {
                    const id = addPen(scope.id, { name, color })
                    if (id) setSelectedPen(id)
                  }}
                  onOpenPen={(id) => openPenSettings(scope.id, id)}
                  creator={prefs.penWellExpanded ? "always" : "on-miss"}
                  sortMode={sortMode}
                  searchPlaceholder="Select the paint pen"
                  compact
                  expanded={prefs.penWellExpanded}
                />
                {hiding && (
                  <div className="trk-hide-plate">
                    {scope.pens.map((pen) => (
                      <button
                        key={pen.id}
                        type="button"
                        aria-pressed={hidden.has(pen.id)}
                        title={hidden.has(pen.id) ? `Show ${pen.name}` : `Hide ${pen.name} from this well`}
                        onClick={() => toggleHiddenPen(scope.id, pen.id)}
                      >
                        <span className="inline-block h-2.5 w-2.5" style={{ background: pen.color }} />
                        {hidden.has(pen.id) ? `Show ${pen.name}` : `Hide ${pen.name}`}
                      </button>
                    ))}
                  </div>
                )}

                {selectedPen && (
                  <div className="trk-detail-plate">
                    <span className="trk-silk">{selectedPen.variantLabel || "Detail"}</span>
                    <VariantChips
                      pen={selectedPen}
                      selected={selectedVariantIds}
                      size="sm"
                      onToggle={toggleSelectedVariant}
                      onCreate={(name) => {
                        const id = addVariant(scope.id, selectedPen.id, name)
                        if (id) toggleSelectedVariant(id)
                      }}
                      onOpenPen={(penId, viewId) => openPenSettings(viewId ?? scope.id, penId)}
                    />
                    {selectedVariantIds.length > 1 && (
                      <span className="trk-detail-hint">both apply to what you paint next</span>
                    )}
                  </div>
                )}

                {manage && <TrackingTagsPanel />}
              </div>
            </>
          }
          tools={
            <TrackingToolsTray
              paintTool={paintTool}
              onSelectPaintTool={(tool) =>
                setSelectedPen(nextPaintPenId(tool, selectedPenId, scope.pens[0]?.id ?? null))
              }
            />
          }
        />

        <div className="trk-status">
          <span>
            {visiblePens.length} pen{visiblePens.length === 1 ? "" : "s"}
            {hidden.size ? ` · ${hidden.size} hidden` : ""}
            {selectedPen
              ? ` · ${selectedPen.name}`
              : paintTool === "erase"
                ? " · erase — drag to clear minutes"
                : paintTool === "scissors"
                  ? " · scissors — click a minute to split"
                  : paintTool === "point"
                    ? " · point — click opens a block, never paints"
                  : ""}
          </span>
          <span>sorted {PEN_SORT_LABELS[sortMode].toLowerCase()}</span>
        </div>
      </div>

      {viewSettings && <TrackingViewSettingsDialog scopeId={scope.id} onClose={() => setViewSettings(false)} />}
    </div>
  )
}
