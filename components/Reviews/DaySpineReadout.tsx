/**
 * components/Reviews/DaySpineReadout.tsx — This week on the day spine
 *
 * Read-only. Triples come from `projectVault`. Same-as candidates are
 * offered into the graph inbox; Accept there writes the link. A belief
 * whose observation address is off the spine is listed. The belief is
 * not rewritten.
 */
"use client"

import { useMemo } from "react"
import { evidenceMissingFromSpine } from "@/lib/graph/evidence-watch"
import { identityCandidates, identityProposals } from "@/lib/graph/identity-match"
import { useGraphInboxStore } from "@/lib/graph/graph-inbox-store"
import { whereFrom } from "@/lib/graph/machinery"
import { answerHouseQuestion } from "@/lib/graph/pattern-questions"
import { projectVault, triplesForPeriod } from "@/lib/graph/vault-graph"
import { formatLocalDateKey, getWeekString } from "@/lib/date-utils"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

const WHERE = ["belief-strength", "list-membership", "pen-link-fill", "implied-action"]

export function DaySpineReadout() {
  const tasks = useTaskStore((s) => s.tasks)
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const reviews = useReviewsStore((s) => s.reviews)
  const events = useIngestStore((s) => s.events)
  const proposals = useGraphInboxStore((s) => s.proposals)
  const addProposals = useGraphInboxStore((s) => s.addProposals)
  const asOf = formatLocalDateKey(new Date())
  const week = `week:${getWeekString(new Date())}`

  const graph = useMemo(
    () => projectVault({ entries, scopes, items: tasks, reviews, events }),
    [entries, scopes, tasks, reviews, events],
  )
  const weekTriples = useMemo(() => triplesForPeriod(graph.triples, week).filter((triple) => triple.p !== "nested-in").slice(0, 5), [graph, week])
  const places = useMemo(() => answerHouseQuestion("places with one person", { graph }), [graph])
  const captures = useMemo(() => answerHouseQuestion("captures never linked", { graph }), [graph])
  const stale = useMemo(() => evidenceMissingFromSpine(tasks, graph.triples), [tasks, graph])
  const candidates = useMemo(
    () =>
      identityCandidates({
        items: tasks,
        scopes,
        dismissed: proposals.filter((row) => row.status === "dismissed"),
      }).filter((row) => !proposals.some((open) => open.status === "open" && open.relation === "same-as" && open.sourceId === row.sourceId && open.targetId === row.targetId)),
    [tasks, scopes, proposals],
  )
  const title = (id: string) => itemTitleOrUntitled(tasks.find((task) => task.id === id))
  const label = (address: string) => graph.labels[address] || address

  return (
    <div className="space-y-2" data-testid="day-spine">
      <h3 className="font-semibold text-sm">Day spine</h3>
      <p className="text-xs text-muted-foreground">
        {weekTriples.length ? `${triplesForPeriod(graph.triples, week).length} triples this week. Orders named on each row.` : "No dated triples this week."}
      </p>
      {weekTriples.length ? (
        <ul className="text-xs space-y-0.5">
          {weekTriples.map((triple) => (
            <li key={`${triple.s}|${triple.p}|${triple.o}|${triple.at ?? ""}`}>
              {label(triple.s)} · {triple.p} · {label(triple.o)} · {triple.order}
            </li>
          ))}
        </ul>
      ) : null}
      {places?.sentence ? <p className="text-xs">{places.sentence}</p> : null}
      {captures?.sentence ? <p className="text-xs">{captures.sentence}</p> : null}
      {stale.length ? (
        <>
          <p className="text-xs font-semibold">Evidence not on the spine</p>
          <ul className="text-xs space-y-0.5 text-muted-foreground">
            {stale.map((row) => (
              <li key={row.itemId}>
                {row.title}: {row.missing.join(", ")}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {candidates.length ? (
        <>
          <p className="text-xs font-semibold">Same person?</p>
          <ul className="text-xs space-y-0.5">
            {candidates.slice(0, 5).map((row) => (
              <li key={`${row.sourceId}|${row.targetId}`}>
                {title(row.sourceId)} · same as · {tasks.some((task) => task.id === row.targetId) ? title(row.targetId) : label(row.targetId) || row.targetId}
                <span className="text-muted-foreground"> — {row.reason} </span>
                <button type="button" className="underline" onClick={() => addProposals(identityProposals([row]))}>
                  Offer
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="text-xs font-semibold">Where from</p>
      <ul className="text-xs space-y-0.5 text-muted-foreground">
        {WHERE.map((id) => {
          const value = whereFrom(id)
          if (!value) return null
          return (
            <li key={id}>
              {value.label} is derived from {value.from.map((input) => input.label).join(", ")}.
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-muted-foreground">As of {asOf}. Habit cells and the GPS name file are not on this spine.</p>
    </div>
  )
}
