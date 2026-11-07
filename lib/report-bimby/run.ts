/**
 * lib/report-bimby/run.ts — BIM chat's door to the Report BIMBY
 *
 * `tryReport` is called by `sendToBim` ahead of the router. A line that reads as a status report
 * ("started my period, took 1 adderall, only 3 left, been on youtube for hours") becomes a plan in
 * `useReportStore` and a short chat line pointing at it. It writes nothing: every change waits for
 * an accept on the card. Rules only, so it works with no model; Chrome history is read from the
 * visits kept on this computer. Null leaves the line to the rest of the chat.
 */
"use client"

import { loadKeptVisits } from "@/lib/browser-history-store"
import type { Visit } from "@/lib/browser-history"
import { INVENTORY_QTY_ATTR, findInventoryList } from "@/lib/ingest/apply-inventory"
import { resolveName } from "@/lib/ingest/name-resolve"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { looksLikeReport, parseReport } from "./parse"
import { buildPlan, type PlanDeps } from "./plan"
import { useReportStore } from "./store"

const TWELVE_HOURS = 12 * 60 * 60_000

async function keptVisits(): Promise<Visit[] | null> {
  if (typeof indexedDB === "undefined") return null
  try {
    const visits = await Promise.race([loadKeptVisits(), new Promise<null>((r) => setTimeout(() => r(null), 3000))])
    return visits && visits.length ? visits : null
  } catch {
    return null
  }
}

export function storeDeps(visits: Visit[] | null): PlanDeps {
  return {
    visits,
    inventory: (name) => {
      const list = findInventoryList()
      if (!list) return null
      const items = useTaskStore.getState().tasks.filter((t) => t.lists?.includes(list.id))
      const hit = resolveName(name, items.map((i) => ({ id: i.id, name: itemTitleOrUntitled(i) })))
      if (hit.status !== "match") return null
      const item = items.find((i) => i.id === hit.candidate.id)!
      const qty = Number(item.attributes?.[INVENTORY_QTY_ATTR])
      return { name: itemTitleOrUntitled(item), qty: Number.isFinite(qty) && qty >= 0 ? qty : 1 }
    },
    lastTrackedEnd: (beforeMs) => {
      let best: number | null = null
      for (const e of useTimeTrackingStore.getState().entries) {
        if (e.scopeId !== "activity" || e.kind === "instant" || e.endMin <= e.startMin) continue
        const [y, m, d] = e.date.split("-").map(Number)
        const end = new Date(y!, m! - 1, d!).getTime() + e.endMin * 60_000
        if (end <= beforeMs && end > beforeMs - TWELVE_HOURS && (best === null || end > best)) best = end
      }
      return best
    },
    matchPen: (label) => {
      const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")
      if (!scope) return null
      const hit = resolveName(label, scope.pens.map((p) => ({ id: p.id, name: p.name })))
      return hit.status === "match" ? hit.candidate.name : null
    },
  }
}

export interface ReportReply {
  text: string
  reportId: string
  route: string
}

export async function tryReport(text: string, now: Date): Promise<ReportReply | null> {
  if (!looksLikeReport(text)) return null
  const started = Date.now()
  const plan = buildPlan(text, parseReport(text), now, storeDeps(await keptVisits()))
  if (!plan.effects.length) return null
  useReportStore.getState().put(plan)
  const n = plan.effects.length
  return {
    text: `I read that as ${n} change${n === 1 ? "" : "s"}. Nothing is saved yet: open each one to see why, edit it, then accept or reject.`,
    reportId: plan.id,
    route: `REPORT · rules · ${((Date.now() - started) / 1000).toFixed(1)}s`,
  }
}
