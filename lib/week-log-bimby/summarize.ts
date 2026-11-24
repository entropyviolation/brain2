/**
 * lib/week-log-bimby/summarize.ts — One day of the week, folded by code
 *
 * Reads a day's ledger (`gatherDay`) and its Day Log prose, and keeps what a
 * week needs: totals, places, people, body, own words, the day's brief. A week
 * is seven of these, so the model never sees raw rows (it has a 4,096-token
 * context; a week of rows would not fit). Pure.
 */

import { clock, coveredMinutes, MINUTES_PER_DAY, untrackedRuns } from "@/lib/day-log-bimby/gather"
import { codeBrief } from "@/lib/day-log-bimby/render"
import { SOURCE_LABEL, type DayNarrative, type Evidence } from "@/lib/day-log-bimby/types"
import type { DaySummary } from "./types"

const head = (e: Evidence): string => e.what.split(" · ")[0]!

const span = (e: Evidence): number => (e.startMin !== null && e.endMin !== undefined ? e.endMin - e.startMin : 0)

/** `[E12]` and `[E3, E4]` mean rows of one day's ledger; a week drops them. */
export const stripCitations = (text: string): string =>
  text
    .replace(/\s*\[E\d+(?:\s*,\s*E?\d+)*\]/g, "")
    .replace(/\s+([.,;])/g, "$1")
    .trim()

export function emptyDay(date: string, future: boolean): DaySummary {
  return { date, future, rows: 0, narrated: false, brief: "", feelings: "", activities: [], activityMin: 0, gapMin: 0, places: [], people: [], calls: 0, callMin: 0, sent: 0, received: 0, macMin: 0, phoneMin: 0, kcal: 0, steps: 0, moods: [], done: [], docs: [], calendar: [], words: [], amendments: [] }
}

export function summarizeDay(date: string, evidence: readonly Evidence[], narrative: DayNarrative | null, untilMin = MINUTES_PER_DAY): DaySummary {
  if (!evidence.length) return emptyDay(date, false)
  const by = (s: Evidence["source"]) => evidence.filter((e) => e.source === s)
  const acts = new Map<string, number>()
  for (const e of by("activity")) acts.set(head(e), (acts.get(head(e)) ?? 0) + span(e))
  const people = new Map<string, DaySummary["people"][number]>()
  for (const e of evidence) {
    if (!e.person) continue
    const p = people.get(e.person) ?? { name: e.person, togetherMin: 0, calls: 0, sent: 0, received: 0 }
    if (e.source === "company") p.togetherMin += span(e)
    if (e.source === "call") p.calls++
    if (e.source === "text") e.dir === "out" ? p.sent++ : p.received++
    people.set(e.person, p)
  }
  const woke = by("sleep").find((e) => e.what.startsWith("Woke"))
  const slept = by("sleep").find((e) => e.what === "Went to sleep")
  const steps = Number(/([\d,]+) steps/.exec(by("health")[0]?.what ?? "")?.[1]?.replace(/,/g, "") ?? 0)
  const texts = by("text")
  return {
    date,
    future: false,
    rows: evidence.length,
    narrated: !!narrative?.brief,
    brief: stripCitations(narrative?.brief || codeBrief(evidence)),
    feelings: stripCitations(narrative?.feelings ?? ""),
    activities: [...acts].sort((a, b) => b[1] - a[1]),
    activityMin: coveredMinutes(evidence, ["activity"]),
    gapMin: untrackedRuns(evidence, untilMin).reduce((s, [a, b]) => s + (b - a), 0),
    places: [...new Set(by("place").map(head))],
    people: [...people.values()].sort((a, b) => b.togetherMin + b.calls * 10 + b.sent + b.received - (a.togetherMin + a.calls * 10 + a.sent + a.received)),
    calls: by("call").length,
    callMin: by("call").reduce((s, e) => s + span(e), 0),
    sent: texts.filter((e) => e.dir === "out").length,
    received: texts.filter((e) => e.dir !== "out").length,
    macMin: coveredMinutes(evidence, ["screen-mac"]),
    phoneMin: coveredMinutes(evidence, ["screen-phone"]),
    kcal: Math.round(evidence.reduce((s, e) => s + (e.kcal ?? 0), 0)),
    steps,
    ...(woke?.startMin != null ? { woke: clock(woke.startMin) } : {}),
    ...(slept?.startMin != null ? { slept: clock(slept.startMin) } : {}),
    moods: by("mood").map((e) => `${head(e)}${e.startMin !== null ? ` at ${clock(e.startMin)}` : ""}`),
    done: by("done").map((e) => e.what),
    docs: by("doc").map((e) => e.what),
    calendar: by("event").map((e) => e.what.replace(/^On the calendar: /, "")),
    words: evidence
      .filter((e) => e.ownWords && e.source !== "amendment" && e.source !== "doc")
      .map((e) => ({ when: e.startMin === null ? "—" : clock(e.startMin), where: SOURCE_LABEL[e.source], text: e.ownWords! })),
    amendments: by("amendment").map((e) => e.ownWords ?? e.what),
  }
}

/** The words worth carrying into a week: the longest few of a day, in clock order. */
export function strongestWords(day: DaySummary, n = 3): DaySummary["words"] {
  const keep = new Set([...day.words].sort((a, b) => b.text.length - a.text.length).slice(0, n))
  return day.words.filter((w) => keep.has(w))
}
