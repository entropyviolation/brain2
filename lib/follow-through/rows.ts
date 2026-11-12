/**
 * lib/follow-through/rows.ts — The ledger as dated lines, for BIM's analyses
 *
 * Pure. One row per planned step (source: its verdict), one per unplanned action, one per feeling
 * that stands alone. A step's row carries its hedge, the pull and resistance before, the delay,
 * what displaced it, and how it sat afterwards, in words a model can quote. Proposed rows are
 * marked so an analysis can tell a confirmed link from a guess.
 */
import { clock, span, unplanned } from "./link"
import { AFTER_WORDS, LEVEL_WORDS, type Ledger } from "./types"

export interface FollowRow {
  date: string
  source: string
  text: string
}

export function followRows(l: Ledger): FollowRow[] {
  const rows: FollowRow[] = []
  for (const i of l.intentions) {
    for (const s of i.steps) {
      const before = l.feelings.find((f) => f.phase === "before" && f.stepId === s.id && f.standing !== "rejected")
      const after = l.feelings.find((f) => f.phase === "after" && s.actionId && f.actionId === s.actionId && f.standing !== "rejected")
      const action = l.actions.find((a) => a.id === s.actionId)
      const bits = [
        `planned ${clock(i.at)} (${s.hedge})`,
        before?.excitement !== undefined ? `pull ${LEVEL_WORDS[before.excitement]}` : "",
        before?.resistance !== undefined ? `resistance ${LEVEL_WORDS[before.resistance]}` : "",
        before?.importance !== undefined ? `importance ${LEVEL_WORDS[before.importance]}` : "",
        action ? `did "${action.what}" at ${clock(action.at)}${s.delayMin ? `, ${span(s.delayMin)} later` : ""}` : "",
        s.displacedBy ? `did "${s.displacedBy}" instead` : "",
        s.awayReason ? `pulled away by: ${s.awayReason}` : "",
        s.blocker ? `in the way: ${s.blocker}` : "",
        s.repeats.length ? `said ${s.repeats.length + 1} times` : "",
        after?.satisfaction !== undefined ? `afterwards: ${AFTER_WORDS[after.satisfaction]}${after.words ? ` ("${after.words.slice(0, 80)}")` : ""}` : "",
      ].filter(Boolean)
      rows.push({ date: i.day, source: `${s.verdict}${s.standing === "confirmed" ? "" : " · proposed"}`, text: `${s.what} — ${bits.join("; ")}`.slice(0, 300) })
    }
  }
  for (const day of new Set(l.actions.map((a) => a.day))) for (const a of unplanned(l, day)) rows.push({ date: day, source: "unplanned", text: `${a.what} at ${clock(a.at)} — no plan predicted it` })
  for (const f of l.feelings) {
    if (f.phase !== "after" || f.standing === "rejected" || f.satisfaction === undefined) continue
    if (f.actionId && l.intentions.some((i) => i.steps.some((s) => s.actionId === f.actionId))) continue
    const action = l.actions.find((a) => a.id === f.actionId)
    rows.push({ date: f.day, source: `feeling after${f.standing === "confirmed" ? "" : " · proposed"}`, text: `${AFTER_WORDS[f.satisfaction]} about ${action?.what ?? f.aboutWords ?? "the day"}${f.words ? ` — "${f.words.slice(0, 160)}"` : ""}` })
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}
