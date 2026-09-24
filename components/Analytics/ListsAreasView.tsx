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
import { listHerfindahl } from "./signal-stats"

export function ListsAreasView() {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const { keySet, label } = useAnalyticsRange()
  const [mode, setMode] = useState<"size" | "rate">("size")

  const rows = useMemo(() => {
    return lists
      .map((list) => {
        const items = tasks.filter((t) => t.lists?.includes(list.id))
        const done = items.filter((t) => t.completed).length
        const stalled = items.filter((t) => !t.completed && (t.daysPushed ?? 0) > 0).length
        const touched = items.filter((t) => inRange(t.completedDate ?? t.createdAt, keySet)).length
        return {
          id: list.id,
          name: list.name,
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
      ) : (
        <>
          <StudioBars rows={rows.slice(0, 24).map((r) => ({ name: r.name, value: r.rate }))} max={100} />
          <OpenInListsButton taskIds={tasks.filter((t) => t.lists?.length).map((t) => t.id)} />
        </>
      )}
    </div>
  )
}
