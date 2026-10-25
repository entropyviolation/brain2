/**
 * lib/browser-history.ts — Chrome history export → analysis (Sources → Browser)
 *
 * Pure. Input is the "Quick Chrome History Export" JSON (one array per profile).
 * Rows are deduped within and across profiles by (visitTime, url). Nothing
 * here reads a store or the network. YouTube topics come from the page title
 * only (the export has no channel or description), so they are keyword guesses.
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

export function mergeHistory(files: HistoryFile[]): Visit[] {
  const seen = new Set<string>()
  const out: Visit[] = []
  for (const f of files) {
    for (const r of f.rows) {
      if (!r || typeof r.visitTime !== "number" || typeof r.url !== "string") continue
      const key = `${Math.round(r.visitTime)}|${r.url}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        t: r.visitTime,
        url: r.url,
        host: hostOf(r.url),
        title: r.title ?? "",
        transition: r.transition ?? "link",
        profile: f.profile,
      })
    }
  }
  return out.sort((a, b) => a.t - b.t)
}

/** Add new files to what is already kept. Nothing already kept is ever dropped, so history past Chrome's 90-day window survives later exports. */
export function mergeInto(existing: Visit[], files: HistoryFile[]): Visit[] {
  const seen = new Set(existing.map((v) => `${Math.round(v.t)}|${v.url}`))
  const fresh = mergeHistory(files).filter((v) => !seen.has(`${Math.round(v.t)}|${v.url}`))
  return fresh.length ? [...existing, ...fresh].sort((a, b) => a.t - b.t) : existing
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
