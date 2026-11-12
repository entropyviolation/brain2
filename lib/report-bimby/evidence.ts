/**
 * lib/report-bimby/evidence.ts — Everything the app knows about a stretch of time, as one list of signals
 *
 * Pure. The caller hands in what the stores and the hub hold; this turns it into dated "signs of
 * life": Mac Screen Time (which app), iPhone Screen Time, Chrome visits, texts you sent, BIM chat
 * lines, log and Inbox items, and file changes. A *hard* signal proves the person was awake and at
 * a device (the learned rule in `docs/BIM_SIGNALS_PLAYBOOK.md`: no text was ever sent inside a
 * logged sleep block). A text that came *in* is soft: a phone receives while its owner sleeps.
 * Absence is weak, presence is strong, so the helpers here only ever use presence to move a time.
 */

import { categoryOf, type Visit } from "@/lib/browser-history"
import type { FileEvent } from "@/lib/bim-flow/file-activity"
import type { TextRow } from "@/lib/bim-flow/texts"
import type { HistoryEntry } from "@/lib/bim-flow/vault-search"
import { fmtClock } from "./time"

const MIN = 60_000

export type SignalKind = "mac" | "phone" | "chrome" | "text-out" | "text-in" | "file" | "bim" | "log" | "item"

export interface Signal {
  t: number
  end: number
  kind: SignalKind
  /** The app, host, path or title this came from. */
  label: string
  /** Proves the person was awake and at a device. */
  hard: boolean
}

export interface EvidenceInput {
  /** Chrome visits kept on this computer; null when this device has none. */
  visits: Visit[] | null
  /** Every Tracking entry (history entries carry a local `date` and minutes). */
  entries: HistoryEntry[]
  /** Texts from the phone hub; null when the hub could not be reached. */
  texts: TextRow[] | null
  /** File changes from the hub; null when unavailable. */
  files: FileEvent[] | null
  feed: { at: string; text: string }[]
  logs: { at: string; text: string }[]
  /** Items created (Inbox and every list), epoch ms. */
  items: { at: number; title: string }[]
}

export interface Evidence {
  signals: Signal[]
  /** One line per source: how much it holds and how recent, so a missing source is said, not silent. */
  sources: string[]
  texts: TextRow[] | null
  entries: HistoryEntry[]
}

const dayStart = (date: string): number => {
  const [y, m, d] = date.split("-").map(Number)
  return new Date(y!, m! - 1, d!).getTime()
}

/** Apps that are the person working on a build, not browsing. Declared by the person's own rules in `screen-presence.ts` plus the usual tools. */
const DEV_APP = /^(cursor|code|visual studio code|xcode|terminal|iterm2?|warp|godot|unity|blender|aseprite|android studio|comfyui|claude)\b/i
const MEDIA_APP = /youtube|netflix|twitch|instagram|tiktok|reddit|twitter|facebook|pinterest|discord|^x$/i

export function buildEvidence(input: EvidenceInput): Evidence {
  const signals: Signal[] = []
  const sources: string[] = []
  const newest = (ts: number[]) => (ts.length ? fmtStamp(Math.max(...ts)) : "none")

  const mac: number[] = []
  const phone: number[] = []
  for (const e of input.entries) {
    if (e.instant && e.scope !== "screentime" && e.scope !== "iphone-screentime") continue
    const base = dayStart(e.date)
    const t = base + e.startMin * MIN
    const end = base + Math.max(e.endMin, e.startMin + 1) * MIN
    if (e.scope === "screentime") {
      mac.push(end)
      signals.push({ t, end, kind: "mac", label: e.pen, hard: true })
    } else if (e.scope === "iphone-screentime") {
      phone.push(end)
      signals.push({ t, end, kind: "phone", label: e.pen, hard: true })
    }
  }
  sources.push(`Mac Screen Time: ${mac.length} entries, newest ${newest(mac)}.`)
  sources.push(`iPhone Screen Time: ${phone.length} entries, newest ${newest(phone)}.`)

  if (input.visits) {
    for (const v of input.visits) signals.push({ t: v.t, end: v.t + 2 * MIN, kind: "chrome", label: v.host, hard: true })
    sources.push(`Chrome history: ${input.visits.length.toLocaleString()} visits kept, newest ${newest(input.visits.map((v) => v.t))}.`)
  } else sources.push("Chrome history: none kept on this device.")

  if (input.texts) {
    const sent = input.texts.filter((r) => r.dir === "out").map((r) => new Date(r.at).getTime())
    for (const r of input.texts) {
      const t = new Date(r.at).getTime()
      signals.push({ t, end: t + MIN, kind: r.dir === "out" ? "text-out" : "text-in", label: r.who, hard: r.dir === "out" })
    }
    sources.push(`Texts: ${input.texts.length} in the window (${sent.length} sent), last sent ${newest(sent)}.`)
  } else sources.push("Texts: the phone hub could not be reached from this window.")

  if (input.files) {
    for (const f of input.files) signals.push({ t: f.at, end: f.at + MIN, kind: "file", label: f.p, hard: false })
    sources.push(`File changes: ${input.files.length} in the window, newest ${newest(input.files.map((f) => f.at))}.`)
  } else sources.push("File changes: the hub could not be reached from this window.")

  const bim = input.feed.map((f) => new Date(f.at).getTime()).filter(Number.isFinite)
  for (const f of input.feed) {
    const t = new Date(f.at).getTime()
    if (Number.isFinite(t)) signals.push({ t, end: t + MIN, kind: "bim", label: f.text.slice(0, 60), hard: true })
  }
  for (const l of input.logs) {
    const t = new Date(l.at).getTime()
    if (Number.isFinite(t)) signals.push({ t, end: t + MIN, kind: "log", label: l.text.slice(0, 60), hard: true })
  }
  for (const i of input.items) signals.push({ t: i.at, end: i.at + MIN, kind: "item", label: i.title.slice(0, 60), hard: true })
  sources.push(`BIM chat and Telegram: ${bim.length} lines, newest ${newest(bim)}. Log items: ${input.logs.length}. Items created: ${input.items.length}.`)

  signals.sort((a, b) => a.t - b.t)
  return { signals, sources, texts: input.texts, entries: input.entries }
}

function fmtStamp(ms: number): string {
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()} ${fmtClock(ms)}`
}

const KIND_NAME: Record<SignalKind, string> = {
  mac: "Mac",
  phone: "iPhone",
  chrome: "Chrome",
  "text-out": "a text you sent",
  "text-in": "a text that came in",
  file: "a file change",
  bim: "a BIM/Telegram line",
  log: "a log item",
  item: "an item you created",
}

export const describeSignal = (s: Signal): string => `${fmtClock(s.t)} ${KIND_NAME[s.kind]}${s.kind === "mac" || s.kind === "phone" || s.kind === "chrome" || s.kind === "text-out" ? ` (${s.label})` : ""}`

/** Hard signals inside [a, b]. */
export const hardIn = (ev: Evidence, a: number, b: number): Signal[] => ev.signals.filter((s) => s.hard && s.end >= a && s.t <= b)

/** The latest hard signal that began at or before `ms`, looking back `backMs`. */
export function lastHardBefore(ev: Evidence, ms: number, backMs: number): Signal | null {
  let best: Signal | null = null
  for (const s of ev.signals) if (s.hard && s.t <= ms && s.t >= ms - backMs && (!best || s.end > best.end)) best = s
  return best
}

/** The first hard signal at or after `ms`, looking ahead `aheadMs`. */
export function firstHardFrom(ev: Evidence, ms: number, aheadMs: number): Signal | null {
  return ev.signals.find((s) => s.hard && s.end >= ms && s.t <= ms + aheadMs) ?? null
}

export interface Run {
  start: number
  end: number
  n: number
  /** The most common labels, "Cursor ×14". */
  tops: string[]
}

/** Signals that pass `keep`, joined into runs where the gap is `gapMin` or less. */
export function runsWhere(ev: Evidence, a: number, b: number, keep: (s: Signal) => boolean, gapMin: number): Run[] {
  const runs: { start: number; end: number; labels: Map<string, number>; n: number }[] = []
  for (const s of ev.signals) {
    if (s.end < a || s.t > b || !keep(s)) continue
    const last = runs[runs.length - 1]
    if (last && s.t - last.end <= gapMin * MIN) {
      last.end = Math.max(last.end, s.end)
      last.n++
      last.labels.set(s.label, (last.labels.get(s.label) ?? 0) + 1)
    } else runs.push({ start: s.t, end: s.end, n: 1, labels: new Map([[s.label, 1]]) })
  }
  return runs.map((r) => ({ start: r.start, end: r.end, n: r.n, tops: [...r.labels].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([l, n]) => `${l} ×${n}`) }))
}

const words = (label: string) => label.toLowerCase().split(/\W+/).filter((w) => w.length >= 4 && !/^(working|with|that|this)$/.test(w))

/** Work on a build: dev apps on the Mac, local-dev/code/AI pages in Chrome, file changes whose path names the activity. */
export function isDevSignal(s: Signal, label: string): boolean {
  if ((s.kind === "mac" || s.kind === "phone") && DEV_APP.test(s.label)) return true
  if (s.kind === "chrome") {
    const c = categoryOf(s.label)
    return c === "Local dev" || c === "Code" || c === "AI & image gen"
  }
  if (s.kind === "file") {
    const p = s.label.toLowerCase().replace(/[:_\-.]/g, " ")
    return words(label).some((w) => p.includes(w))
  }
  return false
}

/** Watching or scrolling: video and social apps on either device, video and social sites in Chrome. */
export function isMediaSignal(s: Signal): boolean {
  if (s.kind === "mac" || s.kind === "phone") return MEDIA_APP.test(s.label)
  if (s.kind === "chrome") {
    const c = categoryOf(s.label)
    return c === "Video" || c === "Social"
  }
  return false
}

export const sourceCounts = (signals: Signal[]): string =>
  Object.entries(signals.reduce<Record<string, number>>((m, s) => ((m[KIND_NAME[s.kind]] = (m[KIND_NAME[s.kind]] ?? 0) + 1), m), {}))
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ×${n}`)
    .join(", ")

/** Screen Time minutes per app inside [a, b], top four, "Cursor 95m, YouTube 40m". Empty when none. */
export function appMinutes(ev: Evidence, a: number, b: number): string {
  const by = new Map<string, number>()
  for (const s of ev.signals) {
    if (s.kind !== "mac" && s.kind !== "phone") continue
    const m = Math.min(s.end, b) - Math.max(s.t, a)
    if (m > 0) by.set(`${s.label}${s.kind === "phone" ? " (phone)" : ""}`, (by.get(`${s.label}${s.kind === "phone" ? " (phone)" : ""}`) ?? 0) + m)
  }
  return [...by].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([l, ms]) => `${l} ${Math.round(ms / MIN)}m`).join(", ")
}
