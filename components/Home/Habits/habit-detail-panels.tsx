/**
 * components/Home/Habits/habit-detail-panels.tsx — The panels of a habit's double-click view
 *
 * `BreakdownPanel` lays the cell's number out by the item it was about ("Dune — 3 pages in 2
 * sessions", then each session's clock time), and says plainly what part of the number no log
 * explains. `EntryPanel` is the small form: how much, which item of the subject type. Both read
 * and write through `lib/habit-contributions.ts` / `lib/module-output-apply.ts`, so a page typed
 * here and a page read in Speed Read are the same kind of row. Read-only except the entry form.
 */
"use client"

import { useMemo, useState } from "react"
import { breakdownForCell, describeGroup, ENTRY_MODULE_ID, ORIGIN_LABEL, originOf, totalsOf } from "@/lib/habit-contributions"
import { getAttachmentObjectUrl, putAttachment, attachmentUri } from "@/lib/attachments"
import type { OutputFile } from "@/lib/module-output"
import { connectFeed, habitTakesOutput } from "@/lib/habit-feeds"
import { applyModuleOutput } from "@/lib/module-output-apply"
import { describeAmount, localDayKey, measureDef } from "@/lib/module-output"
import { itemTitle, type TitledRecord } from "@/lib/item-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import type { TaskCompletion, WeeklyTask } from "@/lib/types"

export { ENTRY_MODULE_ID }

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function BreakdownPanel({
  task,
  measure,
  date,
  completion,
}: {
  task: WeeklyTask
  measure: string
  date: Date
  completion: TaskCompletion | undefined
}) {
  const items = useTaskStore((s) => s.tasks)
  const day = localDayKey(date.toISOString())
  const cell = typeof completion?.value === "number" ? completion.value : 0
  const view = useMemo(() => breakdownForCell(items, task.id, measure, day, cell), [items, task.id, measure, day, cell])
  const def = measureDef(measure)
  return (
    <section className="habit95-breakdown" aria-label={`${def?.unit[1] ?? measure} by ${def?.subjectType ?? "item"}`}>
      <p className="habit95-hint">
        {describeAmount(measure, cell)} on {day}
      </p>
      {view.groups.length > 0 ? <OriginChips sessions={view.groups.flatMap((g) => g.sessions)} typed={view.rest > 0 ? view.rest : 0} measure={measure} /> : null}
      {view.groups.length === 0 ? (
        <p className="habit95-hint">Nothing logged by a module or document yet today. Pages from Speed Read or an auto-counted document show up here by source.</p>
      ) : (
        <ul className="habit95-stat-readout">
          {view.groups.map((group) => (
            <li key={group.key} className="habit95-breakdown-row">
              <span>
                <b>{group.title}</b>
                <small className="habit95-breakdown-sessions">
                  {describeGroup(group, measure)}
                  {" · "}
                  {group.sessions.map((s) => `${s.amount} at ${clock(s.at)}${s.words ? ` (${s.words} words)` : ""}`).join(", ")}
                </small>
                <small className="habit95-breakdown-sessions">
                  <span className={`habit95-origin is-${originOf(group.sessions[0]!)}`}>{ORIGIN_LABEL[originOf(group.sessions[0]!)]}</span>
                  <Scans files={group.sessions.flatMap((s) => s.files ?? [])} />
                </small>
              </span>
              <span>{group.amount}</span>
            </li>
          ))}
        </ul>
      )}
      {view.rest !== 0 ? (
        <ul className="habit95-stat-readout">
          <li>
            <span>{view.rest > 0 ? "Typed or from another source" : "Lowered by hand"}</span>
            <span>{view.rest}</span>
          </li>
        </ul>
      ) : null}
    </section>
  )
}

/** Hand / document / module totals for the day, so the split reads at a glance. `typed` is the part of the cell no log explains. */
function OriginChips({ sessions, typed, measure }: { sessions: Parameters<typeof totalsOf>[0]; typed: number; measure: string }) {
  const t = totalsOf(sessions)
  const rows = ([ ["doc", t.doc], ["hand", t.hand + typed], ["module", t.module] ] as const).filter(([, n]) => n > 0)
  if (rows.length < 1) return null
  return (
    <p className="habit95-origins">
      {rows.map(([k, n]) => (
        <span key={k} className={`habit95-origin is-${k}`}>
          {ORIGIN_LABEL[k]} · {describeAmount(measure, n)}
        </span>
      ))}
    </p>
  )
}

/** Scans and photos that back a log row. A pdf or image opens in a new tab. */
function Scans({ files }: { files: OutputFile[] }) {
  if (!files.length) return <span className="habit95-origin is-none">no scans or photos</span>
  return (
    <span className="habit95-scans">
      {files.map((f) => (
        <button
          key={f.id}
          type="button"
          className="habit95-scan"
          onClick={async () => {
            const url = await getAttachmentObjectUrl(f.uri).catch(() => "")
            if (url) window.open(url, "_blank", "noopener,noreferrer")
          }}
        >
          {f.mime.startsWith("image/") ? "Photo" : "Scan"}: {f.name}
        </button>
      ))}
    </span>
  )
}

export function EntryPanel({ task, measure, subjectType, date, attach, verb, label }: { task: WeeklyTask; measure: string; subjectType?: string; date: Date; attach?: boolean; verb?: string; label?: string }) {
  const items = useTaskStore((s) => s.tasks)
  const [amount, setAmount] = useState("")
  const [subject, setSubject] = useState("")
  const [note, setNote] = useState("")
  const [picked, setPicked] = useState<File[]>([])
  const options = useMemo(
    () => (subjectType ? items.filter((t) => t.type === subjectType).map((t) => itemTitle(t as unknown as TitledRecord)) : []),
    [items, subjectType],
  )
  const def = measureDef(measure)
  const n = Number(amount)
  const ready = Number.isFinite(n) && n > 0 && (!subjectType || subject.trim().length > 0)
  const submit = async () => {
    if (!ready) return
    const files: OutputFile[] = []
    for (const f of picked) {
      const id = `habit-scan-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      await putAttachment(id, f, { name: f.name, mime: f.type })
      files.push({ id, name: f.name, mime: f.type || "application/octet-stream", uri: attachmentUri(id) })
    }
    // The form is a module too: connect it once, so the same routing rule applies to it.
    const fresh = useHabitsStore.getState().tasks.find((t) => t.id === task.id) ?? task
    if (!habitTakesOutput(fresh, { moduleId: ENTRY_MODULE_ID, measure })) {
      useHabitsStore.getState().updateTask({ ...fresh, moduleFeeds: connectFeed(fresh, ENTRY_MODULE_ID, measure) })
    }
    const now = new Date()
    const same = localDayKey(now.toISOString()) === localDayKey(date.toISOString())
    const at = same ? now : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
    const done = applyModuleOutput(
      {
        id: `${ENTRY_MODULE_ID}-${task.id}-${at.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
        moduleId: ENTRY_MODULE_ID,
        measure,
        amount: n,
        at: at.toISOString(),
        origin: "hand",
        ...(verb ? { verb } : {}),
        ...(files.length ? { files } : {}),
        subject: subjectType ? { type: subjectType, title: subject.trim() } : { type: "by-hand", title: label ?? "By hand", key: "by-hand" },
      },
      { undo: "step" },
    )
    setNote(done.ok ? done.line : done.errors.join("; "))
    if (done.ok) {
      setAmount("")
      setSubject("")
      setPicked([])
    }
  }
  return (
    <form
      className="habit95-entry"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      aria-label={`Log ${def?.unit[1] ?? measure}`}
    >
      <label className="habit95-entry-field">
        <span>{def ? def.unit[1] : measure}</span>
        <input type="number" min={0} step={def?.whole ? 1 : "any"} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label={def?.unit[1] ?? measure} />
      </label>
      {subjectType ? (
        <label className="habit95-entry-field">
          <span>{subjectType}</span>
          <input list={`entry-${task.id}-${subjectType}`} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label={subjectType} />
          <datalist id={`entry-${task.id}-${subjectType}`}>
            {options.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
        </label>
      ) : null}
      {attach ? (
        <label className="habit95-entry-field">
          <span>scans or photos</span>
          <input type="file" multiple accept="image/*,application/pdf" onChange={(e) => setPicked(Array.from(e.target.files ?? []))} aria-label="Attach scans or photos" />
        </label>
      ) : null}
      <button type="submit" className="habit95-btn" disabled={!ready}>
        Log
      </button>
      {note ? <p className="habit95-hint" role="status">{note}</p> : null}
    </form>
  )
}
