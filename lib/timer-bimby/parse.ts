/**
 * lib/timer-bimby/parse.ts — What a line asks of the Timer BIMBY
 *
 * Pure. Only lines that say "timer", "time me" or "stopwatch" are read, so a plain "starting dishes" stays the
 * grammar lane's activity start. A start may carry a countdown length ("set a timer for 20 minutes") and a label
 * taken from the line ("start with the kitchen … start a timer" → "kitchen").
 */

export type TimerAsk =
  | { kind: "start"; label?: string; minutes?: number }
  | { kind: "stop" }
  | { kind: "cancel" }
  | { kind: "status" }

const TIMER = /\b(?:timer|stop\s?watch|time\s+me|time\s+this|time\s+it)\b/i
const STOP = /\b(?:stop|end|pause|finish(?:ed)?|done)\b[^.?!]{0,20}\b(?:timer|stop\s?watch|timing)\b|\b(?:timer|stop\s?watch)\b[^.?!]{0,12}\b(?:stop|off|done)\b|\bstop\s+timing\b|\bi'?m\s+done\b[^.?!]{0,20}\btimer\b/i
const CANCEL = /\b(?:cancel|clear|scrap|reset|kill|delete)\b[^.?!]{0,20}\b(?:timer|stop\s?watch)\b/i
const STATUS = /\b(?:how\s+long|how\s+much\s+time|time\s+left|where'?s|what'?s)\b[^.?!]{0,30}\b(?:timer|stop\s?watch)\b|\b(?:timer|stop\s?watch)\b\s*(?:status|\?)\s*$|^\s*timer\s*$/i
// "start and timer now" is a slip for "start a timer now"; set, run and begin start one too.
const START = /\b(?:start(?:ing)?|set(?:ting)?|run|begin|put|kick\s+off|turn\s+on)\b[^.?!]{0,16}\b(?:timer|stop\s?watch)\b|\btime\s+(?:me|this|it)\b|\b(?:timer|stop\s?watch)\s+(?:for|on|now)\b|\b\d+\s*(?:-|\s)?(?:min(?:ute)?s?|m|hours?|hrs?|h)\s+timer\b/i

const UNITS: Record<string, number> = { h: 60, hr: 60, hrs: 60, hour: 60, hours: 60 }

/** "20 minutes", "1.5 hours", "an hour", "half an hour", "1h 30m": a countdown length in minutes. */
export function readMinutes(text: string): number | undefined {
  const t = text.toLowerCase()
  if (/\bhalf\s+an?\s+hour\b/.test(t)) return 30
  if (/\b(?:an|one)\s+hour\b/.test(t)) return 60
  const hm = /\b(\d+)\s*h(?:ours?|rs?)?\s*(?:and\s+)?(\d+)\s*m(?:in(?:ute)?s?)?\b/.exec(t)
  if (hm) return Number(hm[1]) * 60 + Number(hm[2])
  const one = /\b(\d+(?:\.\d+)?)\s*(?:-|\s)?(min(?:ute)?s?|m|hours?|hrs?|hr|h)\b/.exec(t)
  if (!one) return undefined
  const n = Number(one[1])
  const per = UNITS[one[2]!] ?? 1
  const minutes = Math.round(n * per)
  return minutes > 0 && minutes <= 24 * 60 ? minutes : undefined
}

const FILLER = /^(?:the|a|an|my|this|that|some|doing|to)\s+/i

/** The thing being timed, when the line names one: "start with the kitchen", "timer for dishes", "how long it takes me to fold laundry". */
export function readLabel(text: string): string | undefined {
  const tries = [
    /\bhow\s+long\s+(?:it\s+takes?\s+(?:me\s+)?|i\s+take\s+)?to\s+([a-z][a-z' -]{1,40}?)(?=[.,!?]|\s+(?:and|then|now|rn)\b|$)/i,
    /\b(?:start(?:ing)?|begin(?:ning)?)\s+(?:with|on)\s+([a-z][a-z' -]{1,40}?)(?=[.,!?]|\s+(?:and|then|now|rn|first)\b|$)/i,
    /\b(?:timer|time\s+me)\s+(?:for|on|while\s+i)\s+(?!\d)([a-z][a-z' -]{1,40}?)(?=[.,!?]|\s+(?:and|then|now|rn)\b|$)/i,
    /\b(?:timer|time\s+me)\s+(?:for|on)\s+\d[^,.!?]*?\b(?:for|on|while\s+i)\s+([a-z][a-z' -]{1,40}?)(?=[.,!?]|\s+(?:and|then|now|rn)\b|$)/i,
  ]
  for (const re of tries) {
    const m = re.exec(text)
    if (!m) continue
    let label = m[1]!.trim()
    while (FILLER.test(label)) label = label.replace(FILLER, "")
    label = label.replace(/\s+(?:now|rn|please|pls)$/i, "").trim()
    if (label && !/^(?:it|this|that|now|me|timer)$/i.test(label) && label.split(/\s+/).length <= 4) return label
  }
  return undefined
}

export function readTimerAsk(text: string): TimerAsk | null {
  const t = text.trim()
  if (!t || !TIMER.test(t)) return null
  if (CANCEL.test(t)) return { kind: "cancel" }
  if (STOP.test(t)) return { kind: "stop" }
  if (STATUS.test(t)) return { kind: "status" }
  if (!START.test(t)) return null
  const minutes = /\btimer\s+for\b|\b(?:set|start)\b[^.?!]{0,16}\btimer\b[^.?!]*\bfor\b|\d\s*(?:-|\s)?(?:min(?:ute)?s?|m|hours?|hrs?|h)\s+timer\b|\bhalf\s+an\s+hour\b|\ban\s+hour\b/i.test(t)
    ? readMinutes(t)
    : undefined
  const label = readLabel(t)
  return { kind: "start", ...(label ? { label } : {}), ...(minutes ? { minutes } : {}) }
}

/** "32 min", "1 hr 5 min", "45 sec". */
export function formatSpan(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s} sec`
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest ? `${h} hr ${rest} min` : `${h} hr`
}

/** "12:41", "1:02:07": the face of a running timer. */
export function formatFace(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}
