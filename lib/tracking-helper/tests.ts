/**
 * lib/tracking-helper/tests.ts — Test cases for the Helper's flow, run by the lab and by vitest
 *
 * A case is an account, the day it was told, and the rows it must become. `wiring` is a recorded
 * answer for the WIRE stage: **replay** runs every code stage on it with no model (free, exact, so a
 * change to clocks, certainty, chaining or places shows up at once); **live** asks the model again,
 * which is how a prompt change is tested. A case without `wiring` can only run live or by rules.
 * Cases the person adds in the lab are kept in `trackinghelper-tests-v1`.
 */

import { clockText } from "./clock"
import { assemble } from "./assemble"
import { words } from "./places"
import { tokenize } from "./tokens"
import type { HelperContext, ProposedBlock, WiredSegment, Wiring } from "./types"

/** One block as a comparable line. */
export interface ExpectRow {
  day: string
  activity: string
  start: string
  startCert: "exact" | "estimated"
  end: string
  endCert: "exact" | "estimated"
  place: string
}

export interface HelperTest {
  id: string
  name: string
  text: string
  /** ISO. The moment the account is told, so "Friday" has an answer. */
  now: string
  wiring?: Wiring
  expect: ExpectRow[]
}

export const rowOf = (b: ProposedBlock): ExpectRow => ({
  day: b.day,
  activity: b.activity,
  start: b.startMin === null ? "" : clockText(b.startMin),
  startCert: b.startCert,
  end: b.endMin === null ? "" : clockText(b.endMin),
  endCert: b.endCert,
  place: b.place?.name ?? "",
})

export const rowText = (r: ExpectRow) => `${r.day} ${r.activity} ${r.start}${r.startCert === "estimated" ? "~" : ""} → ${r.end}${r.endCert === "estimated" ? "~" : ""}${r.place ? ` @ ${r.place}` : ""}`

export interface TestResult {
  pass: boolean
  got: ExpectRow[]
  /** Lines present on one side only: "- expected", "+ got". */
  diff: string[]
}

/** Same activity when one's content words are all in the other's ("doing dishes" is "dishes", "working on foxtide cd stuff" is "foxtide cd work"). */
const sameActivity = (a: string, b: string) => {
  const x = words(a)
  const y = words(b)
  const [short, long] = x.length <= y.length ? [x, y] : [y, x]
  return short.length ? short.every((w) => long.includes(w)) : a.toLowerCase() === b.toLowerCase()
}

const sameRow = (a: ExpectRow, b: ExpectRow) => a.day === b.day && a.start === b.start && a.end === b.end && a.startCert === b.startCert && a.endCert === b.endCert && a.place.toLowerCase() === b.place.toLowerCase() && sameActivity(a.activity, b.activity)

/** Rows pair up one to one by day, times, certainty, place and activity words. What is left over is the diff. */
export function compare(got: ExpectRow[], want: ExpectRow[]): TestResult {
  const spare = [...got]
  const missing: ExpectRow[] = []
  for (const w of want) {
    const i = spare.findIndex((g) => sameRow(g, w))
    if (i < 0) missing.push(w)
    else spare.splice(i, 1)
  }
  const diff = [...missing.map((x) => `- ${rowText(x)}`), ...spare.map((x) => `+ ${rowText(x)}`)]
  return { pass: !diff.length, got, diff }
}

/** Replay a case's recorded wiring through the code stages. */
export function replay(t: HelperTest, ctx: Omit<HelperContext, "now">): TestResult {
  const { tokens } = tokenize(t.text)
  const out = assemble(t.wiring ?? { segments: [] }, tokens, t.text, { ...ctx, now: new Date(t.now) })
  return compare(out.blocks.map(rowOf), t.expect)
}

const seg = (o: Partial<WiredSegment>): WiredSegment => ({ activity: "", place: "", day: "", start: "", end: "", maybeEnd: "", length: "", startVague: false, endVague: false, notes: "", with: "", mood: "", ...o })

export const FRIDAY_TEXT = `on Friday I was definitely walking around Ocean beach at least from 4:30 - 5 pm but potentially longer, maybe until 5:30, FOR SURE left at 4:30. from sometime after 5:55, I started doing the dishes, which i did until 6:19 , then I took out the trash (a task I had seriously been resisting) in the rain and threw out a neighbor's trash abandoned by the dumpster too which i counted as a good deed for the day. by 6:22 the trash stuff was done. seem to have maybe been scrolling from 6:30 - 7:19 ish around 7:34 started actually working on foxtide cd stuff. not sure for how long though. And then october 31st went for a walk from around 5:50ish until exactly 6:27 scrolled until about 7:30`

const row = (day: string, activity: string, start: string, startCert: ExpectRow["startCert"], end: string, endCert: ExpectRow["endCert"], place = ""): ExpectRow => ({ day, activity, start, startCert, end, endCert, place })

export const SHIPPED_TESTS: HelperTest[] = [
  {
    id: "friday-two-days",
    name: "Friday evening and Oct 31: chains, hedges, an open end",
    text: FRIDAY_TEXT,
    now: new Date(2026, 10, 1, 12, 0).toISOString(),
    wiring: {
      segments: [
        seg({ activity: "walking", place: "Ocean Beach", day: "D1", start: "T1", end: "T2", maybeEnd: "T3", endVague: true, notes: "walk may have gone on until 5:30" }),
        seg({ activity: "dishes", start: "T5", end: "T6" }),
        seg({ activity: "taking out trash", end: "T7", notes: "overcame resistance; took out a neighbor's trash too (good deed)" }),
        seg({ activity: "scrolling", start: "T8", end: "T9" }),
        seg({ activity: "foxtide cd work", start: "T10" }),
        seg({ activity: "walking", day: "D2", start: "T11", end: "T12" }),
        seg({ activity: "scrolling", end: "T13" }),
      ],
    },
    expect: [
      row("2026-10-30", "walking", "4:30 PM", "exact", "5:00 PM", "estimated", "Ocean Beach"),
      row("2026-10-30", "dishes", "5:55 PM", "estimated", "6:19 PM", "exact", "Home"),
      row("2026-10-30", "taking out trash", "6:19 PM", "exact", "6:22 PM", "exact", "Home"),
      row("2026-10-30", "scrolling", "6:30 PM", "estimated", "7:19 PM", "estimated"),
      row("2026-10-30", "foxtide cd work", "7:34 PM", "estimated", "8:04 PM", "estimated"),
      row("2026-10-31", "walking", "5:50 PM", "estimated", "6:27 PM", "exact"),
      row("2026-10-31", "scrolling", "6:27 PM", "exact", "7:30 PM", "estimated"),
    ],
  },
  {
    id: "morning-no-day",
    name: "No day word: the latest day it has already happened",
    text: "ran from 7 until 7:45 this morning, then breakfast til 8:10",
    now: new Date(2026, 10, 1, 12, 0).toISOString(),
    wiring: { segments: [seg({ activity: "running", start: "T1", end: "T2" }), seg({ activity: "breakfast", end: "T3" })] },
    expect: [row("2026-11-01", "running", "7:00 AM", "exact", "7:45 AM", "exact"), row("2026-11-01", "breakfast", "7:45 AM", "exact", "8:10 AM", "exact")],
  },
  {
    id: "length-not-end",
    name: "A length instead of an end",
    text: "yesterday at 3 I napped for an hour",
    now: new Date(2026, 10, 1, 12, 0).toISOString(),
    wiring: { segments: [seg({ activity: "napping", day: "D1", start: "T1", length: "U1" })] },
    expect: [row("2026-10-31", "napping", "3:00 PM", "exact", "4:00 PM", "estimated", "Home")],
  },
]

const KEY = "trackinghelper-tests-v1"

export function loadTests(): HelperTest[] {
  try {
    const mine = JSON.parse(localStorage.getItem(KEY) ?? "[]") as HelperTest[]
    return [...SHIPPED_TESTS, ...mine]
  } catch {
    return SHIPPED_TESTS
  }
}

export function saveMine(tests: HelperTest[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tests.filter((t) => !SHIPPED_TESTS.some((s) => s.id === t.id))))
  } catch {}
}
