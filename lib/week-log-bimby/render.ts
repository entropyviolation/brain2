/**
 * lib/week-log-bimby/render.ts — The Week Log document
 *
 * Same house style as the Day Log (`lib/day-log-bimby/render.ts`): headings,
 * paragraphs, lists, blockquotes, small grey notes, ❝ ❞ for own words, ✎ for
 * amendments. Every number and list comes from the seven day summaries, so they
 * are exact with or without a model. Sections follow `docs/LOG_DOCS_PLAN.md` §4.
 * Pure.
 */

import { escapeHtmlText as esc } from "@/lib/doc-html"
import { clock, duration } from "@/lib/day-log-bimby/gather"
import { dayLogTitle } from "@/lib/day-log-bimby/render"
import { strongestWords } from "./summarize"
import type { DaySummary, WeekAmendment, WeekNarrative } from "./types"
import { isoWeek, shortDay, weekdayName, weekRangeLabel } from "./week"

const MUTED = "color:#6b7280"

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join("")
}

function list(items: string[], empty: string): string {
  return items.length ? `<ul>${items.join("")}</ul>` : `<p style="${MUTED}">${esc(empty)}</p>`
}

const short = (date: string) => weekdayName(date).slice(0, 3)

/** A day with fewer rows than this is a thin day. */
export const THIN_DAY = 5

export interface WeekRenderInput {
  start: string
  days: readonly DaySummary[]
  narrative: WeekNarrative | null
  amendments: readonly WeekAmendment[]
  builtAt: Date
  version: number
  note?: string
}

/** The code-only brief: busiest day, where the time went, who was in it. */
export function codeWeekBrief(days: readonly DaySummary[]): string {
  const known = days.filter((d) => d.rows)
  if (!known.length) return "Nothing was recorded this week yet."
  const acts = sumActivities(days).slice(0, 4)
  const busiest = [...known].sort((a, b) => b.rows - a.rows)[0]!
  const people = topPeople(days).slice(0, 6)
  const places = topPlaces(days).slice(0, 6)
  return [
    `${known.length} of 7 days have something on record (${known.reduce((s, d) => s + d.rows, 0)} rows). The fullest day was ${weekdayName(busiest.date)}, with ${busiest.rows}.`,
    acts.length ? `Most time went to ${acts.map(([n, m]) => `${n} (${duration(m)})`).join(", ")}.` : "",
    places.length ? `Places: ${places.map(([p]) => p).join(", ")}.` : "",
    people.length ? `People: ${people.map((p) => p.name).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function sumActivities(days: readonly DaySummary[]): [string, number][] {
  const m = new Map<string, number>()
  for (const d of days) for (const [n, min] of d.activities) m.set(n, (m.get(n) ?? 0) + min)
  return [...m].sort((a, b) => b[1] - a[1])
}

function topPlaces(days: readonly DaySummary[]): [string, string[]][] {
  const m = new Map<string, string[]>()
  for (const d of days) for (const p of d.places) m.set(p, [...(m.get(p) ?? []), d.date])
  return [...m].sort((a, b) => b[1].length - a[1].length)
}

function topPeople(days: readonly DaySummary[]): (DaySummary["people"][number] & { days: string[] })[] {
  const m = new Map<string, DaySummary["people"][number] & { days: string[] }>()
  for (const d of days)
    for (const p of d.people) {
      const held = m.get(p.name) ?? { name: p.name, togetherMin: 0, calls: 0, sent: 0, received: 0, days: [] }
      held.togetherMin += p.togetherMin
      held.calls += p.calls
      held.sent += p.sent
      held.received += p.received
      held.days.push(d.date)
      m.set(p.name, held)
    }
  return [...m.values()].sort((a, b) => b.days.length - a.days.length || b.togetherMin - a.togetherMin)
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0)
const toMin = (c: string) => Number(c.slice(0, 2)) * 60 + Number(c.slice(3, 5))

export function renderWeekLog(input: WeekRenderInput): string {
  const { start, days, narrative } = input
  const known = days.filter((d) => d.rows)
  const out: string[] = []
  const total = (f: (d: DaySummary) => number) => days.reduce((s, d) => s + f(d), 0)

  out.push(`<h1>WEEK LOG · ${esc(isoWeek(start))} · ${esc(weekRangeLabel(start))}</h1>`)
  out.push(
    `<p style="${MUTED}">Week of ${esc(start)} · version ${input.version} · built ${esc(input.builtAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))} · ${total((d) => d.rows)} rows from ${known.length} of 7 days · ${narrative?.model ? `narrative by ${esc(narrative.model)}` : narrative ? "narrative by the local model" : "no narrative yet (code only)"}${input.note ? ` · ${esc(input.note)}` : ""}</p>`,
  )
  out.push(`<p style="${MUTED}">Built from each day's Day Log (Docs → LOG DOCS → DAY LOGS) and its rows. Key: ❝ ❞ my own words · ✎ my amendment.</p>`)

  // 1. Brief
  out.push(`<h2>1. The week in brief</h2>`)
  out.push(paragraphs(narrative?.brief || codeWeekBrief(days)))

  // 2. At a glance
  out.push(`<h2>2. At a glance</h2>`)
  const woke = known.filter((d) => d.woke).map((d) => toMin(d.woke!))
  const steps = known.filter((d) => d.steps)
  const kcal = known.filter((d) => d.kcal)
  const fullest = [...known].sort((a, b) => b.rows - a.rows)[0]
  const thinnest = days.filter((d) => !d.future).sort((a, b) => a.rows - b.rows)[0]
  const glance = [
    `Days on record: <strong>${known.length}</strong> of 7 · rows: <strong>${total((d) => d.rows)}</strong>`,
    `Activity tracked: <strong>${duration(total((d) => d.activityMin))}</strong> · untracked stretches: <strong>${duration(total((d) => d.gapMin))}</strong>`,
    woke.length ? `Woke on average: <strong>${clock(avg(woke))}</strong> (${woke.length} days)` : "",
    steps.length ? `Steps: <strong>${total((d) => d.steps).toLocaleString("en-US")}</strong>, ${Math.round(avg(steps.map((d) => d.steps))).toLocaleString("en-US")} a day` : "",
    kcal.length ? `Food: <strong>${Math.round(avg(kcal.map((d) => d.kcal))).toLocaleString("en-US")} kcal</strong> a day on the Food book (${kcal.length} days)` : "",
    `Places: <strong>${topPlaces(days).length}</strong> · people: <strong>${topPeople(days).length}</strong>`,
    total((d) => d.calls) ? `Calls: <strong>${total((d) => d.calls)}</strong>, ${duration(total((d) => d.callMin))} on the phone` : "",
    total((d) => d.sent + d.received) ? `Texts: <strong>${total((d) => d.sent)}</strong> sent, <strong>${total((d) => d.received)}</strong> received` : "",
    total((d) => d.macMin + d.phoneMin) ? `Screens: Mac ${duration(total((d) => d.macMin))} · iPhone ${duration(total((d) => d.phoneMin))}` : "",
    total((d) => d.done.length) ? `Finished: <strong>${total((d) => d.done.length)}</strong> items` : "",
    fullest ? `Fullest day: <strong>${esc(weekdayName(fullest.date))}</strong> (${fullest.rows} rows)${thinnest && thinnest.date !== fullest.date ? ` · thinnest: <strong>${esc(weekdayName(thinnest.date))}</strong> (${thinnest.rows})` : ""}` : "",
  ].filter(Boolean)
  out.push(`<ul>${glance.map((g) => `<li>${g}</li>`).join("")}</ul>`)

  // 3. Day by day
  out.push(`<h2>3. Day by day</h2>`)
  for (const d of days) {
    out.push(`<h3>${esc(shortDay(d.date))}</h3>`)
    if (d.future) {
      out.push(`<p style="${MUTED}">Not yet.</p>`)
      continue
    }
    if (!d.rows) {
      out.push(`<p style="${MUTED}">Nothing on record for this day.</p>`)
      continue
    }
    out.push(paragraphs(d.brief))
    const bits = [
      d.woke ? `woke ${d.woke}` : "",
      d.slept ? `slept ${d.slept}` : "",
      d.activities.length ? d.activities.slice(0, 3).map(([n, m]) => `${n} ${duration(m)}`).join(", ") : "",
      d.places.length ? d.places.slice(0, 4).join(", ") : "",
      d.people.length ? `with ${d.people.slice(0, 4).map((p) => p.name).join(", ")}` : "",
      d.moods.length ? `mood ${d.moods.join(", ")}` : "",
    ].filter(Boolean)
    out.push(`<p style="${MUTED}">${esc(bits.join(" · "))} · from ${esc(dayLogTitle(d.date))}${d.narrated ? "" : " (code brief)"} · ${d.rows} rows</p>`)
  }

  // 4. Time
  out.push(`<h2>4. Where the time went</h2>`)
  out.push(
    list(
      sumActivities(days)
        .slice(0, 15)
        .map(([name, min]) => {
          const per = days.flatMap((d) => d.activities.filter(([n]) => n === name).map(([, m]) => `${short(d.date)} ${duration(m)}`))
          return `<li><strong>${esc(name)}</strong> · ${duration(min)} <span style="${MUTED}">(${esc(per.join(", "))})</span></li>`
        }),
      "No activity was tracked this week.",
    ),
  )

  // 5. Places
  out.push(`<h2>5. Where I was</h2>`)
  out.push(list(topPlaces(days).map(([p, ds]) => `<li><strong>${esc(p)}</strong> · ${esc(ds.map(short).join(", "))}</li>`), "No location was recorded this week."))

  // 6. People
  out.push(`<h2>6. Who I was with and talked to</h2>`)
  out.push(
    list(
      topPeople(days).map((p) => {
        const bits = [p.togetherMin ? `together ${duration(p.togetherMin)}` : "", p.calls ? `${p.calls} call${p.calls === 1 ? "" : "s"}` : "", p.sent + p.received ? `${p.sent} texts sent, ${p.received} received` : ""].filter(Boolean)
        return `<li><strong>${esc(p.name)}</strong> · ${esc(p.days.map(short).join(", "))}${bits.length ? ` · ${esc(bits.join(" · "))}` : ""}</li>`
      }),
      "No company, calls or texts were recorded this week.",
    ),
  )

  // 7. Screens
  out.push(`<h2>7. Screens</h2>`)
  out.push(list(known.filter((d) => d.macMin || d.phoneMin).map((d) => `<li>${esc(shortDay(d.date))} · Mac ${duration(d.macMin)} · iPhone ${duration(d.phoneMin)}</li>`), "No screen time was recorded this week."))

  // 8. Body
  out.push(`<h2>8. Body: sleep, movement, food</h2>`)
  out.push(
    list(
      known.map((d) => {
        const bits = [d.woke ? `woke ${d.woke}` : "", d.slept ? `to sleep ${d.slept}` : "", d.steps ? `${d.steps.toLocaleString("en-US")} steps` : "", d.kcal ? `${d.kcal.toLocaleString("en-US")} kcal` : ""].filter(Boolean)
        return bits.length ? `<li>${esc(shortDay(d.date))} · ${esc(bits.join(" · "))}</li>` : ""
      }).filter(Boolean),
      "Nothing about sleep, movement or food was recorded this week.",
    ),
  )

  // 9. Feelings
  out.push(`<h2>9. How I felt</h2>`)
  if (narrative?.feelings) out.push(paragraphs(narrative.feelings))
  const felt = known.filter((d) => d.moods.length || d.feelings).map((d) => `<li>${esc(shortDay(d.date))} · ${esc([d.moods.join(", "), d.feelings].filter(Boolean).join(" — "))}</li>`)
  out.push(list(felt, narrative?.feelings ? "No mood rows this week; read from my words." : "No mood was recorded and nothing I said says how I felt."))

  // 10. Own words
  out.push(`<h2>10. In my own words</h2>`)
  const words = known.flatMap((d) => strongestWords(d, 3).map((w) => ({ ...w, date: d.date })))
  out.push(
    words.length
      ? words.map((w) => `<blockquote>❝${esc(w.text)}❞<br><span style="${MUTED}">— ${esc(shortDay(w.date))} ${esc(w.when)} · ${esc(w.where)}</span></blockquote>`).join("")
      : `<p style="${MUTED}">Nothing in my own words was recorded this week.</p>`,
  )

  // 11. Plans
  out.push(`<h2>11. Plans and what got done</h2>`)
  out.push(
    list(
      known
        .filter((d) => d.done.length || d.calendar.length)
        .map((d) => `<li><strong>${esc(shortDay(d.date))}</strong><ul>${[...d.calendar.map((c) => `<li>On the calendar: ${esc(c)}</li>`), ...d.done.map((x) => `<li>${esc(x)}</li>`)].join("")}</ul></li>`),
      "No calendar event or finished item this week.",
    ),
  )

  // 12. Written
  out.push(`<h2>12. What I wrote</h2>`)
  out.push(list(known.flatMap((d) => d.docs.map((x) => `<li>${esc(short(d.date))} · ${esc(x)}</li>`)), "No doc was started or edited this week."))

  // 13. Gaps
  out.push(`<h2>13. Gaps and open questions</h2>`)
  const thin = days.filter((d) => !d.future && d.rows < THIN_DAY).map((d) => `<li>${esc(shortDay(d.date))} · ${d.rows ? `only ${d.rows} rows` : "nothing on record"}</li>`)
  const questions = (narrative?.questions ?? []).map((q) => `<li><em>${esc(q)}</em></li>`)
  out.push(list([...thin, ...questions], "Every day has something on record."))
  out.push(`<p style="${MUTED}">Answer or fix anything with the Week Log BIMBY above this page, or in BIM chat: “week log: Tuesday I was home sick all day”.</p>`)

  // 14. Amendments
  out.push(`<h2>14. Amendments</h2>`)
  const dayAmends = known.flatMap((d) => d.amendments.map((a) => `<li>✎ ${esc(short(d.date))} (Day Log) — <em>❝${esc(a)}❞</em></li>`))
  out.push(
    list(
      [
        ...input.amendments.map((a) => `<li>✎ <strong>${esc(a.kind)}</strong> — <em>❝${esc(a.text)}❞</em> <span style="${MUTED}">said ${esc(new Date(a.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }))} in ${a.via === "bim" ? "BIM chat" : "Docs"}</span></li>`),
        ...dayAmends,
      ],
      "No amendments yet.",
    ),
  )
  return out.join("\n")
}
