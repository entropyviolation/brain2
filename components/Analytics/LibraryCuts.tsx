/**
 * components/Analytics/LibraryCuts.tsx — Tags, stages, weight from Item/Task
 *
 * Reads fields already on items (tags, stage, importance, cognitiveLoad,
 * entropy). No new capture. Empty frames stay honest.
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { CanvasTitle, SliceTreemap, StudioBars, StudioReadout } from "./studio-kit"
import { UpsetChart } from "./studio-plots"
import { tagIntersections } from "./studio-plot-stats"
import { openItemsInLists } from "./open-in-lists"

const STAGE_LABEL: Record<string, string> = {
  inbox: "Inbox",
  clarified: "Clarified",
  scheduled: "Scheduled",
  completed: "Completed",
  list: "On a list",
}

const STAGE_COLOR: Record<string, string> = {
  inbox: "#c45c26",
  clarified: "#3d6b99",
  scheduled: "#0e6b66",
  completed: "#4a7c59",
  list: "#7a6a4f",
}

export function TagsView() {
  const tasks = useTaskStore((s) => s.tasks)
  const rows = useMemo(() => {
    const counts = new Map<string, { count: number; ids: string[] }>()
    for (const task of tasks) {
      for (const tag of task.tags ?? []) {
        const key = tag.trim()
        if (!key) continue
        const row = counts.get(key) ?? { count: 0, ids: [] }
        row.count += 1
        row.ids.push(task.id)
        counts.set(key, row)
      }
    }
    return [...counts.entries()]
      .map(([name, row]) => ({ id: name, name, ...row }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [tasks])

  return (
    <div className="an-canvas an-stack" data-testid="tags-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Tags"
            help="Free-form tags on items (spec §5). Area follows how many items carry the tag. Click a tile to open those items in Lists."
          />
          <p className="an-canvas-kicker">All items · area ∝ tagged count</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <ChartFrame empty emptySentence="No tags on items yet. Add tags in Lists." />
      ) : (
        <>
          <SliceTreemap
            slices={rows.map((r) => ({
              id: r.id,
              name: r.name,
              color: "#3d6b99",
              minutes: r.count,
              label: `${r.count}`,
            }))}
            onSelect={(id) => {
              const row = rows.find((r) => r.id === id)
              if (row) openItemsInLists({ taskIds: row.ids })
            }}
          />
          <StudioBars rows={rows.slice(0, 16).map((r) => ({ name: r.name, value: r.count }))} max={Math.max(...rows.map((r) => r.count), 1)} unit="" />
          <UpsetChart
            rows={tagIntersections(tasks)}
            universe={rows.map((r) => r.name)}
            title="Tag combinations"
            help="UpSet (Lex et al. 2014): each row is one exact set of tags on an item, not a superset. Area bars in the treemap above count a tag whenever it appears; this matrix counts co-occurrence. Click a row to open those items in Lists."
            empty="No tag combinations yet."
            onSelect={(ids) => openItemsInLists({ taskIds: ids })}
          />
          <OpenInListsButton taskIds={rows.flatMap((r) => r.ids)} />
        </>
      )}
    </div>
  )
}

export function StagesView() {
  const tasks = useTaskStore((s) => s.tasks)
  const rows = useMemo(() => {
    const buckets = new Map<string, { count: number; ids: string[] }>()
    for (const task of tasks) {
      const key = task.stage || "list"
      const row = buckets.get(key) ?? { count: 0, ids: [] }
      row.count += 1
      row.ids.push(task.id)
      buckets.set(key, row)
    }
    return [...buckets.entries()]
      .map(([id, row]) => ({
        id,
        name: STAGE_LABEL[id] ?? id,
        color: STAGE_COLOR[id] ?? "#7a6a4f",
        ...row,
      }))
      .sort((a, b) => b.count - a.count)
  }, [tasks])

  return (
    <div className="an-canvas an-stack" data-testid="stages-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Stages"
            help="Task.stage is the lifecycle bucket (inbox → clarified → scheduled → completed, or list). It is not the list the item belongs to."
          />
          <p className="an-canvas-kicker">Every item · area ∝ count</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <ChartFrame empty emptySentence="No items yet." />
      ) : (
        <>
          <SliceTreemap
            slices={rows.map((r) => ({
              id: r.id,
              name: r.name,
              color: r.color,
              minutes: r.count,
              label: `${r.count}`,
            }))}
            onSelect={(id) => {
              const row = rows.find((r) => r.id === id)
              if (row) openItemsInLists({ taskIds: row.ids })
            }}
          />
          <div className="an-readouts">
            {rows.map((r) => (
              <StudioReadout
                key={r.id}
                label={r.name}
                value={r.count}
                note={`${Math.round((r.count / tasks.length) * 100)}%`}
                tip={`${r.count} items in ${r.name}`}
              />
            ))}
          </div>
          <OpenInListsButton taskIds={tasks.map((t) => t.id)} />
        </>
      )}
    </div>
  )
}

function bucket(n: number | undefined, labels: string[]): { name: string; index: number } | null {
  if (n === undefined || !Number.isFinite(n)) return null
  const i = Math.max(0, Math.min(labels.length - 1, Math.round(n) - 1))
  return { name: labels[i], index: i }
}

export function WeightView() {
  const tasks = useTaskStore((s) => s.tasks)
  const importance = useMemo(() => countField(tasks, (t) => bucket(t.importance, ["1", "2", "3", "4", "5"])), [tasks])
  const load = useMemo(() => countField(tasks, (t) => bucket(t.cognitiveLoad, ["1 light", "2", "3 heavy"])), [tasks])
  const entropy = useMemo(
    () =>
      countField(tasks, (t) => {
        if (t.entropy === undefined || !Number.isFinite(t.entropy)) return null
        if (t.entropy < 0.34) return { name: "low", index: 0 }
        if (t.entropy < 0.67) return { name: "mid", index: 1 }
        return { name: "high", index: 2 }
      }),
    [tasks],
  )
  const missing = {
    importance: tasks.filter((t) => t.importance === undefined).length,
    load: tasks.filter((t) => t.cognitiveLoad === undefined).length,
    entropy: tasks.filter((t) => t.entropy === undefined).length,
  }
  const empty = importance.bars.length === 0 && load.bars.length === 0 && entropy.bars.length === 0

  return (
    <div className="an-canvas an-stack" data-testid="weight-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Weight"
            help="Importance (1–5), cognitive load (1–3), and entropy (0–1) already stored on items. Missing stays missing — this view does not invent scores."
          />
          <p className="an-canvas-kicker">Priority fields on items · not a ranking of lists</p>
        </div>
      </header>
      {empty ? (
        <ChartFrame empty emptySentence="No importance, cognitive load, or entropy values yet." />
      ) : (
        <>
          <div className="an-split">
            <div>
              <p className="an-canvas-kicker">Importance</p>
              {importance.bars.length === 0 ? (
                <ChartFrame empty emptySentence="No importance values." />
              ) : (
                <StudioBars rows={importance.bars} max={Math.max(...importance.bars.map((b) => b.value), 1)} unit="" />
              )}
            </div>
            <div>
              <p className="an-canvas-kicker">Cognitive load</p>
              {load.bars.length === 0 ? (
                <ChartFrame empty emptySentence="No cognitive load values." />
              ) : (
                <StudioBars rows={load.bars} max={Math.max(...load.bars.map((b) => b.value), 1)} unit="" />
              )}
            </div>
            <div>
              <p className="an-canvas-kicker">Entropy</p>
              {entropy.bars.length === 0 ? (
                <ChartFrame empty emptySentence="No entropy values." />
              ) : (
                <StudioBars rows={entropy.bars} max={Math.max(...entropy.bars.map((b) => b.value), 1)} unit="" />
              )}
            </div>
          </div>
          <p className="an-canvas-hint">
            Missing: importance {missing.importance} · load {missing.load} · entropy {missing.entropy} of {tasks.length}{" "}
            items. Those rows are not treated as zero.
          </p>
          <OpenInListsButton taskIds={[...importance.ids, ...load.ids, ...entropy.ids]} />
        </>
      )}
    </div>
  )
}

function countField(
  tasks: { id: string }[],
  pick: (t: (typeof tasks)[number] & { importance?: number; cognitiveLoad?: number; entropy?: number }) => {
    name: string
    index: number
  } | null,
): { bars: { name: string; value: number }[]; ids: string[] } {
  const counts = new Map<string, number>()
  const ids: string[] = []
  for (const task of tasks) {
    const hit = pick(task)
    if (!hit) continue
    counts.set(hit.name, (counts.get(hit.name) ?? 0) + 1)
    ids.push(task.id)
  }
  return {
    bars: [...counts.entries()].map(([name, value]) => ({ name, value })),
    ids,
  }
}
