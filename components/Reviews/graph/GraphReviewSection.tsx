/**
 * components/Reviews/graph/GraphReviewSection.tsx — Weekly graph review
 * (LINKS_REDESIGN L9.1, L9.2). Describe first: link edits per week,
 * linkability per type, mean clustering. Infer second: five vault-wide
 * suggestions, the newest checks, and the open inbox count. Read-only:
 * opening an item is the way to act on a row. The day spine under it is the
 * same: Offer sends a same-as proposal to the inbox, and Accept there writes.
 */
"use client"

import { useMemo } from "react"
import { graphQuality } from "@/lib/graph/graph-quality"
import { graphReview, linkEditsByWeek } from "@/lib/graph/graph-review"
import { coTimeRows } from "@/lib/graph/densify/co-time-rows"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useGraphInboxStore } from "@/lib/graph/graph-inbox-store"
import { useLinksViewStore } from "@/lib/graph/links-view-store"
import { allItemActivity } from "@/lib/item-activity"
import { useItemTypeStore } from "@/lib/item-type-store"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { relationLabel } from "@/lib/links"
import { useTaskStore } from "@/lib/task-store"
import { DaySpineReadout } from "@/components/Reviews/graph/DaySpineReadout"

export function GraphReviewSection() {
  const tasks = useTaskStore((s) => s.tasks)
  const types = useItemTypeStore((s) => s.types)
  const muted = useLinksViewStore((s) => s.mutedSources)
  const proposals = useGraphInboxStore((s) => s.proposals)
  const open = proposals.filter((p) => p.status === "open").length
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const title = (id: string) => itemTitleOrUntitled(byId.get(id))
  const review = useMemo(() => graphReview(tasks, title, muted), [tasks, muted]) // eslint-disable-line react-hooks/exhaustive-deps
  const quality = useMemo(
    () => graphQuality({ tasks, title, proposals, muted, coTimeFor: (item) => coTimeRows(item, tasks, entries, scopes) }),
    [tasks, title, proposals, muted, entries, scopes],
  )
  const strip = useMemo(() => linkEditsByWeek(allItemActivity()), [tasks])
  const max = Math.max(1, ...strip.map((w) => w.edits))
  const typeName = (id: string) => types.find((t) => t.id === id)?.name ?? id

  return (
    <div className="space-y-2" data-testid="graph-review">
      <h3 className="font-semibold text-sm">Links</h3>
      <div className="flex items-end gap-1 h-8" aria-label="Link edits per week">
        {strip.map((w) => (
          <span key={w.week} title={`${w.week}: ${w.edits} link edit${w.edits === 1 ? "" : "s"}`} style={{ width: 10, height: `${(w.edits / max) * 100}%`, minHeight: 1, background: "currentColor", opacity: 0.45 }} />
        ))}
        <span className="text-xs text-muted-foreground ml-2">link edits, last 8 weeks</span>
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        {review.linkability.slice(0, 4).map((r) => `${typeName(r.type)} ${r.linked}/${r.total} linked`).join(" · ")}
        {review.meanClustering === null ? "" : ` · mean C ${review.meanClustering.toFixed(2)}`}
      </p>
      {review.suggestions.length ? (
        <>
          <p className="text-xs font-semibold">Might be missing</p>
          <ul className="text-xs space-y-0.5">
            {review.suggestions.map((s) => (
              <li key={`${s.fromId}|${s.key}`}>
                {title(s.fromId)} · {relationLabel(s.relation)} · {title(s.otherId)} <span className="text-muted-foreground">— {s.reason}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {review.checks.length ? (
        <>
          <p className="text-xs font-semibold">Checks</p>
          <ul className="text-xs space-y-0.5 text-muted-foreground">
            {review.checks.map((c) => (
              <li key={c.line}>{c.line}</li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="text-xs text-muted-foreground">{open} open proposal{open === 1 ? "" : "s"} in the inbox (Item types → Relations → Inbox).</p>
      <div data-testid="graph-quality">
        <QualityCount label="Beliefs with no evidence" rows={quality.unsupportedBeliefs} />
        <QualityCount label="Sources never linked" rows={quality.unlinkedSources} />
        <QualityCount label="Functional collisions" rows={quality.functionalCollisions} />
        <QualityCount label="Open same-as" rows={quality.openIdentity} />
        <QualityCount label="Noisy suggestion sources" rows={quality.noisySources} />
      </div>
      <DaySpineReadout />
    </div>
  )
}

function QualityCount({ label, rows }: { label: string; rows: { id: string; line: string }[] }) {
  return (
    <details className="text-xs">
      <summary>
        {label} · {rows.length}
      </summary>
      {rows.length ? (
        <ul className="space-y-0.5 text-muted-foreground">
          {rows.slice(0, 12).map((row) => (
            <li key={row.id}>{row.line}</li>
          ))}
          {rows.length > 12 ? <li>and {rows.length - 12} more</li> : null}
        </ul>
      ) : null}
    </details>
  )
}
