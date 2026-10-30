/**
 * lib/browser-history.ts — Chrome history export → analysis (Sources → Browser)
 *
 * Pure. Input is one file per Chrome profile from Quick Chrome History Export
 * (JSON, CSV, or the row objects of its Excel file) or a Google Takeout
 * "Browser History" JSON. Rows merge across profiles. A visit already kept
 * (same URL, same millisecond, or the same second when one side lost
 * milliseconds) is not added again. Nothing here reads a store or the network.
 * YouTube topics come from the page title only (the export has no channel or
 * description), so they are keyword guesses.
 */

export interface RawVisit {
  visitTime: number
  title?: string
  url: string
  transition?: string
}

export interface Visit {
  t: number
  url: string
  host: string
  title: string
  transition: string
  profile: string
}

export interface HistoryFile {
  profile: string
  rows: RawVisit[]
}

export const SESSION_GAP_MIN = 30

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "")
  } catch {
    return "other"
  }
}

/** File name without the export extension. That name is the profile label. */
export function profileLabel(filename: string): string {
  const base = filename.replace(/\.(json|csv|xlsx|xls)$/i, "").trim()
  return base || "Chrome"
}

function stringField(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key]
    if (typeof v === "string" && v.trim()) return v.trim()
    if (typeof v === "number" && Number.isFinite(v)) return String(v)
  }
  return null
}

/** Chrome's clock (microseconds since 1601) and Unix seconds, ms, or µs → Unix ms. */
export function coerceVisitTime(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return epochMs(raw)
  if (typeof raw === "string" && raw.trim()) {
    const text = raw.trim()
    if (/^\d+(\.\d+)?$/.test(text)) return epochMs(Number(text))
    const parsed = Date.parse(text)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function epochMs(n: number): number | null {
  if (!(n > 0)) return null
  // WebKit/Chrome microseconds since 1601-01-01 (~1.3e16 in the 2020s).
  if (n > 1e16) {
    const ms = n / 1000 + Date.UTC(1601, 0, 1)
    return ms > 0 ? ms : null
  }
  if (n > 1e14) return n / 1000
  if (n > 1e11) return n
  if (n > 1e9) return n * 1000
  return null
}

/** Local calendar date plus clock time, as Quick Chrome History Export writes them. */
export function localDateTime(date: unknown, time: unknown): number | null {
  if (date instanceof Date && Number.isFinite(date.getTime()) && (time == null || time === "")) return date.getTime()
  const dateText = typeof date === "number" && date > 20000 && date < 80000 ? excelSerial(date) : typeof date === "string" ? date.trim() : ""
  if (!dateText) return null
  const parts = /^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/.exec(dateText)
  if (!parts) return null
  let year: number
  let month: number
  let day: number
  if (parts[1].length === 4) {
    year = Number(parts[1])
    month = Number(parts[2])
    day = Number(parts[3])
  } else {
    month = Number(parts[1])
    day = Number(parts[2])
    year = Number(parts[3])
    if (year < 100) year += 2000
    if (month > 12 && day <= 12) {
      const swap = month
      month = day
      day = swap
    }
  }
  let hour = 0
  let minute = 0
  let second = 0
  if (typeof time === "number" && time >= 0 && time < 1) {
    const total = Math.round(time * 86400)
    hour = Math.floor(total / 3600)
    minute = Math.floor((total % 3600) / 60)
    second = total % 60
  } else if (typeof time === "string" && time.trim()) {
    const clock = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap]m)?$/i.exec(time.trim())
    if (!clock) return null
    hour = Number(clock[1])
    minute = Number(clock[2])
    second = clock[3] ? Number(clock[3]) : 0
    const ampm = clock[4]?.toLowerCase()
    if (ampm) {
      if (hour === 12) hour = ampm === "am" ? 0 : 12
      else if (ampm === "pm") hour += 12
    }
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null
  const stamp = new Date(year, month - 1, day, hour, minute, second).getTime()
  return Number.isFinite(stamp) ? stamp : null
}

function excelSerial(serial: number): string {
  const utc = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000)
  return `${utc.getUTCMonth() + 1}/${utc.getUTCDate()}/${utc.getUTCFullYear()}`
}

/** One export row → a visit, or null when the url or the time is missing. */
export function coerceRaw(row: unknown): RawVisit | null {
  if (!row || typeof row !== "object") return null
  const record = row as Record<string, unknown>
  const url = stringField(record, ["url", "URL", "Url"])
  if (!url || url.length > 8000) return null
  let visitTime = coerceVisitTime(record.visitTime ?? record.lastVisitTime ?? record.time_usec ?? record.visit_time)
  if (visitTime == null) visitTime = localDateTime(record.date ?? record.Date, record.time ?? record.Time)
  if (visitTime == null) return null
  const transition = (stringField(record, ["transition", "page_transition", "Transition"]) ?? "link").toLowerCase()
  return { visitTime, url, title: stringField(record, ["title", "Title"]) ?? "", transition }
}

export function visitsFromRecords(rows: unknown[]): RawVisit[] {
  const out: RawVisit[] = []
  for (const row of rows) {
    const visit = coerceRaw(row)
    if (visit) out.push(visit)
  }
  return out
}

/** Brain2 Chrome extension envelope, or a bare visit list. Null when nothing in it is a visit. */
export function historyFileFromPayload(payload: unknown, fallbackProfile = "Chrome"): HistoryFile | null {
  if (Array.isArray(payload)) {
    const rows = visitsFromRecords(payload)
    return rows.length ? { profile: fallbackProfile, rows } : null
  }
  if (!payload || typeof payload !== "object") return null
  const record = payload as Record<string, unknown>
  if (!Array.isArray(record.visits)) return null
  const rows = visitsFromRecords(record.visits)
  if (!rows.length) return null
  const named = typeof record.profile === "string" ? record.profile.trim().slice(0, 80) : ""
  return { profile: named || fallbackProfile, rows }
}

function unwrapHistory(parsed: unknown): unknown[] | null {
  if (Array.isArray(parsed)) return parsed
  if (!parsed || typeof parsed !== "object") return null
  const record = parsed as Record<string, unknown>
  for (const key of ["history", "History", "Browser History", "visits", "rows"]) {
    if (Array.isArray(record[key])) return record[key]
  }
  return null
}

function splitCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  const src = text.replace(/^\uFEFF/, "")
  for (let i = 0; i < src.length; i++) {
    const char = src[i]
    if (quoted) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += char
    } else if (char === '"') quoted = true
    else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else if (char !== "\r") cell += char
  }
  if (cell.length || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((line) => line.some((value) => value.trim()))
}

/** JSON or CSV text from a history export. Throws a short Error when nothing in it is a visit. */
export function parseHistoryExport(text: string): RawVisit[] {
  const trimmed = text.replace(/^\uFEFF/, "").trim()
  if (!trimmed) throw new Error("This file is empty.")
  let rows: unknown[] | null = null
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      throw new Error("This is not a Chrome history export.")
    }
    rows = unwrapHistory(parsed)
    if (!rows) throw new Error("This is not a Chrome history export.")
  } else {
    const table = splitCsv(trimmed)
    const header = table[0]?.map((cell) => cell.trim().toLowerCase()) ?? []
    if (!header.includes("url")) throw new Error("This is not a Chrome history export.")
    rows = table.slice(1).map((line) => {
      const record: Record<string, string> = {}
      header.forEach((key, index) => {
        if (key) record[key] = line[index] ?? ""
      })
      return record
    })
  }
  const visits = visitsFromRecords(rows)
  if (!visits.length) throw new Error("This file has no visits with a url and a time.")
  return visits
}

function visitOf(row: RawVisit, profile: string): Visit | null {
  if (!row || typeof row.visitTime !== "number" || typeof row.url !== "string") return null
  return {
    t: row.visitTime,
    url: row.url,
    host: hostOf(row.url),
    title: row.title ?? "",
    transition: row.transition ?? "link",
    profile,
  }
}

export function mergeHistory(files: HistoryFile[]): Visit[] {
  const seen = new Set<string>()
  const out: Visit[] = []
  for (const file of files) {
    const within = new Map<string, number>()
    for (const row of file.rows) {
      const visit = visitOf(row, file.profile)
      if (!visit) continue
      const key = `${Math.round(visit.t)}|${visit.url}`
      const ordinal = (within.get(key) ?? 0) + 1
      within.set(key, ordinal)
      const id = `${key}#${ordinal}`
      if (seen.has(id)) continue
      seen.add(id)
      out.push(visit)
    }
  }
  return out.sort((a, b) => a.t - b.t)
}

/**
 * Add files to what is already kept. A later export never removes older visits,
 * and a visit already stored is not added again. CSV and Excel times are whole
 * seconds, so those match a visit in the same second.
 */
export function mergeInto(existing: Visit[], files: HistoryFile[]): Visit[] {
  const incoming = mergeHistory(files)
  if (!incoming.length) return existing
  const byUrl = new Map<string, Visit[]>()
  for (const visit of existing) {
    const list = byUrl.get(visit.url)
    if (list) list.push(visit)
    else byUrl.set(visit.url, [visit])
  }
  for (const list of byUrl.values()) list.sort((a, b) => a.t - b.t)
  const incByUrl = new Map<string, Visit[]>()
  for (const visit of incoming) {
    const list = incByUrl.get(visit.url)
    if (list) list.push(visit)
    else incByUrl.set(visit.url, [visit])
  }
  const fresh: Visit[] = []
  for (const [url, rows] of incByUrl) {
    rows.sort((a, b) => a.t - b.t)
    const have = byUrl.get(url)
    if (!have) fresh.push(...rows)
    else fresh.push(...unmatched(have, rows))
  }
  return fresh.length ? [...existing, ...fresh].sort((a, b) => a.t - b.t) : existing
}

function unmatched(have: Visit[], rows: Visit[]): Visit[] {
  const used = new Uint8Array(have.length)
  let start = 0
  const out: Visit[] = []
  for (const visit of rows) {
    const second = Math.floor(visit.t / 1000)
    const aligned = visit.t % 1000 === 0
    while (start < have.length && Math.floor(have[start].t / 1000) < second) start++
    let exact = -1
    let loose = -1
    for (let j = start; j < have.length; j++) {
      if (Math.floor(have[j].t / 1000) > second) break
      if (used[j]) continue
      if (Math.round(have[j].t) === Math.round(visit.t)) {
        exact = j
        break
      }
      if (loose < 0 && (aligned || have[j].t % 1000 === 0)) loose = j
    }
    const match = exact >= 0 ? exact : loose
    if (match >= 0) used[match] = 1
    else out.push(visit)
  }
  return out
}

/* ---------- categories ---------- */

export const CATEGORIES: [string, RegExp][] = [
  ["Local dev", /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/],
  ["Search", /(^|\.)(google\.[a-z.]+|bing\.com|duckduckgo\.com)$/],
  ["Video", /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|netflix\.com)$/],
  ["AI & image gen", /(^|\.)(claude\.ai|chatgpt\.com|openai\.com|midjourney\.com|gemini\.google\.com|perplexity\.ai|cursor\.com)$/],
  ["Code", /(^|\.)(github\.com|stackoverflow\.com|npmjs\.com|vercel\.com|developer\.mozilla\.org)$/],
  ["Social", /(^|\.)(instagram\.com|pinterest\.com|reddit\.com|x\.com|twitter\.com|tumblr\.com|tiktok\.com|facebook\.com|discord\.com)$/],
  ["Music", /(^|\.)(spotify\.com|bandcamp\.com|soundcloud\.com|genius\.com)$/],
  ["Docs & mail", /(^|\.)(docs\.google\.com|drive\.google\.com|mail\.google\.com|calendar\.google\.com|notion\.so|sheets\.google\.com)$/],
  ["Shopping", /(^|\.)(amazon\.com|etsy\.com|ebay\.com|depop\.com)$/],
  ["Reading", /(^|\.)(goodreads\.com|wikipedia\.org|medium\.com|substack\.com|archive\.org)$/],
]

export function categoryOf(host: string): string {
  for (const [name, re] of CATEGORIES) if (re.test(host)) return name
  return "Other"
}

/* ---------- YouTube ---------- */

export interface YouTubeVideo {
  id: string
  title: string
  topic: string
  first: number
  last: number
  views: number
  profile: string
}

const TOPICS: [string, RegExp][] = [
  ["Music", /^[^-:?]{2,40} - [^-:?]{2,50}$|\b(official (music )?video|lyrics?|live at|album|song|remix|feat\.?|ft\.?|mv|playlist|concert|acoustic|cover|instrumental|ost)\b/i],
  ["AI & tech", /\b(ai|a\.i\.|gpt|llm|claude|chatgpt|openai|neural|machine learning|robot|software|coding|programmer|python|javascript|react|app|iphone|computer|algorithm|tech|internet|crypto)\b/i],
  ["Data & design", /\b(data viz\w*|visuali[sz]ation|design|typography|graphic|infographic|animation|motion|art|illustrat\w*|aesthetic|architecture)\b/i],
  ["Science & math", /\b(science|physics|math\w*|chemistry|biology|space|universe|quantum|brain|neuro\w*|psycholog\w*|evolution|climate|planet|black hole|explained)\b/i],
  ["Philosophy & religion", /\b(philosoph\w*|religio\w*|god|bible|christian\w*|jesus|buddh\w*|ethic\w*|meaning|empathy|existential|theology|myth\w*|occult|tarot|astrology|spiritual\w*)\b/i],
  ["Politics & society", /\b(politic\w*|trump|biden|election|war|capitalis\w*|communis\w*|socialis\w*|economy|economics|labor|union|police|government|class|society|america\w*|russia\w*|china|israel|gaza|protest|rights|palestin\w*|israel\w*|country|media|president|congress|billionaire|corporate|ban(ned)?)\b/i],
  ["Celebrity & drama", /\b(ex.?wife|lawyers?|scandal|cancel\w*|influencer|youtuber|tiktoker|is back|arrested|trial|lawsuit|groomer|feud|beef|tea|updates?)\b/i],
  ["Film & TV", /\b(movie|film|trailer|episode|season|series|netflix|anime|cartoon|review|ending explained|scene|director|cinema|garden wall|tv show|breakdown|recap|ladybug|premise|disney|pixar|despicable)\b/i],
  ["Gaming", /\b(game|gaming|gameplay|playthrough|speedrun|minecraft|zelda|nintendo|playstation|xbox|elden ring|pokemon|poker|chess)\b/i],
  ["Comedy & internet", /\b(funny|comedy|meme|skit|stand.?up|sketch|parody|react\w*|try not|vlog|storytime|drama|exposed)\b/i],
  ["Food & home", /\b(recipe|cook\w*|baking|food|kitchen|diy|makeup|skincare|fashion|outfit|haul|clean\w*|garden\w*|plant\w*)\b/i],
  ["Body & health", /\b(workout|fitness|yoga|diet|health|sleep|therapy|adhd|anxiety|depress\w*|trauma|mental|medit\w*|nutrition)\b/i],
  ["Money & business", /\b(money|invest\w*|stock|business|startup|entrepreneur|income|budget|finance|real estate)\b/i],
  ["History & culture", /\b(history|ancient|medieval|middle ages|empire|culture|documentary|secret|town|hours in|true story|mystery|cult)\b/i],
]

export function topicOf(title: string): string {
  for (const [name, re] of TOPICS) if (re.test(title)) return name
  return "Unsorted"
}

export function cleanYouTubeTitle(t: string): string {
  return t.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*YouTube$/, "").trim()
}

export function videoId(url: string): string | null {
  try {
    const u = new URL(url)
    if (!/(^|\.)youtube\.com$/.test(u.host)) return null
    if (u.pathname === "/watch") return u.searchParams.get("v")
    const m = u.pathname.match(/^\/(shorts|live)\/([\w-]{6,})/)
    return m ? m[2] : null
  } catch {
    return null
  }
}

export function youtubeVideos(visits: Visit[]): YouTubeVideo[] {
  const byId = new Map<string, YouTubeVideo>()
  for (const v of visits) {
    const id = videoId(v.url)
    if (!id) continue
    const title = cleanYouTubeTitle(v.title)
    const cur = byId.get(id)
    if (!cur) {
      byId.set(id, { id, title, topic: topicOf(title), first: v.t, last: v.t, views: 1, profile: v.profile })
    } else {
      // The same watch logs several rows within minutes (embed ref, title change); count a rewatch only after 30 min.
      if (v.t - cur.last > SESSION_GAP_MIN * 60000) cur.views++
      cur.last = v.t
      if (!cur.title || cur.title === "YouTube") {
        cur.title = title
        cur.topic = topicOf(title)
      }
    }
  }
  return [...byId.values()].filter((x) => x.title && x.title !== "YouTube")
}

/* ---------- searches ---------- */

const STOP = new Set("the a an and or of to in on for with is are was how what why who when where do does i you it my me this that from at by as be not no can your vs".split(" "))

export function searchTerms(visits: Visit[]): { queries: string[]; words: [string, number][] } {
  const qs: string[] = []
  const seen = new Set<string>()
  for (const v of visits) {
    if (!/google\./.test(v.host) || !v.url.includes("/search?")) continue
    let q = ""
    try {
      q = new URL(v.url).searchParams.get("q") ?? ""
    } catch {
      continue
    }
    q = q.trim().toLowerCase()
    if (!q) continue
    const k = `${Math.floor(v.t / 60000)}|${q}`
    if (seen.has(k)) continue
    seen.add(k)
    qs.push(q)
  }
  const wc = new Map<string, number>()
  for (const q of qs) for (const w of q.split(/[^a-z0-9']+/)) if (w.length > 2 && !STOP.has(w)) wc.set(w, (wc.get(w) ?? 0) + 1)
  return { queries: qs, words: [...wc.entries()].sort((a, b) => b[1] - a[1]) }
}

/* ---------- sessions ---------- */

export interface Session {
  start: number
  end: number
  visits: number
  top: string
}

export function sessionsOf(visits: Visit[]): Session[] {
  const out: Session[] = []
  let cur: Visit[] = []
  const flush = () => {
    if (!cur.length) return
    const c = new Map<string, number>()
    for (const v of cur) c.set(v.host, (c.get(v.host) ?? 0) + 1)
    out.push({ start: cur[0].t, end: cur[cur.length - 1].t, visits: cur.length, top: [...c.entries()].sort((a, b) => b[1] - a[1])[0][0] })
    cur = []
  }
  for (const v of visits) {
    if (cur.length && v.t - cur[cur.length - 1].t > SESSION_GAP_MIN * 60000) flush()
    cur.push(v)
  }
  flush()
  return out
}

/* ---------- full analysis ---------- */

const dayKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function tally<T>(items: T[], key: (x: T) => string): [string, number][] {
  const m = new Map<string, number>()
  for (const i of items) {
    const k = key(i)
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

export interface HistoryAnalysis {
  total: number
  from: number
  to: number
  activeDays: number
  profiles: [string, number][]
  perDay: [string, number][]
  hourDay: number[][] // [weekday 0=Mon][hour]
  hours: number[]
  domains: [string, number][]
  categories: [string, number][]
  categoryByDay: Record<string, Record<string, number>>
  transitions: [string, number][]
  sessions: Session[]
  activeMinutes: number
  lateNightShare: number
  searches: ReturnType<typeof searchTerms>
  extra: {
    rabbitHoles: { name: string; minutes: number; date: number; pages: number }[]
    sites: { name: string; host: string; visits: number; days: number; first: number; last: number }[]
    dev: { host: string; name: string; visits: number; days: number }[]
    categoryHours: [string, number[]][]
    lateSites: [string, number][]
    avgRunMin: number
    runsPerSession: number
    searchPerDay: [string, number][]
    questionShare: number
    repeatSearches: [string, number][]
    weekdayAvg: number[]
  }
  youtube: {
    videos: YouTubeVideo[]
    topicByDay: Record<string, Record<string, number>>
    shortsShare: number
    videosPerSession: number
    watchMinutes: [string, number][]
    topics: [string, number][]
    perDay: [string, number][]
    hours: number[]
    rewatched: number
    words: [string, number][]
    unsortedSample: string[]
  }
}

export function analyse(visits: Visit[]): HistoryAnalysis | null {
  if (!visits.length) return null
  const hourDay = Array.from({ length: 7 }, () => Array(24).fill(0))
  const hours = Array(24).fill(0)
  let late = 0
  const days = new Map<string, number>()
  const categoryByDay: Record<string, Record<string, number>> = {}
  for (const v of visits) {
    const d = new Date(v.t)
    const h = d.getHours()
    hourDay[(d.getDay() + 6) % 7][h]++
    hours[h]++
    if (h < 5) late++
    const k = dayKey(v.t)
    days.set(k, (days.get(k) ?? 0) + 1)
    const c = categoryOf(v.host)
    ;(categoryByDay[k] ??= {})[c] = (categoryByDay[k][c] ?? 0) + 1
  }
  const sessions = sessionsOf(visits)
  const videos = youtubeVideos(visits)
  const ytHours = Array(24).fill(0)
  const ytDays = new Map<string, number>()
  const words = new Map<string, number>()
  for (const v of videos) {
    ytHours[new Date(v.first).getHours()]++
    const k = dayKey(v.first)
    ytDays.set(k, (ytDays.get(k) ?? 0) + 1)
    for (const w of v.title.toLowerCase().split(/[^a-z']+/)) if (w.length > 3 && !STOP.has(w)) words.set(w, (words.get(w) ?? 0) + 1)
  }
  const titles = devTitles(visits)
  const runs = runsOf(visits)
  const siteMap = new Map<string, { name: string; host: string; visits: number; days: Set<string>; first: number; last: number }>()
  const catHours = new Map<string, number[]>()
  const lateMap = new Map<string, number>()
  for (const v of visits) {
    const nm = siteName(v.host, titles)
    const e = siteMap.get(v.host) ?? { name: nm, host: v.host, visits: 0, days: new Set<string>(), first: v.t, last: v.t }
    e.visits++
    e.days.add(dayKey(v.t))
    e.last = v.t
    siteMap.set(v.host, e)
    const c = categoryOf(v.host)
    const arr = catHours.get(c) ?? Array(24).fill(0)
    const hr = new Date(v.t).getHours()
    arr[hr]++
    catHours.set(c, arr)
    if (hr < 5) lateMap.set(nm, (lateMap.get(nm) ?? 0) + 1)
  }
  const siteRows = [...siteMap.values()].map((e) => ({ name: e.name, host: e.host, visits: e.visits, days: e.days.size, first: e.first, last: e.last }))
  const qs = searchTerms(visits).queries
  const qDay = new Map<string, number>()
  const qRep = new Map<string, number>()
  for (const q of qs) qRep.set(q, (qRep.get(q) ?? 0) + 1)
  for (const v of visits) {
    if (/google\./.test(v.host) && v.url.includes("/search?")) qDay.set(dayKey(v.t), (qDay.get(dayKey(v.t)) ?? 0) + 1)
  }
  const wkd = Array(7).fill(0)
  for (const [k, n] of days) wkd[(new Date(`${k}T12:00:00`).getDay() + 6) % 7] += n
  const wkdCount = Array(7).fill(0)
  for (const k of days.keys()) wkdCount[(new Date(`${k}T12:00:00`).getDay() + 6) % 7]++
  const topicByDay: Record<string, Record<string, number>> = {}
  const watch = new Map<string, number>()
  for (const r of runs) if (r.host === "youtube.com") for (const w of videoWatch(r)) watch.set(w.title, (watch.get(w.title) ?? 0) + w.minutes)
  for (const v of videos) {
    const k = dayKey(v.first)
    ;(topicByDay[k] ??= {})[v.topic] = (topicByDay[k][v.topic] ?? 0) + 1
  }
  const shorts = visits.filter((v) => /youtube\.com\/shorts\//.test(v.url)).length
  const ytSessions = sessions.filter((s) => s.top === "youtube.com").length || 1
  return {
    total: visits.length,
    from: visits[0].t,
    to: visits[visits.length - 1].t,
    activeDays: days.size,
    profiles: tally(visits, (v) => v.profile),
    perDay: [...days.entries()].sort(),
    hourDay,
    hours,
    domains: tally(visits, (v) => v.host),
    categories: tally(visits, (v) => categoryOf(v.host)),
    categoryByDay,
    transitions: tally(visits, (v) => v.transition),
    sessions,
    // A session's span plus one minute per page, so a single-page session is not zero.
    activeMinutes: sessions.reduce((s, x) => s + (x.end - x.start) / 60000 + 1, 0),
    lateNightShare: late / visits.length,
    searches: searchTerms(visits),
    extra: {
      rabbitHoles: runs
        .map((r) => ({ name: siteName(r.host, titles), minutes: (r.end - r.start) / 60000, date: r.start, pages: r.visits.length }))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 8),
      sites: siteRows.sort((a, b) => b.visits - a.visits).slice(0, 15),
      dev: siteRows.filter((x) => isLocalHost(x.host)).sort((a, b) => b.visits - a.visits).slice(0, 8).map(({ host, name, visits, days }) => ({ host, name, visits, days })),
      categoryHours: [...catHours.entries()].sort((a, b) => b[1].reduce((x, y) => x + y, 0) - a[1].reduce((x, y) => x + y, 0)),
      lateSites: [...lateMap.entries()].sort((a, b) => b[1] - a[1]),
      avgRunMin: runs.reduce((s2, r) => s2 + (r.end - r.start) / 60000, 0) / runs.length,
      runsPerSession: runs.length / sessions.length,
      searchPerDay: [...qDay.entries()].sort(),
      questionShare: qs.length ? qs.filter((q) => /^(how|what|why|who|when|where|is|are|can|does|do)\b/.test(q)).length / qs.length : 0,
      repeatSearches: [...qRep.entries()].filter((e) => e[1] > 1).sort((a, b) => b[1] - a[1]).slice(0, 10),
      weekdayAvg: wkd.map((n, i) => (wkdCount[i] ? n / wkdCount[i] : 0)),
    },
    youtube: {
      topicByDay,
      shortsShare: videos.length ? shorts / Math.max(1, visits.filter((v) => videoId(v.url)).length) : 0,
      videosPerSession: videos.length / ytSessions,
      watchMinutes: [...watch.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, m]) => [k, Math.round(m)] as [string, number]),
      videos,
      topics: tally(videos, (v) => v.topic),
      perDay: [...ytDays.entries()].sort(),
      hours: ytHours,
      rewatched: videos.filter((v) => v.views > 1).length,
      words: [...words.entries()].sort((a, b) => b[1] - a[1]),
      unsortedSample: videos.filter((v) => v.topic === "Unsorted").slice(0, 12).map((v) => v.title),
    },
  }
}

/* ---------- site names and runs ---------- */

const SITE_NAMES: Record<string, string> = {
  "mail.google.com": "Gmail",
  "drive.google.com": "Google Drive",
  "docs.google.com": "Google Docs",
  "calendar.google.com": "Google Calendar",
  "accounts.google.com": "Google Account",
  "google.com": "Google",
  "youtube.com": "YouTube",
  "open.spotify.com": "Spotify",
  "claude.ai": "Claude",
  "github.com": "GitHub",
  "x.com": "X",
  "chatgpt.com": "ChatGPT",
  "midjourney.com": "Midjourney",
  "amazon.com": "Amazon",
  "pinterest.com": "Pinterest",
  "instagram.com": "Instagram",
  "reddit.com": "Reddit",
  "cursor.com": "Cursor",
  "lichess.org": "Lichess",
  "goodreads.com": "Goodreads",
}

export const LOCAL_DEV_NAME = "Local dev server"

export function isLocalHost(host: string): boolean {
  return categoryOf(host) === "Local dev"
}

/** Site name for a pen. Local servers get the most common page title for that host:port (see `devTitles`), else "Local dev server". */
export function siteName(host: string, devTitles?: Map<string, string>): string {
  if (isLocalHost(host)) return devTitles?.get(host) ?? LOCAL_DEV_NAME
  if (SITE_NAMES[host]) return SITE_NAMES[host]
  const parts = host.split(".")
  const label = parts.length > 1 ? parts[parts.length - 2] : parts[0]
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : host
}

/** Most common usable page title per local host:port. Generic or url-like titles are skipped. */
export function devTitles(visits: Visit[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>()
  for (const v of visits) {
    if (!isLocalHost(v.host)) continue
    const t = v.title.trim()
    if (!t || t.length < 3 || /^(localhost|127\.|https?:|404|error|untitled|new tab)/i.test(t)) continue
    const m = counts.get(v.host) ?? new Map<string, number>()
    m.set(t, (m.get(t) ?? 0) + 1)
    counts.set(v.host, m)
  }
  const out = new Map<string, string>()
  for (const [host, m] of counts) {
    const best = [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]
    out.set(host, best.length > 40 ? `${best.slice(0, 39)}…` : best)
  }
  return out
}

export interface Run {
  start: number
  end: number
  host: string
  visits: Visit[]
}

/** Consecutive visits to one host (gap under 30 min) are one run. A run lasts until the next run starts, or one minute past its last page. */
export function runsOf(visits: Visit[]): Run[] {
  const gap = SESSION_GAP_MIN * 60000
  const runs: Run[] = []
  for (const v of visits) {
    const cur = runs[runs.length - 1]
    if (cur && cur.host === v.host && v.t - cur.visits[cur.visits.length - 1].t <= gap) cur.visits.push(v)
    else runs.push({ start: v.t, end: v.t, host: v.host, visits: [v] })
  }
  runs.forEach((r, i) => {
    const last = r.visits[r.visits.length - 1].t
    const next = runs[i + 1]
    r.end = next && next.start - last <= gap ? next.start : last + 60000
    if (r.end < r.start + 60000) r.end = r.start + 60000
  })
  return runs
}

/** Minutes spent on each YouTube video inside a run: from its first page to the next page (or the run's end), 30 min cap per stretch. */
export function videoWatch(run: Run): { id: string; title: string; minutes: number }[] {
  const cap = SESSION_GAP_MIN * 60000
  const byId = new Map<string, { id: string; title: string; ms: number }>()
  run.visits.forEach((v, i) => {
    const id = videoId(v.url)
    if (!id) return
    const until = run.visits[i + 1]?.t ?? run.end
    const ms = Math.min(cap, Math.max(0, until - v.t))
    const title = cleanYouTubeTitle(v.title)
    const cur = byId.get(id)
    if (cur) {
      cur.ms += ms
      if (!cur.title || cur.title === "YouTube") cur.title = title
    } else byId.set(id, { id, title, ms })
  })
  return [...byId.values()].map((x) => ({ id: x.id, title: x.title, minutes: x.ms / 60000 }))
}
