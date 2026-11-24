/**
 * lib/day-log-bimby/compose.ts — The model writes the narrative, window by window
 *
 * The local model runs at a fixed 4096-token context (`lib/bim-flow/ollama.ts`),
 * so a whole day does not fit in one call. The timed ledger is cut into windows
 * (at the parts of the day, and again when a part runs long); each window is one
 * call that writes that stretch as prose, citing rows as [E12]. A last call reads
 * the window texts plus the untimed rows and writes the brief, the feelings and
 * the open questions. A citation to a row that does not exist is removed.
 *
 * The rules in `WINDOW_SYSTEM` are the house standard for a Day Log; they are
 * also written out in `docs/DAY_LOG.md`.
 */

import type { ModelCall } from "@/lib/bim-flow/ollama"
import { clock, duration } from "./gather"
import { SOURCE_LABEL, type DayNarrative, type Evidence } from "./types"

/** Parts of the day. The doc's hour-by-hour section uses the same cuts. */
export const PARTS: { name: string; from: number; to: number }[] = [
  { name: "Night", from: 0, to: 360 },
  { name: "Morning", from: 360, to: 720 },
  { name: "Afternoon", from: 720, to: 1020 },
  { name: "Evening", from: 1020, to: 1260 },
  { name: "Late night", from: 1260, to: 1440 },
]

/** Characters of ledger per window call. About 2,000 tokens, leaving room for the rules and the answer. */
export const WINDOW_CHARS = 6000

const SCREEN = new Set(["screen-mac", "screen-phone"])

function rowLine(e: Evidence): string {
  const when = e.startMin === null ? "time unknown" : e.endMin !== undefined ? `${clock(e.startMin)}–${clock(e.endMin)} (${duration(e.endMin - e.startMin)})` : clock(e.startMin)
  const flags = [e.estimated ? "estimated time" : "", e.machine ? "recorded automatically" : ""].filter(Boolean)
  const words = e.ownWords ? ` | in their words: "${e.ownWords.slice(0, 600)}"` : ""
  return `E${e.n} ${when} ${SOURCE_LABEL[e.source]}: ${e.what}${words}${flags.length ? ` [${flags.join(", ")}]` : ""}`
}

/**
 * One window's ledger lines. Screen time is folded into one line per device and
 * app, and texts into one line per person, so a day of 400 texts still fits.
 */
export function windowLedger(rows: readonly Evidence[]): string[] {
  const lines: string[] = []
  const screen = new Map<string, { n: number; min: number; device: string }>()
  const texts = new Map<string, { n: number; out: number; in: number; from: number; to: number; samples: string[] }>()
  for (const e of rows) {
    if (SCREEN.has(e.source) && e.startMin !== null && e.endMin !== undefined) {
      const app = e.what.split(" · ")[0]!
      const key = `${e.source}:${app}`
      const held = screen.get(key) ?? { n: e.n, min: 0, device: e.source === "screen-mac" ? "Mac" : "iPhone" }
      held.min += e.endMin - e.startMin
      screen.set(key, held)
      continue
    }
    if (e.source === "text" && e.person) {
      const held = texts.get(e.person) ?? { n: e.n, out: 0, in: 0, from: e.startMin ?? 0, to: e.startMin ?? 0, samples: [] }
      if (e.dir === "out") held.out++
      else held.in++
      held.to = e.startMin ?? held.to
      if (held.samples.length < 4) held.samples.push(`${e.dir === "out" ? "me" : e.person}: ${e.what.replace(/^[^:]*:\s*/, "")}`)
      texts.set(e.person, held)
      continue
    }
    lines.push(rowLine(e))
  }
  for (const [person, t] of texts) {
    lines.push(`E${t.n} ${clock(t.from)}–${clock(t.to)} Texts with ${person}: ${t.out} sent, ${t.in} received. ${t.samples.join(" / ")} [recorded automatically]`)
  }
  const apps = [...screen].sort((a, b) => b[1].min - a[1].min).slice(0, 8)
  if (apps.length) lines.push(`E${apps[0]![1].n} Screen time in this stretch: ${apps.map(([k, v]) => `${k.split(":").slice(1).join(":")} on ${v.device} ${v.min} min`).join(", ")} [recorded automatically]`)
  return lines
}

/** The timed ledger cut into windows that each fit one call. */
export function windowsOf(evidence: readonly Evidence[]): { fromMin: number; toMin: number; rows: Evidence[]; lines: string[] }[] {
  const out: { fromMin: number; toMin: number; rows: Evidence[]; lines: string[] }[] = []
  for (const part of PARTS) {
    const inPart = evidence.filter((e) => e.startMin !== null && e.startMin >= part.from && e.startMin < part.to && e.source !== "amendment")
    if (!inPart.some((e) => !SCREEN.has(e.source))) continue
    let start = 0
    while (start < inPart.length) {
      let end = inPart.length
      // Shrink until the folded lines fit.
      while (end - start > 1 && windowLedger(inPart.slice(start, end)).join("\n").length > WINDOW_CHARS) end = start + Math.max(1, Math.floor((end - start) * 0.7))
      const rows = inPart.slice(start, end)
      const fromMin = start === 0 ? part.from : rows[0]!.startMin!
      const toMin = end >= inPart.length ? part.to : inPart[end]!.startMin!
      out.push({ fromMin, toMin, rows, lines: windowLedger(rows) })
      start = end
    }
  }
  return out
}

export const WINDOW_SYSTEM = [
  "You write one stretch of a person's Day Log: an exact, detailed, first-person account of what they did, where, with whom, for how long, and how they felt.",
  "Rules:",
  "1. Use only the numbered evidence. Never invent an event, a person, a place, a time or a feeling. If evidence disagrees, say both and which is more likely. Do not say I woke up, fell asleep, went somewhere or felt something unless a row says so.",
  "2. Lines marked 'My correction', 'My addition' or 'My note' are the person's amendments. They win over every other row.",
  "3. Go in clock order. Give exact clock times (HH:MM, 24-hour) and durations from the evidence. Mark guessed times with '~'.",
  "4. Say where they were, who they were with or talked to (calls, texts), what was on their screens, what they ate or took, and how they said they felt.",
  "5. After each sentence, cite the rows it comes from as [E12] or [E12, E15].",
  "6. Write in first person ('I'), plain past tense, no praise, no advice, no filler. Quote their own words in “curly quotes” when they said something worth keeping.",
  "7. Name gaps honestly: if nothing is known for a stretch, say so in one short sentence.",
  "8. Be thorough: every evidence row should appear in the text, except screen-time rows, which you may sum up.",
  'Reply with JSON: {"text": "<the paragraph or paragraphs>"}.',
].join("\n")

export const DAY_SYSTEM = [
  "You finish a person's Day Log. You get the stretch-by-stretch account of the day, the untimed facts, and their amendments.",
  "Write, from that material only:",
  "- brief: 3 to 6 sentences, first person, the shape of the whole day: when it started and ended, the main things done, where, with whom. Cite rows as [E12].",
  "- feelings: 1 to 4 sentences on how they felt, only from mood rows and their own words. If nothing says how they felt, reply with an empty string, not a sentence saying so.",
  "- questions: up to 5 short questions about the day's biggest unknowns: a stretch with no activity (\"What were you doing from 14:10 to 16:00?\"), a place, who they were with, or two rows that disagree. Never ask what a word, an app, a project or a message means.",
  "Amendments (My correction / My addition / My note) win over everything else. Invent nothing.",
  'Reply with JSON: {"brief": "...", "feelings": "...", "questions": ["..."]}.',
].join("\n")

const TEXT_SCHEMA = { type: "object", properties: { text: { type: "string" } }, required: ["text"] }
const DAY_SCHEMA = {
  type: "object",
  properties: { brief: { type: "string" }, feelings: { type: "string" }, questions: { type: "array", items: { type: "string" } } },
  required: ["brief", "feelings", "questions"],
}

/** Drop citations to rows the ledger does not have; keep the rest as written. */
export function checkCitations(text: string, known: ReadonlySet<number>): string {
  return text
    .replace(/\[(E\d+(?:\s*,\s*E?\d+)*)\]/g, (_, inner: string) => {
      const ok = inner
        .split(/\s*,\s*/)
        .map((s) => Number(s.replace(/^E/, "")))
        .filter((n) => known.has(n))
      return ok.length ? `[${ok.map((n) => `E${n}`).join(", ")}]` : ""
    })
    .replace(/\s+([.,;])/g, "$1")
    .trim()
}

function amendmentLines(evidence: readonly Evidence[]): string[] {
  return evidence.filter((e) => e.source === "amendment").map((e) => `E${e.n} ${e.startMin === null ? "" : `${clock(e.startMin)} `}${e.what.replace(/^My /, "My ").replace(/^./, (c) => c.toUpperCase())}: "${e.ownWords}"`)
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timed out")), ms)
    p.then((v) => (clearTimeout(t), resolve(v)), (e) => (clearTimeout(t), reject(e)))
  })
}

/** A feelings answer that only says nothing is known. The doc says that itself. */
export const NO_FEELING = /\b(?:no (?:information|indication|mention|record|data|evidence)|(?:do(?:es)? not|don't|doesn't) (?:specify|say|mention|indicate|show)|not (?:specified|mentioned|recorded|known)|nothing (?:says|indicates|about))\b/i

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

/**
 * The narrative for a day. Each failed window is left out (the doc still lists its rows);
 * `onWindow` reports progress. Returns null when no call worked.
 */
export async function composeNarrative(
  date: string,
  evidence: readonly Evidence[],
  call: ModelCall,
  opts: { onWindow?: (done: number, total: number) => void; timeoutMs?: number } = {},
): Promise<DayNarrative | null> {
  const known = new Set(evidence.map((e) => e.n))
  const amends = amendmentLines(evidence)
  const windows = windowsOf(evidence)
  const out: DayNarrative["windows"] = []
  let worked = 0
  for (const [i, w] of windows.entries()) {
    const user = [
      `Day: ${date}. Stretch: ${clock(w.fromMin)}–${clock(w.toMin)}.`,
      amends.length ? `Amendments (these win):\n${amends.join("\n")}` : "",
      `Evidence:\n${w.lines.join("\n")}`,
    ]
      .filter(Boolean)
      .join("\n\n")
    try {
      const reply = (await withTimeout(call({ system: WINDOW_SYSTEM, user, schema: TEXT_SCHEMA, maxTokens: 900, temperature: 0 }), opts.timeoutMs ?? 150_000)) as { text?: unknown }
      const text = checkCitations(str(reply?.text), known)
      if (text) {
        out.push({ fromMin: w.fromMin, toMin: w.toMin, text })
        worked++
      }
    } catch {
      /* the window's rows still show in the doc */
    }
    opts.onWindow?.(i + 1, windows.length + 1)
  }

  const untimed = evidence.filter((e) => e.startMin === null && e.source !== "amendment").map(rowLine)
  const story = out.map((w) => `${clock(w.fromMin)}–${clock(w.toMin)}: ${w.text}`).join("\n\n")
  let brief = ""
  let feelings = ""
  let questions: string[] = []
  try {
    const user = [`Day: ${date}.`, amends.length ? `Amendments (these win):\n${amends.join("\n")}` : "", untimed.length ? `Untimed facts:\n${untimed.join("\n")}` : "", `The day, stretch by stretch:\n${story || "(no stretch was written)"}`]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 7500)
    const reply = (await withTimeout(call({ system: DAY_SYSTEM, user, schema: DAY_SCHEMA, maxTokens: 700, temperature: 0 }), opts.timeoutMs ?? 150_000)) as { brief?: unknown; feelings?: unknown; questions?: unknown }
    brief = checkCitations(str(reply?.brief), known)
    feelings = checkCitations(str(reply?.feelings), known)
    if (NO_FEELING.test(feelings)) feelings = ""
    questions = Array.isArray(reply?.questions) ? reply.questions.map(str).filter(Boolean).slice(0, 5) : []
    if (brief || feelings || questions.length) worked++
  } catch {
    /* the doc's code brief stands in */
  }
  opts.onWindow?.(windows.length + 1, windows.length + 1)
  return worked ? { windows: out, brief, feelings, questions } : null
}
