/**
 * lib/day-log-bimby/render.ts — The Day Log document, in the house standard
 *
 * Every Day Log has the same sections in the same order (`docs/DAY_LOG.md`).
 * Code writes every number, list and time from the ledger, so those are exact
 * with or without a model. The model's narrative goes under "The day in brief",
 * each part of the day, and "How I felt". HTML stays inside the Docs sanitizer
 * (`lib/doc-html.ts`): headings, paragraphs, lists, blockquotes, spans. Pure.
 */

import { escapeHtmlText as esc } from "@/lib/doc-html"
import { PARTS } from "./compose"
import { clock, coveredMinutes, duration, untrackedRuns } from "./gather"
import { SOURCE_LABEL, type Amendment, type DayNarrative, type Evidence, type EvidenceSource } from "./types"

export const DAY_LOG_FOLDER = "LOG DOCS/DAY LOGS"
export const DAY_LOG_PARENT = "LOG DOCS"

/** `DAY LOG · 2026-11-24 · Tuesday`. Sorts by date in the Docs list. */
export function dayLogTitle(date: string): string {
  return `DAY LOG · ${date} · ${weekday(date)}`
}

function weekday(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { weekday: "long" })
}

function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y!, m! - 1, d!).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
}

const CITE_STYLE = "color:#6b7280;font-size:0.8em"
const MUTED = "color:#6b7280"

/** Text with [E12] citations drawn small and grey. */
function prose(text: string): string {
  return esc(text).replace(/\[(E\d+(?:, E\d+)*)\]/g, `<span style="${CITE_STYLE}">[$1]</span>`)
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${prose(p)}</p>`)
    .join("")
}

function when(e: Evidence): string {
  if (e.startMin === null) return "—"
  const t = e.endMin !== undefined ? `${clock(e.startMin)}–${clock(e.endMin)}` : clock(e.startMin)
  return e.estimated ? `~${t}` : t
}

function flags(e: Evidence): string {
  return `${e.machine ? " ⚙" : ""}${e.source === "amendment" ? " ✎" : ""}`
}

function rowItem(e: Evidence): string {
  const len = e.endMin !== undefined && e.startMin !== null ? ` <span style="${MUTED}">(${duration(e.endMin - e.startMin)})</span>` : ""
  const words = e.ownWords ? ` — <em>❝${esc(e.ownWords)}❞</em>` : ""
  return `<li><strong>${when(e)}</strong> · ${esc(SOURCE_LABEL[e.source])} · ${esc(e.what)}${len}${words}${flags(e)} <span style="${CITE_STYLE}">[E${e.n}]</span></li>`
}

const SCREEN: readonly EvidenceSource[] = ["screen-mac", "screen-phone"]

function sumBy(rows: readonly Evidence[], key: (e: Evidence) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const e of rows) {
    if (e.startMin === null || e.endMin === undefined) continue
    m.set(key(e), (m.get(key(e)) ?? 0) + (e.endMin - e.startMin))
  }
  return [...m].sort((a, b) => b[1] - a[1])
}

function list(items: string[], empty: string): string {
  return items.length ? `<ul>${items.join("")}</ul>` : `<p style="${MUTED}">${esc(empty)}</p>`
}

export interface RenderInput {
  date: string
  evidence: readonly Evidence[]
  narrative: DayNarrative | null
  amendments: readonly Amendment[]
  builtAt: Date
  version: number
  /** The minute the day is known up to: now on today, else midnight. */
  untilMin: number
  /** Window progress, for a build still writing. */
  note?: string
}

/** The code-only brief: first and last thing, totals. Used when the model wrote none. */
export function codeBrief(evidence: readonly Evidence[]): string {
  const timed = evidence.filter((e) => e.startMin !== null && !SCREEN.includes(e.source))
  if (!timed.length) return "Nothing was recorded with a time on this day yet."
  const first = timed[0]!
  const last = timed[timed.length - 1]!
  const acts = sumBy(evidence.filter((e) => e.source === "activity"), (e) => e.what.split(" · ")[0]!).slice(0, 4)
  const places = [...new Set(evidence.filter((e) => e.source === "place").map((e) => e.what.split(" · ")[0]!))]
  const people = [...new Set(evidence.filter((e) => e.person).map((e) => e.person!))]
  const bits = [
    `The first thing on record is at ${clock(first.startMin!)}: ${first.what} [E${first.n}]. The last is at ${clock(last.endMin ?? last.startMin!)}: ${last.what} [E${last.n}].`,
    acts.length ? `Most time went to ${acts.map(([n, m]) => `${n} (${duration(m)})`).join(", ")}.` : "",
    places.length ? `Places: ${places.slice(0, 6).join(", ")}.` : "",
    people.length ? `People: ${people.slice(0, 8).join(", ")}.` : "",
  ]
  return bits.filter(Boolean).join(" ")
}

export function renderDayLog(input: RenderInput): string {
  const { date, evidence, narrative } = input
  const out: string[] = []
  const by = (s: EvidenceSource) => evidence.filter((e) => e.source === s)
  const sourcesUsed = [...new Set(evidence.map((e) => e.source))]

  out.push(`<h1>DAY LOG · ${esc(longDate(date))}</h1>`)
  out.push(
    `<p style="${MUTED}">Day ${esc(date)} · version ${input.version} · built ${esc(input.builtAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))} · ${evidence.length} rows from ${sourcesUsed.length} sources · ${narrative?.model ? `narrative by ${esc(narrative.model)}` : narrative ? "narrative by the local model" : "no narrative yet (code only)"}${input.note ? ` · ${esc(input.note)}` : ""}</p>`,
  )
  out.push(`<p style="${MUTED}">Key: ❝ ❞ my own words · ✎ my amendment · ⚙ recorded automatically · ~ estimated time · [E12] row 12 of the ledger at the end.</p>`)

  // 1. Brief
  out.push(`<h2>1. The day in brief</h2>`)
  out.push(paragraphs(narrative?.brief || codeBrief(evidence)))

  // 2. At a glance
  out.push(`<h2>2. At a glance</h2>`)
  const woke = by("sleep").find((e) => e.what.startsWith("Woke"))
  const slept = by("sleep").find((e) => e.what === "Went to sleep")
  const activity = coveredMinutes(evidence, ["activity"])
  const gaps = untrackedRuns(evidence, input.untilMin)
  const gapMin = gaps.reduce((s, [a, b]) => s + (b - a), 0)
  const health = by("health")[0]
  const calls = by("call")
  const callMin = calls.reduce((s, e) => s + (e.endMin !== undefined && e.startMin !== null ? e.endMin - e.startMin : 0), 0)
  const texts = by("text")
  const mac = coveredMinutes(evidence, ["screen-mac"])
  const phone = coveredMinutes(evidence, ["screen-phone"])
  const kcal = evidence.reduce((s, e) => s + (e.kcal ?? 0), 0)
  const moods = by("mood")
  const glance = [
    woke ? `Woke: <strong>${when(woke)}</strong>${woke.what.includes("after") ? ` (${esc(woke.what.replace(/^Woke up /, ""))})` : ""}` : "",
    slept ? `To sleep: <strong>${when(slept)}</strong>` : "",
    `Activity tracked: <strong>${duration(activity)}</strong> · untracked stretches of 30 min or more: <strong>${duration(gapMin)}</strong> in ${gaps.length}`,
    health ? `Body: ${esc(health.what)}` : "",
    `Places: <strong>${new Set(by("place").map((e) => e.what.split(" · ")[0])).size}</strong> · people: <strong>${new Set(evidence.filter((e) => e.person).map((e) => e.person)).size}</strong>`,
    calls.length ? `Calls: <strong>${calls.length}</strong>, ${duration(callMin)} on the phone` : "",
    texts.length ? `Texts: <strong>${texts.filter((e) => e.dir === "out").length}</strong> sent, <strong>${texts.filter((e) => e.dir !== "out").length}</strong> received` : "",
    mac || phone ? `Screens: Mac ${duration(mac)} · iPhone ${duration(phone)}` : "",
    kcal ? `Food: <strong>${Math.round(kcal).toLocaleString("en-US")} kcal</strong> on the Food book` : by("food").length ? `Food: ${by("food").length} entries` : "",
    moods.length ? `Mood: ${moods.map((e) => `${esc(e.what.split(" · ")[0]!)} at ${when(e)}`).join(", ")}` : "",
    by("done").length ? `Finished: <strong>${by("done").length}</strong> items` : "",
  ].filter(Boolean)
  out.push(`<ul>${glance.map((g) => `<li>${g}</li>`).join("")}</ul>`)

  // 3. Hour by hour
  out.push(`<h2>3. Hour by hour</h2>`)
  for (const part of PARTS) {
    const rows = evidence.filter((e) => e.startMin !== null && e.startMin >= part.from && e.startMin < part.to && !SCREEN.includes(e.source))
    const told = (narrative?.windows ?? []).filter((w) => w.fromMin >= part.from && w.fromMin < part.to)
    const screens = sumBy(evidence.filter((e) => SCREEN.includes(e.source) && e.startMin! >= part.from && e.startMin! < part.to), (e) => `${e.what.split(" · ")[0]} (${e.source === "screen-mac" ? "Mac" : "iPhone"})`).slice(0, 5)
    if (!rows.length && !told.length && !screens.length) continue
    out.push(`<h3>${part.name} · ${clock(part.from)}–${clock(part.to)}</h3>`)
    for (const w of told) out.push(paragraphs(w.text))
    if (rows.length) out.push(`<ul>${rows.map(rowItem).join("")}</ul>`)
    if (screens.length) out.push(`<p style="${MUTED}">Screens: ${screens.map(([k, m]) => `${esc(k)} ${duration(m)}`).join(" · ")} ⚙</p>`)
  }
  const untimed = evidence.filter((e) => e.startMin === null && e.source !== "amendment")
  if (untimed.length) {
    out.push(`<h3>No clock time</h3>`)
    out.push(`<ul>${untimed.map(rowItem).join("")}</ul>`)
  }

  // 4. Places
  out.push(`<h2>4. Where I was</h2>`)
  out.push(list(by("place").map(rowItem), "No location was recorded."))

  // 5. People
  out.push(`<h2>5. Who I was with and talked to</h2>`)
  const people = new Map<string, Evidence[]>()
  for (const e of evidence) if (e.person) people.set(e.person, [...(people.get(e.person) ?? []), e])
  const personItems = [...people].map(([name, rows]) => {
    const company = rows.filter((e) => e.source === "company")
    const together = company.reduce((s, e) => s + (e.endMin !== undefined && e.startMin !== null ? e.endMin - e.startMin : 0), 0)
    const cs = rows.filter((e) => e.source === "call")
    const ts = rows.filter((e) => e.source === "text")
    const bits = [
      together ? `together ${duration(together)}` : company.length ? `together ${company.length}×` : "",
      cs.length ? `${cs.length} call${cs.length === 1 ? "" : "s"}` : "",
      ts.length ? `${ts.filter((e) => e.dir === "out").length} texts sent, ${ts.filter((e) => e.dir !== "out").length} received, ${clock(ts[0]!.startMin!)}–${clock(ts[ts.length - 1]!.startMin!)}` : "",
    ].filter(Boolean)
    const detail = [...company, ...cs, ...ts.slice(0, 40)].sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0)).map(rowItem).join("")
    const more = ts.length > 40 ? `<li style="${MUTED}">…and ${ts.length - 40} more texts (all in the ledger)</li>` : ""
    return `<li><strong>${esc(name)}</strong>: ${esc(bits.join(" · "))}<ul>${detail}${more}</ul></li>`
  })
  out.push(list(personItems, "No company, calls or texts were recorded."))

  // 6. Screens
  out.push(`<h2>6. Screens</h2>`)
  const screenItems = (["screen-mac", "screen-phone"] as const).flatMap((s) => {
    const apps = sumBy(by(s), (e) => e.what.split(" · ")[0]!)
    if (!apps.length) return []
    return [`<li><strong>${SOURCE_LABEL[s]}</strong>: ${duration(coveredMinutes(evidence, [s]))} in all<ul>${apps.slice(0, 15).map(([app, m]) => `<li>${esc(app)} · ${duration(m)}</li>`).join("")}</ul></li>`]
  })
  out.push(list(screenItems, "No screen time was recorded."))

  // 7. Body
  out.push(`<h2>7. Body: sleep, movement, food, intake</h2>`)
  const bodyRows = evidence.filter((e) => e.source === "sleep" || e.source === "health" || e.source === "food" || e.source === "intake" || (e.source === "activity" && /exercise|walk|run|yoga|gym|sleep/i.test(e.what)))
  out.push(list(bodyRows.map(rowItem), "Nothing about sleep, movement or food was recorded."))

  // 8. Feelings
  out.push(`<h2>8. How I felt</h2>`)
  if (narrative?.feelings) out.push(paragraphs(narrative.feelings))
  out.push(list(moods.map(rowItem), narrative?.feelings ? "No mood rows; read from my words." : "No mood was recorded and nothing I said says how I felt."))

  // 9. Own words
  out.push(`<h2>9. In my own words</h2>`)
  const words = evidence.filter((e) => e.ownWords && e.source !== "amendment")
  out.push(
    words.length
      ? words.map((e) => `<blockquote>❝${esc(e.ownWords!)}❞<br><span style="${MUTED}">— ${when(e)} · ${esc(SOURCE_LABEL[e.source])} · ${esc(e.what)} [E${e.n}]</span></blockquote>`).join("")
      : `<p style="${MUTED}">Nothing in my own words was recorded on this day.</p>`,
  )

  // 10. Plans
  out.push(`<h2>10. Plans and what got done</h2>`)
  out.push(list([...by("plan"), ...by("event"), ...by("done")].map(rowItem), "No plan, calendar event or finished item on this day."))

  // 11. Written
  out.push(`<h2>11. What I wrote</h2>`)
  out.push(list(by("doc").map(rowItem), "No doc was started or edited on this day."))

  // 12. Gaps
  out.push(`<h2>12. Gaps and open questions</h2>`)
  const gapItems = gaps.map(([a, b]) => `<li>${clock(a)}–${clock(b)} · ${duration(b - a)} with no activity on record</li>`)
  const questionItems = (narrative?.questions ?? []).map((q) => `<li><em>${esc(q)}</em></li>`)
  out.push(list([...gapItems, ...questionItems], "No gaps of 30 minutes or more."))
  out.push(`<p style="${MUTED}">Answer a gap or fix anything with the Day Log BIMBY above this page, or in BIM chat: “day log ${esc(date)}: from 14:10 to 16:00 I was at the library with Sam”.</p>`)

  // 13. Amendments
  out.push(`<h2>13. Amendments</h2>`)
  out.push(
    list(
      input.amendments.map((a) => `<li>✎ <strong>${esc(a.kind)}</strong>${a.atMin !== undefined ? ` about ${clock(a.atMin)}` : ""} — <em>❝${esc(a.text)}❞</em> <span style="${MUTED}">said ${esc(new Date(a.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))} in ${a.via === "bim" ? "BIM chat" : "Docs"}</span></li>`),
      "No amendments yet.",
    ),
  )

  // 14. Ledger
  out.push(`<h2>14. Ledger</h2>`)
  const counts = sourcesUsed.map((s) => `${SOURCE_LABEL[s]} ${evidence.filter((e) => e.source === s).length}`)
  out.push(`<p style="${MUTED}">Every row this log was built from. ${esc(counts.join(" · "))}</p>`)
  out.push(list(evidence.map(rowItem), "The ledger is empty."))
  return out.join("\n")
}
