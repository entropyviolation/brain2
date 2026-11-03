/**
 * components/Reviews/PlanLogGlimpse.tsx — What the Plan tab already holds
 *
 * Read-only list of a period's plan-log entries (`lib/plan-text.ts`), shown in
 * the morning and start rituals so the plan you write here is visibly the same
 * log as Plan → Day / Week / Month / Season. A ritual's own entries carry their
 * label (`WEEK START PLAN:`) before the body.
 */
"use client"

import { useEffect, useState } from "react"
import { formatAppendStamp, planLogLabel, sortAppendLogNewestFirst } from "@/lib/append-log"
import { getPlanEntries, subscribePlanText, type PlanEntry, type PlanTextPeriod } from "@/lib/plan-text"

export function PlanLogGlimpse({
  period,
  periodKey,
  heading,
}: {
  period: PlanTextPeriod
  periodKey: string
  heading: string
}) {
  const [entries, setEntries] = useState<PlanEntry[]>([])
  useEffect(() => {
    const load = () => setEntries(sortAppendLogNewestFirst(getPlanEntries(period, periodKey)))
    load()
    return subscribePlanText(load)
  }, [period, periodKey])
  if (entries.length === 0) return null
  return (
    <details className="rv-plan-glimpse">
      <summary>
        {heading} · {entries.length} {entries.length === 1 ? "entry" : "entries"} already
      </summary>
      <ol>
        {entries.map((entry) => (
          <li key={entry.id}>
            <span className="rv-plan-glimpse-stamp">
              {formatAppendStamp(entry.createdAt)}
              {entry.stampSuffix ? <strong>{planLogLabel(entry.stampSuffix)}</strong> : null}
            </span>
            <pre>{entry.text}</pre>
          </li>
        ))}
      </ol>
    </details>
  )
}
