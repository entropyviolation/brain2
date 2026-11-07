/**
 * lib/module-session-apply.ts — Paint a module's session onto the pens that follow it
 *
 * A pen in the Activity view with `moduleFeed: { moduleId }` is fed by that module's sessions. When
 * reading stops in Speed Read, the session is checked, the Book is found or created (the same
 * door as the page reports), and each fed pen gets a time block with the note from
 * `sessionBlocks`. Blocks are stamped `generatedBy: llm / module:<module>:<session id>` and
 * `createdBy.surface = "module"`, so a repeat of the same session replaces its own block and a
 * sweep can find them. They layer over other time like any generated block; painted time is not
 * overwritten (Tracking's overlap handling applies). Counting-as is the pen's parents, so the time
 * also reads as Reading wherever Reading is shown.
 */
import { runAsAction, withoutUndo } from "@/lib/action-history"
import { withItemWriteSource } from "@/lib/item-write-source"
import { normalizeModuleSession, type ModuleSession, type RawModuleSession } from "@/lib/module-output"
import { resolveSubjectItem } from "@/lib/module-output-apply"
import { sessionBlocks } from "@/lib/module-session"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { TimeEntry } from "@/lib/time-entries"

export const sessionGeneratedId = (moduleId: string, sessionId: string) => `module:${moduleId}:${sessionId}`

/** The Activity pens a module's sessions are painted with. */
export function fedPens(moduleId: string): { id: string; name: string }[] {
  const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "activity")
  return (scope?.pens ?? []).filter((p) => p.moduleFeed?.moduleId === moduleId).map((p) => ({ id: p.id, name: p.name }))
}

export type SessionResult = { ok: true; wrote: number; pens: string[]; line: string } | { ok: false; errors: string[] }

export function applyModuleSession(raw: RawModuleSession, opts: { undo?: "none" | "step" } = {}): SessionResult {
  const checked = normalizeModuleSession(raw)
  if (!checked.ok) return { ok: false, errors: checked.errors }
  const pens = fedPens(checked.session.moduleId)
  if (!pens.length) return { ok: true, wrote: 0, pens: [], line: "No pen follows this module." }
  const run = <T,>(fn: () => T) => (opts.undo === "step" ? runAsAction("Module session", fn) : withoutUndo(fn))
  return run(() =>
    withItemWriteSource({ surface: "module", name: checked.session.moduleId }, () => write(checked.session, pens)),
  )
}

function write(session: ModuleSession, pens: { id: string; name: string }[]): SessionResult {
  let subject = session.subject
  if (subject) {
    const found = resolveSubjectItem(subject, session.moduleId, new Date(session.startAt))
    if (found) subject = { ...subject, itemId: found.item.id }
  }
  const blocks = sessionBlocks({ ...session, ...(subject ? { subject } : {}) })
  if (!blocks.length) return { ok: false, errors: ["the session is shorter than a minute"] }
  const store = useTimeTrackingStore.getState()
  const gen = sessionGeneratedId(session.moduleId, session.id)
  const old = store.entries.filter((e) => e.generatedBy?.kind === "llm" && e.generatedBy.id.startsWith(`${gen}:`)).map((e) => e.id)
  const add: Omit<TimeEntry, "id">[] = []
  for (const pen of pens)
    for (const b of blocks)
      add.push({
        date: b.date,
        scopeId: "activity",
        penId: pen.id,
        startMin: b.startMin,
        endMin: b.endMin,
        title: b.title,
        notes: b.notes,
        generatedBy: { kind: "llm", id: `${gen}:${pen.id}` },
        createdBy: { surface: "module" },
      })
  store.layerEntries(add, old)
  return { ok: true, wrote: add.length, pens: pens.map((p) => p.name), line: `Painted ${blocks.length} block${blocks.length === 1 ? "" : "s"} on ${pens.map((p) => p.name).join(", ")}.` }
}
