/**
 * components/Analytics/LibraryCuts.tsx — Tags, stages, weight from Item/Task
 *
 * Reads fields already on items (tags, stage, importance, cognitiveLoad,
 * entropy). No new capture. Empty frames stay honest.
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { CanvasTitle, SliceTreemap, StudioBars, StudioCheck, StudioReadout } from "./studio-kit"
import { LedgerTable, LibPlate, LibSearch, LibSlider, QuadrantGrid, StepHeights, fmt } from "./library-kit"
import { crossTab, shannon, spearman, stageSteps, STAGE_ORDER, summarize, tagPairs, type TagPair } from "./library-stats"
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
  const [query, setQuery] = useState("")
  const [minCount, setMinCount] = useState(1)
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => r.count >= minCount && (!q || r.name.toLowerCase().includes(q)))
  }, [rows, query, minCount])
  const taggedItems = useMemo(() => tasks.filter((t) => (t.tags ?? []).some((x) => x.trim())), [tasks])
  const perItem = summarize(taggedItems.map((t) => new Set((t.tags ?? []).map((x) => x.trim()).filter(Boolean)).size))
  const spread = shannon(rows.map((r) => r.count))
  const pairs = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tagPairs(tasks, Math.max(1, minCount))
      .filter((p) => !q || p.a.toLowerCase().includes(q) || p.b.toLowerCase().includes(q))
      .map((p) => ({ ...p, id: `${p.a}|${p.b}` }))
  }, [tasks, query, minCount])
  const maxCount = rows[0]?.count ?? 1

  return (
    <div className="an-canvas an-stack" data-testid="tags-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Tags"
            help="Item tags — free-form names on items (spec §5), not tracked-minute tags from Time → Tracking. Area follows how many items carry the name. Click a tile to open those items in Lists."
          />
          <p className="an-canvas-kicker">Item tags · area ∝ how many items carry the name</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <ChartFrame empty emptySentence="No tags on items yet. Add tags in Lists." />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Tags" value={rows.length} note="distinct names" />
            <StudioReadout
              label="Tagged"
              value={`${Math.round((taggedItems.length / Math.max(tasks.length, 1)) * 100)}%`}
              note={`${taggedItems.length} of ${tasks.length} items`}
            />
            <StudioReadout
              label="Tags / item"
              value={fmt(perItem.mean, 1)}
              note={`median ${fmt(perItem.median, 1)} · max ${perItem.max}`}
              tip="Distinct tags per tagged item. Untagged items are left out."
            />
            <StudioReadout
              label="Evenness"
              value={fmt(spread.evenness)}
              note={`H = ${fmt(spread.bits)} bits`}
              tip="Pielou J = H / log2(k). 1 means every tag is used equally; near 0 means one tag carries almost everything."
            />
          </div>
          <div className="lib-tools">
            <LibSearch value={query} onChange={setQuery} label="Search tags" />
            <LibSlider label="Min items" value={minCount} min={1} max={maxCount} onChange={setMinCount} />
            <span className="an-canvas-hint">
              {shown.length} of {rows.length} tags shown
            </span>
          </div>
          {shown.length === 0 ? (
            <ChartFrame empty emptySentence="No tags match this search and minimum." />
          ) : (
          <SliceTreemap
            slices={shown.map((r, i) => ({
              id: r.id,
              name: r.name,
              // One hue, darker for more-used tags, so neighbours stay apart.
              color: mixHex("#1f4a75", "#7fa3c9", i / Math.max(shown.length - 1, 1)),
              minutes: r.count,
              label: `${r.count}`,
            }))}
            onSelect={(id) => {
              const row = rows.find((r) => r.id === id)
              if (row) openItemsInLists({ taskIds: row.ids })
            }}
          />
          )}
          <StudioBars rows={shown.slice(0, 16).map((r) => ({ name: r.name, value: r.count }))} max={Math.max(...rows.map((r) => r.count), 1)} unit="" />
          {shown.length > 16 ? <p className="an-canvas-hint">Bars show the top 16 of {shown.length}. The treemap shows all.</p> : null}
          <UpsetChart
            rows={tagIntersections(tasks)}
            universe={rows.map((r) => r.name)}
            title="Tag combinations"
            help="UpSet (Lex et al. 2014): each row is one exact set of tags on an item, not a superset. Area bars in the treemap above count a tag whenever it appears; this matrix counts co-occurrence. Click a row to open those items in Lists."
            empty="No tag combinations yet."
            onSelect={(ids) => openItemsInLists({ taskIds: ids })}
          />
          <TagPairsPlate pairs={pairs} />
          <OpenInListsButton taskIds={[...new Set(rows.flatMap((r) => r.ids))]} />
        </>
      )}
    </div>
  )
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  return `#${pa.map((v, k) => Math.round(v + (pb[k] - v) * t).toString(16).padStart(2, "0")).join("")}`
}

function TagPairsPlate({ pairs }: { pairs: (TagPair & { id: string })[] }) {
  return (
    <LibPlate
      title="Tag pairs"
      note="Which tags travel together. Jaccard = shared ÷ either (0–1). Lift = how much more often the pair shows up than if the two tags were independent; above 1 means they attract, below 1 means they avoid each other. Counts over tagged items. Click a row to open those items."
    >
      {pairs.length === 0 ? (
        <ChartFrame empty emptySentence="No two tags share an item at this minimum." />
      ) : (
        <LedgerTable
          label="Tag pairs"
          rows={pairs.slice(0, 200)}
          initialSort="count"
          onOpen={(p) => openItemsInLists({ taskIds: p.ids })}
          columns={[
            { key: "pair", label: "Pair", value: (p) => `${p.a} + ${p.b}` },
            { key: "count", label: "Items", value: (p) => p.count },
            { key: "jaccard", label: "Jaccard", value: (p) => p.jaccard, render: (p) => fmt(p.jaccard) },
            { key: "lift", label: "Lift", value: (p) => p.lift, render: (p) => `${fmt(p.lift, 1)}×` },
          ]}
        />
      )}
    </LibPlate>
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
  const steps = useMemo(() => stageSteps(tasks), [tasks])
  const lifecycle = steps.filter((st) => (STAGE_ORDER as readonly string[]).includes(st.id))
  const ageNote = (st: { id: string; medianDays: number | null }) =>
    st.medianDays === null ? undefined : st.id === "completed" ? `median ${fmt(st.medianDays, 1)}d to finish` : `median ${fmt(st.medianDays, 1)}d old`
  const lifecycleOrder = (id: string) => {
    const i = steps.findIndex((st) => st.id === id)
    return i < 0 ? 99 : i
  }

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
            {rows
              .slice()
              .sort((a, b) => lifecycleOrder(a.id) - lifecycleOrder(b.id))
              .map((r) => {
                const age = ageNote(steps.find((st) => st.id === r.id) ?? { id: r.id, medianDays: null })
                return (
                  <StudioReadout
                    key={r.id}
                    label={r.name}
                    value={r.count}
                    note={`${Math.round((r.count / tasks.length) * 100)}%${age ? ` · ${age}` : ""}`}
                    tip={`${r.count} items in ${r.name}. Age is days since created (open) or created → completed.`}
                  />
                )
              })}
          </div>
          <LibPlate
            title="Step heights"
            note="Lifecycle order, left to right. Each step is as tall as its count. Between steps: the change in items and the next step as a share of the one before. This is a snapshot of where items sit now, not a flow over time. On a list sits outside the lifecycle and is left off."
          >
            <StepHeights
              steps={lifecycle.map((st) => ({
                id: st.id,
                name: STAGE_LABEL[st.id] ?? st.id,
                color: STAGE_COLOR[st.id] ?? "#7a6a4f",
                count: st.count,
                note: ageNote(st),
                ids: st.ids,
              }))}
              onSelect={(ids) => openItemsInLists({ taskIds: ids })}
            />
          </LibPlate>
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
  const [openOnly, setOpenOnly] = useState(false)
  const pool = useMemo(() => (openOnly ? tasks.filter((t) => !t.completed) : tasks), [tasks, openOnly])
  const cells = useMemo(
    () =>
      crossTab(
        pool,
        (t) => (t.cognitiveLoad === undefined || !Number.isFinite(t.cognitiveLoad) ? null : Math.max(1, Math.min(3, Math.round(t.cognitiveLoad)))),
        (t) => (t.importance === undefined || !Number.isFinite(t.importance) ? null : Math.max(1, Math.min(5, Math.round(t.importance)))),
      ),
    [pool],
  )
  const paired = pool.filter((t) => Number.isFinite(t.importance) && Number.isFinite(t.cognitiveLoad))
  const rho = spearman(
    paired.map((t) => t.importance as number),
    paired.map((t) => t.cognitiveLoad as number),
  )
  const imp = summarize(pool.map((t) => t.importance as number).filter((v) => Number.isFinite(v)))
  const ld = summarize(pool.map((t) => t.cognitiveLoad as number).filter((v) => Number.isFinite(v)))
  const ent = summarize(pool.map((t) => t.entropy as number).filter((v) => Number.isFinite(v)))

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
          <div className="an-readouts">
            <StudioReadout label="Importance" value={fmt(imp.mean, 1)} note={`mean · n ${imp.n}`} tip={`Median ${fmt(imp.median, 1)}, SD ${fmt(imp.sd)}`} />
            <StudioReadout label="Load" value={fmt(ld.mean, 1)} note={`mean · n ${ld.n}`} tip={`Median ${fmt(ld.median, 1)}, SD ${fmt(ld.sd)}`} />
            <StudioReadout label="Entropy" value={fmt(ent.median)} note={`median · n ${ent.n}`} tip={`IQR ${fmt(ent.q1)}–${fmt(ent.q3)}`} />
            <StudioReadout
              label="Rank corr."
              value={rho === null ? "—" : fmt(rho)}
              note={`Spearman ρ, imp × load · n ${paired.length}`}
              tip="Rank correlation of importance and cognitive load on items that have both. Near 0: what matters is not what is heavy. Positive: important things tend to be hard."
            />
          </div>
          <LibPlate
            title="Importance × load"
            note="Each bubble is a cell of the grid; area follows how many items sit there. Only items with both fields count. Click a bubble to open those items."
            tools={
              <StudioCheck id="weight-open-only" checked={openOnly} onChange={setOpenOnly} title="Leave completed items out">
                Open only
              </StudioCheck>
            }
          >
            {cells.length === 0 ? (
              <ChartFrame empty emptySentence="No items have both importance and cognitive load." />
            ) : (
              <>
                <QuadrantGrid
                  cells={cells}
                  xs={[1, 2, 3].map((v) => ({ value: v, label: v === 1 ? "1 light" : v === 3 ? "3 heavy" : "2" }))}
                  ys={[1, 2, 3, 4, 5].map((v) => ({ value: v, label: String(v) }))}
                  xLabel="Cognitive load"
                  yLabel="Importance"
                  zone={weightZone}
                  onSelect={(ids) => openItemsInLists({ taskIds: ids })}
                />
                <ul className="lib-quad-legend">
                  {WEIGHT_ZONES.map((z) => {
                    const zoneCells = cells.filter((c) => weightZone(c.x, c.y) === z.id)
                    const n = zoneCells.reduce((sum, c) => sum + c.count, 0)
                    // Do some corners slip more? Mean days pushed of the corner's items.
                    const zoneIds = new Set(zoneCells.flatMap((c) => c.ids))
                    const pushed = summarize(pool.filter((t) => zoneIds.has(t.id)).map((t) => t.daysPushed ?? 0))
                    return (
                      <li key={z.id} title="Mean days pushed of the items in this corner">
                        <b>{z.name}</b> · {n} — {z.hint}
                        {pushed.n ? ` · pushed ${fmt(pushed.mean, 1)}d avg` : ""}
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </LibPlate>
          <OpenInListsButton taskIds={[...new Set([...importance.ids, ...load.ids, ...entropy.ids])]} />
        </>
      )}
    </div>
  )
}

const WEIGHT_ZONES = [
  { id: "hi-lo", name: "Quick wins", hint: "importance 4–5, load 1" },
  { id: "hi-hi", name: "Big lifts", hint: "importance 4–5, load 3" },
  { id: "lo-hi", name: "Heavy chores", hint: "importance 1–2, load 3" },
  { id: "lo-lo", name: "Filler", hint: "importance 1–2, load 1" },
] as const

function weightZone(load: number, importance: number): string {
  const hi = importance >= 4
  const lo = importance <= 2
  if (load <= 1 && hi) return "hi-lo"
  if (load >= 3 && hi) return "hi-hi"
  if (load >= 3 && lo) return "lo-hi"
  if (load <= 1 && lo) return "lo-lo"
  return "mid"
}

function countField(
  tasks: { id: string }[],
  pick: (t: (typeof tasks)[number] & { importance?: number; cognitiveLoad?: number; entropy?: number }) => {
    name: string
    index: number
  } | null,
): { bars: { name: string; value: number }[]; ids: string[] } {
  const counts = new Map<string, { value: number; index: number }>()
  const ids: string[] = []
  for (const task of tasks) {
    const hit = pick(task)
    if (!hit) continue
    const row = counts.get(hit.name) ?? { value: 0, index: hit.index }
    row.value += 1
    counts.set(hit.name, row)
    ids.push(task.id)
  }
  // Scale order (1 → 5, low → high), not first-seen order.
  return {
    bars: [...counts.entries()].sort((a, b) => a[1].index - b[1].index).map(([name, row]) => ({ name, value: row.value })),
    ids,
  }
}
