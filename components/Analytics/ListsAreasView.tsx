/**
 * components/Analytics/ListsAreasView.tsx — Category / list performance
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { openItemsInLists } from "./open-in-lists"
import { CanvasTitle, SliceTreemap, StudioBars, StudioReadout } from "./studio-kit"
import { allocationGini, listHerfindahl } from "./signal-stats"
import { LedgerTable, LibPlate, LibSearch, Meter, fmt } from "./library-kit"
import { areaRollup, summarize } from "./library-stats"

export function ListsAreasView() {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const { keySet, label } = useAnalyticsRange()
  const [mode, setMode] = useState<"size" | "rate" | "areas">("size")
  const [query, setQuery] = useState("")

  const rows = useMemo(() => {
    return lists
      .map((list) => {
        const items = tasks.filter((t) => t.lists?.includes(list.id))
        const done = items.filter((t) => t.completed).length
        const stalled = items.filter((t) => !t.completed && (t.daysPushed ?? 0) > 0).length
        const touched = items.filter((t) => inRange(t.completedDate ?? t.createdAt, keySet)).length
        const parent = list.parentListId ? lists.find((l) => l.id === list.parentListId) : undefined
        return {
          id: list.id,
          name: list.name,
          parent: parent?.name ?? "",
          color: list.color || "#2a9b8f",
          count: items.length,
          done,
          stalled,
          touched,
          rate: items.length ? Math.round((done / items.length) * 100) : 0,
        }
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [lists, tasks, keySet])
  const hhi = useMemo(() => listHerfindahl(rows.map((r) => r.count)), [rows])
  const gini = useMemo(() => allocationGini(rows.map((r) => r.count)), [rows])
  const sizes = summarize(rows.map((r) => r.count))
  const stalledTotal = rows.reduce((s, r) => s + r.stalled, 0)
  const areas = useMemo(() => areaRollup(lists, tasks), [lists, tasks])
  const ledgerRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.parent.toLowerCase().includes(q)) : rows
  }, [rows, query])

  const openList = (id: string) => {
    const ids = tasks.filter((t) => t.lists?.includes(id)).map((t) => t.id)
    openItemsInLists({ taskIds: ids })
  }

  return (
    <div className="an-canvas an-stack" data-testid="lists-areas">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Lists & areas"
            help="Size by items makes area proportional to how many items the list holds. Rate is completion % of those items. Click a tile to open that list in Lists."
          />
          <p className="an-canvas-kicker">{label} · click a list to open it</p>
        </div>
        <div className="an-studio-tools">
          <button
            type="button"
            className="an-chip"
            aria-pressed={mode === "size"}
            title="Area follows item count — bigger lists look bigger"
            onClick={() => setMode("size")}
          >
            Size by items
          </button>
          <button
            type="button"
            className="an-chip"
            aria-pressed={mode === "rate"}
            title="Bars show completion percent, independent of list size"
            onClick={() => setMode("rate")}
          >
            Completion rate
          </button>
          <button
            type="button"
            className="an-chip"
            aria-pressed={mode === "areas"}
            title="Lists grouped under their top parent list; one square per item"
            onClick={() => setMode("areas")}
          >
            Areas
          </button>
        </div>
      </header>
      {rows.length === 0 ? (
        <ChartFrame empty emptySentence="No lists with items yet." />
      ) : mode === "size" ? (
        <>
          <div className="an-readouts">
            <StudioReadout
              label="HHI"
              value={hhi.toFixed(3)}
              note={`${rows.length} lists`}
              tip="Herfindahl–Hirschman index of item counts: Σ sᵢ². 1/n is even; 1 means one list holds every item."
            />
            <StudioReadout
              label="Gini"
              value={fmt(gini)}
              note="0 even · 1 one list"
              tip="Gini of item counts across lists. Same question as HHI, read on a 0–1 scale that does not shift with the number of lists."
            />
            <StudioReadout label="Median list" value={fmt(sizes.median, 1)} note={`items · max ${sizes.max}`} />
            <StudioReadout
              label="Stalled"
              value={stalledTotal}
              note="open, pushed ≥ 1 day"
              tip="Open items with daysPushed > 0, summed over lists. An item on two lists counts twice."
            />
          </div>
          <SliceTreemap
            slices={rows.map((r) => ({
              id: r.id,
              name: r.name,
              color: r.color,
              minutes: r.count,
              label: `${r.count} · ${r.rate}% done`,
            }))}
            onSelect={openList}
          />
          <p className="an-canvas-hint">
            {rows.length} lists · {rows.reduce((s, r) => s + r.count, 0)} items. Area is proportional to count, not
            completion.
          </p>
          <OpenInListsButton taskIds={tasks.filter((t) => t.lists?.length).map((t) => t.id)} />
        </>
      ) : mode === "rate" ? (
        <>
          <StudioBars rows={rows.slice(0, 24).map((r) => ({ name: `${r.name} (${r.count})`, value: r.rate }))} max={100} />
          {rows.length > 24 ? <p className="an-canvas-hint">Top 24 lists by size. The ledger below has all {rows.length}.</p> : null}
          <OpenInListsButton taskIds={tasks.filter((t) => t.lists?.length).map((t) => t.id)} />
        </>
      ) : (
        <AreaSquares areas={areas} onOpen={openList} />
      )}
      {rows.length > 0 && (
        <LibPlate
          title="List ledger"
          note={`Every list with items. In ${label} counts items completed (or created, if open) in the current window. Click a header to sort, a row to open the list.`}
          tools={<LibSearch value={query} onChange={setQuery} label="Search lists" />}
        >
          <LedgerTable
            label="Lists"
            rows={ledgerRows}
            initialSort="count"
            onOpen={(r) => openList(r.id)}
            columns={[
              {
                key: "name",
                label: "List",
                value: (r) => r.name,
                render: (r) => (
                  <>
                    <span className="lib-dot" style={{ background: r.color }} aria-hidden />
                    {r.name}
                    {r.parent ? <span className="an-canvas-kicker"> · in {r.parent}</span> : null}
                  </>
                ),
              },
              { key: "count", label: "Items", value: (r) => r.count },
              { key: "done", label: "Done", value: (r) => r.done },
              {
                key: "rate",
                label: "Rate",
                value: (r) => r.rate,
                render: (r) => (
                  <>
                    {r.rate}%
                    <Meter share={r.rate / 100} />
                  </>
                ),
              },
              { key: "stalled", label: "Stalled", value: (r) => r.stalled, title: "Open items pushed at least one day" },
              { key: "touched", label: "In window", value: (r) => r.touched, title: `Completed or created in ${label}` },
            ]}
          />
        </LibPlate>
      )}
    </div>
  )
}

/** Sized squares: one box per area (top parent list), one cell per list, area ∝ items. */
function AreaSquares({
  areas,
  onOpen,
}: {
  areas: ReturnType<typeof areaRollup>
  onOpen: (id: string) => void
}) {
  if (areas.length === 0) return <ChartFrame empty emptySentence="No lists with items yet." />
  const max = Math.max(...areas.map((a) => a.count), 1)
  return (
    <LibPlate
      title="Areas"
      note="Each box is a top-level list with its sublists inside. Box area follows unique items in the area, so an item on two sublists counts once. Inner bands split the box by each list's own count. Click a cell to open that list."
    >
      <div className="lib-areas">
        {areas.map((area) => {
          const side = Math.round(36 + Math.sqrt(area.count / max) * 164)
          return (
            <div key={area.id} className="lib-area">
              <div className="lib-area-box" style={{ width: side, height: side }}>
                {area.lists.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    title={`${l.name}: ${l.count} items`}
                    aria-label={`${l.name}: ${l.count} items`}
                    onClick={() => onOpen(l.id)}
                    style={{ background: l.color, flex: `${l.count} 1 0`, minHeight: 3 }}
                  />
                ))}
              </div>
              <span className="lib-area-name" title={area.name}>
                <b>{area.name}</b> · {area.count}
                {area.lists.length > 1 ? ` · ${area.lists.length} lists` : ""}
              </span>
            </div>
          )
        })}
      </div>
    </LibPlate>
  )
}
