/**
 * components/Analytics/library/GraphGapsView.tsx — Missing and uncertain graph facts
 *
 * One slice: people, or items that already have a link (40 nodes). Recorded
 * `Item.links` stay solid. Reciprocal and triad suggestions, and people with
 * no links, stay labeled missing. Open inbox proposals stay uncertain.
 * Nothing here writes a link or fills a hole.
 */
"use client"

import { useMemo, useState } from "react"
import { reciprocalSource } from "@/lib/graph/densify/reciprocal"
import { triadSource } from "@/lib/graph/densify/triad"
import { useGraphInboxStore } from "@/lib/graph/graph-inbox-store"
import { linkIndexOf } from "@/lib/graph/link-index"
import type { GraphProposal } from "@/lib/graph/proposal-schema"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { relationLabel } from "@/lib/links"
import { PERSON_TYPE_ID } from "@/lib/person-types"
import { useTaskStore } from "@/lib/task-store"
import type { ItemRecord, Task } from "@/lib/types"
import { openItemsInLists } from "../studio/open-in-lists"
import { CanvasTitle } from "../studio/studio-kit"

const NODE_CAP = 40
const ZERO_LINK_CAP = 8
const SENTENCE_CAP = 8
/** Cool ink already used by the Tags library mosaic. */
const INK = "#3d6b99"

const EMPTY_SENTENCE = "No missing or uncertain graph facts in this slice."

type HoleKind = "missing" | "uncertain"

interface GraphHole {
  key: string
  kind: HoleKind
  itemId: string
  source: string
  text: string
}

interface EdgeRow {
  key: string
  status: "recorded" | HoleKind
  fromId: string
  toId: string
  text: string
}

function nameOf(item: { id: string; title?: string; description?: string } | undefined, id: string): string {
  return item ? itemTitleOrUntitled(item, id) : id
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/** People when any exist; otherwise items that already sit on a stored link. */
export function graphSlice(tasks: readonly Task[]): Task[] {
  const people = tasks.filter((task) => task.type === PERSON_TYPE_ID)
  const pool = people.length > 0 ? people : tasks.filter((task) => linkedIds(tasks).has(task.id))
  return [...pool]
    .sort((a, b) => nameOf(a, a.id).localeCompare(nameOf(b, b.id)) || a.id.localeCompare(b.id))
    .slice(0, NODE_CAP)
}

function linkedIds(tasks: readonly Task[]): Set<string> {
  const ids = new Set<string>()
  for (const task of tasks) {
    for (const link of task.links ?? []) {
      if (!link?.targetId || !link.relation || link.targetId === task.id) continue
      ids.add(task.id)
      ids.add(link.targetId)
    }
  }
  return ids
}

function proposalTouches(proposal: GraphProposal, ids: ReadonlySet<string>): boolean {
  if (proposal.status !== "open") return false
  if (proposal.kind === "link") {
    return (proposal.sourceId != null && ids.has(proposal.sourceId)) || (proposal.targetId != null && ids.has(proposal.targetId))
  }
  return proposal.sourceId != null && ids.has(proposal.sourceId)
}

export function buildGraphGaps(tasks: readonly Task[], proposals: readonly GraphProposal[]): {
  slice: Task[]
  holes: GraphHole[]
  recorded: EdgeRow[]
  missingCount: number
  uncertainCount: number
} {
  const slice = graphSlice(tasks)
  const sliceIds = new Set(slice.map((task) => task.id))
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const title = (id: string) => nameOf(byId.get(id), id)
  const links = linkIndexOf(tasks as readonly ItemRecord[])
  const ctx = { all: tasks as readonly ItemRecord[], links, title }
  const linked = linkedIds(tasks)
  const holes: GraphHole[] = []
  const seen = new Set<string>()

  for (const item of slice) {
    for (const suggestion of [...reciprocalSource(item, ctx), ...triadSource(item, ctx)]) {
      const key = `${suggestion.source}|${pairKey(item.id, suggestion.otherId)}|${suggestion.relation}`
      if (seen.has(key)) continue
      seen.add(key)
      holes.push({
        key,
        kind: "missing",
        itemId: item.id,
        source: suggestion.source,
        text: `${title(item.id)} and ${title(suggestion.otherId)}: missing ${relationLabel(suggestion.relation)} (${suggestion.source}). ${suggestion.reason}`,
      })
    }
  }

  const isolated = slice.filter((task) => !linked.has(task.id)).slice(0, ZERO_LINK_CAP)
  for (const item of isolated) {
    holes.push({
      key: `zero|${item.id}`,
      kind: "missing",
      itemId: item.id,
      source: "no stored links",
      text: `${title(item.id)}: missing links (no stored links).`,
    })
  }

  for (const proposal of proposals) {
    if (!proposalTouches(proposal, sliceIds)) continue
    const fromId = proposal.sourceId && byId.has(proposal.sourceId) ? proposal.sourceId : proposal.targetId && byId.has(proposal.targetId) ? proposal.targetId : ""
    const from = proposal.sourceId ? title(proposal.sourceId) : "A proposal"
    const to = proposal.targetId ? title(proposal.targetId) : ""
    const relation = proposal.relation ? relationLabel(proposal.relation) : "fact"
    const text = to
      ? `${from} and ${to}: uncertain ${relation} (proposal, not accepted). ${proposal.reason}`
      : `${proposal.reason} Uncertain (proposal, not accepted).`
    holes.push({
      key: `proposal|${proposal.id}`,
      kind: "uncertain",
      itemId: fromId,
      source: "proposal",
      text,
    })
  }

  const recorded: EdgeRow[] = []
  for (const item of slice) {
    for (const link of item.links ?? []) {
      if (!link?.targetId || !link.relation || link.targetId === item.id) continue
      recorded.push({
        key: `recorded|${link.id || `${item.id}|${link.relation}|${link.targetId}`}`,
        status: "recorded",
        fromId: item.id,
        toId: link.targetId,
        text: `${title(item.id)} · ${relationLabel(link.relation)} · ${title(link.targetId)}`,
      })
    }
  }

  return {
    slice,
    holes,
    recorded,
    missingCount: holes.filter((hole) => hole.kind === "missing").length,
    uncertainCount: holes.filter((hole) => hole.kind === "uncertain").length,
  }
}

function HoleButton({ hole, known }: { hole: GraphHole; known: boolean }) {
  if (!known || !hole.itemId) {
    return <p data-testid={`graph-hole-${hole.key}`}>{hole.text}</p>
  }
  return (
    <button
      type="button"
      data-testid={`graph-hole-${hole.key}`}
      onClick={() => openItemsInLists({ taskIds: [hole.itemId] })}
      style={{
        display: "block",
        width: "100%",
        margin: 0,
        padding: "4px 0",
        border: "none",
        background: "transparent",
        color: "var(--an-ink)",
        font: "inherit",
        fontSize: 12,
        textAlign: "left",
        cursor: "pointer",
      }}
    >
      {hole.text}
    </button>
  )
}

export function GraphGapsView() {
  const tasks = useTaskStore((s) => s.tasks)
  const proposals = useGraphInboxStore((s) => s.proposals)
  const [size, setSize] = useState<"small" | "large">("small")
  const facts = useMemo(() => buildGraphGaps(tasks, proposals), [tasks, proposals])
  const known = useMemo(() => new Set(tasks.map((task) => task.id)), [tasks])
  const sentences = facts.holes.slice(0, SENTENCE_CAP)
  const empty = facts.missingCount === 0 && facts.uncertainCount === 0
  const people = tasks.some((task) => task.type === PERSON_TYPE_ID)
  const holeRows = facts.holes.filter((hole) => hole.kind === "missing" || hole.kind === "uncertain")

  return (
    <div className="an-canvas an-stack" data-testid="graph-gaps-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Graph"
            help="Missing and uncertain facts in one slice: people, or items that already have a link, capped at 40. Suggestions stay labeled missing. Open proposals stay uncertain. A recorded link stays a recorded link."
          />
          <p className="an-canvas-kicker">
            {people ? "People" : "Items with a link"} · {facts.slice.length} in this slice
          </p>
        </div>
        <div className="an-studio-tools">
          <button type="button" className="an-chip" aria-pressed={size === "small"} onClick={() => setSize("small")}>
            Small
          </button>
          <button type="button" className="an-chip" aria-pressed={size === "large"} onClick={() => setSize("large")}>
            Large
          </button>
        </div>
      </header>
      <section className="an-plate" data-testid="graph-gaps-plate" aria-label="Graph gaps">
        {empty ? (
          <p>{EMPTY_SENTENCE}</p>
        ) : (
          <>
            <p data-testid="graph-gap-counts">
              Missing {facts.missingCount} · Uncertain {facts.uncertainCount}
            </p>
            <div>
              {sentences.map((hole) => (
                <HoleButton key={hole.key} hole={hole} known={known.has(hole.itemId)} />
              ))}
            </div>
          </>
        )}
        {size === "large" && (facts.recorded.length > 0 || holeRows.length > 0) && (
          <div className="an-split">
            {facts.recorded.length > 0 && (
              <div>
                <p className="an-canvas-kicker">Recorded</p>
                <ul aria-label="Recorded links" style={{ margin: 0, padding: 0 }}>
                  {facts.recorded.map((row) => (
                    <li
                      key={row.key}
                      data-testid={`graph-edge-recorded-${row.fromId}-${row.toId}`}
                      data-status="recorded"
                      style={{ padding: "4px 8px", color: INK, listStyle: "none" }}
                    >
                      {row.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {holeRows.length > 0 && (
              <div>
                <p className="an-canvas-kicker">Not stored</p>
                <ul aria-label="Missing and uncertain" style={{ margin: 0, padding: 0 }}>
                  {holeRows.map((hole) => (
                    <li
                      key={hole.key}
                      data-testid={`graph-edge-${hole.kind}-${hole.key}`}
                      data-status={hole.kind}
                      style={
                        hole.kind === "missing"
                          ? { outline: "1px dashed var(--an-line)", padding: "4px 8px", listStyle: "none" }
                          : { padding: "4px 8px", listStyle: "none", color: INK }
                      }
                    >
                      <span>{hole.kind}</span> {hole.text}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
