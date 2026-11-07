/**
 * lib/module-session.ts — A module session as time blocks (pure)
 *
 * `sessionBlocks` turns a `ModuleSession` into the Tracking rows to paint: one per calendar day it
 * touches, titled by module and book, with a note that says what was done in that block ("Read 7
 * pages of Dune. Speed Read, 9:30 am to 9:52 am."). A session shorter than a minute paints nothing:
 * Tracking works in whole minutes. The pages are split across days by minutes, so the notes add up.
 */
import { dayPieces } from "@/lib/bim-flow/accept"
import { describeAmount, measureDef, type ModuleSession } from "@/lib/module-output"
import { moduleSpec } from "@/lib/module-output-registry"

export interface SessionBlock {
  date: string
  startMin: number
  endMin: number
  title: string
  notes: string
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()

export function sessionBlocks(session: ModuleSession): SessionBlock[] {
  const pieces = dayPieces(session.startAt, session.endAt)
  const total = pieces.reduce((n, p) => n + (p.endMin - p.startMin), 0)
  if (!total) return []
  const name = moduleSpec(session.moduleId)?.name ?? session.moduleId
  let left = session.quantities.map((q) => ({ ...q }))
  return pieces.map((p, i) => {
    const share = (p.endMin - p.startMin) / total
    const last = i === pieces.length - 1
    const done = left.map((q) => {
      const whole = measureDef(q.measure)?.whole !== false
      const part = last ? q.amount : whole ? Math.round(q.amount * share) : Math.round(q.amount * share * 100) / 100
      return { measure: q.measure, amount: part }
    })
    left = left.map((q, k) => ({ ...q, amount: Math.round((q.amount - done[k]!.amount) * 100) / 100 }))
    const what = done.filter((d) => d.amount > 0).map((d) => describeAmount(d.measure, d.amount))
    const verb = measureDef(session.quantities[0]?.measure)?.verb
    const subject = session.subject?.title
    const first = what.length ? `${verb ? verb[0]!.toUpperCase() + verb.slice(1) : "Did"} ${what.join(", ")}${subject ? ` of ${subject}` : ""}.` : subject ? `${name}: ${subject}.` : `${name} session.`
    return {
      date: p.date,
      startMin: p.startMin,
      endMin: p.endMin,
      title: subject ? `${name}: ${subject}` : name,
      notes: `${first}\n${name}, ${clock(session.startAt)} to ${clock(session.endAt)}.`,
    }
  })
}
