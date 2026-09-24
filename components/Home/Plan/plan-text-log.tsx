/**
 * components/Home/Plan/plan-text-log.tsx — Plan append log
 *
 * Day / Week / Month Plan composer. Submit plan stamps the writing time onto
 * the shared append log (`lib/append-log.ts`). Unsubmitted plaintext is stored
 * on the same period key as `draft` so a refresh keeps the writing. List /
 * Bulk / Latest; past entries cannot be edited.
 */
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AppendLog } from "@/components/append-log"
import {
  appendPlanEntry,
  getPlanDraft,
  getPlanEntries,
  hydratePlanText,
  savePlanDraft,
  subscribePlanText,
  type PlanEntry,
  type PlanTextPeriod,
} from "@/lib/plan-text"
import type { UiNameStamp } from "@/components/append-log"

export const PLAN_DOCS = "components/Home/Plan/README.md"

export const PLAN_PERIOD_STAMPS: Record<PlanTextPeriod, UiNameStamp> = {
  month: {
    name: "Month Plan",
    help: "Monthly written plan log. Submit stamps an entry — not the calendar and not the event chips.",
    docs: PLAN_DOCS,
    docsAnchor: "month",
  },
  week: {
    name: "Week Plan",
    help: "Weekly written plan log. Submit stamps an entry — not the week grid.",
    docs: PLAN_DOCS,
    docsAnchor: "week",
  },
  day: {
    name: "Day Plan",
    help: "Daily written plan log. Submit stamps an entry — not the hour schedule.",
    docs: PLAN_DOCS,
    docsAnchor: "day",
  },
}

export const PLAN_LOG_STAMP: UiNameStamp = {
  name: "Plan log",
  help: "List and Latest stream of stamped plan entries (newest first, read-only).",
  docs: PLAN_DOCS,
}

export const PLAN_BULK_STAMP: UiNameStamp = {
  name: "Plan bulk",
  help: "All stamped plan entries as copy-only text.",
  docs: PLAN_DOCS,
}

export function planPeriodStampProps(period: PlanTextPeriod) {
  const stamp = PLAN_PERIOD_STAMPS[period]
  return {
    "data-ui-name": stamp.name,
    "data-ui-help": stamp.help,
    "data-ui-docs": stamp.docs,
    "data-ui-docs-anchor": stamp.docsAnchor,
  }
}

interface PlanTextLogProps {
  period: PlanTextPeriod
  periodKey: string
  placeholder: string
  size?: "day" | "period" | "compact"
  composerTestId?: string
}

const DRAFT_DEBOUNCE_MS = 0

export function PlanTextLog({
  period,
  periodKey,
  placeholder,
  size = "period",
  composerTestId,
}: PlanTextLogProps) {
  const [entries, setEntries] = useState<PlanEntry[]>(() => getPlanEntries(period, periodKey))
  const [draftEpoch, setDraftEpoch] = useState(0)
  const draftRef = useRef(getPlanDraft(period, periodKey))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reload = useCallback(() => {
    setEntries(getPlanEntries(period, periodKey))
  }, [period, periodKey])

  const flushDraft = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    savePlanDraft(period, periodKey, draftRef.current)
  }, [period, periodKey])

  useEffect(() => {
    draftRef.current = getPlanDraft(period, periodKey)
    reload()
    void hydratePlanText(period, periodKey).then(() => {
      reload()
      const incoming = getPlanDraft(period, periodKey)
      if (incoming && !draftRef.current) {
        draftRef.current = incoming
        setDraftEpoch((n) => n + 1)
      }
    })
  }, [period, periodKey, reload])

  useEffect(() => subscribePlanText(reload), [reload])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushDraft()
    }
    const onUnload = () => flushDraft()
    document.addEventListener("visibilitychange", onHide)
    window.addEventListener("pagehide", onUnload)
    window.addEventListener("beforeunload", onUnload)
    return () => {
      flushDraft()
      document.removeEventListener("visibilitychange", onHide)
      window.removeEventListener("pagehide", onUnload)
      window.removeEventListener("beforeunload", onUnload)
    }
  }, [flushDraft])

  return (
    <AppendLog
      logKey={`${period}:${periodKey}:${draftEpoch}`}
      entries={entries}
      initialDraft={getPlanDraft(period, periodKey)}
      onDraftChange={(text) => {
        draftRef.current = text
        if (DRAFT_DEBOUNCE_MS <= 0) {
          savePlanDraft(period, periodKey, text)
          return
        }
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => {
          timerRef.current = null
          savePlanDraft(period, periodKey, text)
        }, DRAFT_DEBOUNCE_MS)
      }}
      onSubmit={(text, at) => {
        if (timerRef.current) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        draftRef.current = ""
        appendPlanEntry(period, periodKey, text, at)
      }}
      placeholder={placeholder}
      submitLabel="Submit plan"
      emptyHint="No plan entries yet. Submit to freeze this writing time."
      size={size}
      composerTestId={composerTestId}
      composerAriaLabel="New plan entry"
      bulkAriaLabel="All plan entries, copy only"
      viewsAriaLabel="How to show plan entries"
      rootStamp={PLAN_PERIOD_STAMPS[period]}
      logStamp={PLAN_LOG_STAMP}
      bulkStamp={PLAN_BULK_STAMP}
    />
  )
}
