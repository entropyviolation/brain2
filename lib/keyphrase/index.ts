/**
 * lib/keyphrase/index.ts — Key phrases from text with no model: RAKE, TextRank and a YAKE-style scorer
 *
 * Free, instant, deterministic. Each method takes a passage and returns its best phrases, highest score first
 * (`Phrase.score` is always "bigger is better", whatever the method's own direction). They are small on purpose, in the
 * spirit of the papers, not ports. Use them as a baseline for model extraction, as an agent that costs nothing, or to
 * hand a model the topics a passage is about. `KEYPHRASE_METHODS` lists them for pickers. Pure.
 */

export type Phrase = { phrase: string; score: number }
export type KeyphraseMethod = "rake" | "textrank" | "yake"
export type KeyphraseOptions = { top?: number; maxWords?: number }

export const KEYPHRASE_METHODS: Array<{ id: KeyphraseMethod; label: string; about: string }> = [
  { id: "rake", label: "RAKE", about: "Rapid Automatic Keyword Extraction: split on stop words, score words by how often and how connected they are." },
  { id: "textrank", label: "TextRank", about: "PageRank over a graph of words that sit near each other; the central words, merged into phrases." },
  { id: "yake", label: "YAKE", about: "Statistical: capitalised, early, frequent, widely-spread words score well; lower raw score is better, flipped here." },
]

const STOP = new Set(
  "a about above after again against all also am an and any are as at be because been before being below between both but by can could did do does doing down during each few for from further had has have having he her here hers herself him himself his how i if in into is it its itself just me more most my myself no nor not of off on once only or other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this those through to too under until up very was we were what when where which while who whom why will with would you your yours yourself yourselves one two may might must shall upon thus however therefore yet even still much many every either neither whether rather quite often".split(" "),
)

const tokens = (text: string) => text.match(/[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g) ?? []
const isContent = (w: string) => w.length >= 3 && !STOP.has(w.toLowerCase())
const sentencesOf = (text: string) => text.replace(/\s+/g, " ").split(/(?<=[.!?;:])\s+/).filter(Boolean)

/** Runs of content words between stop words and punctuation. */
function candidates(text: string, maxWords: number): string[][] {
  const out: string[][] = []
  for (const sent of sentencesOf(text)) {
    for (const chunk of sent.split(/[,()"“”—–\[\]]/)) {
      let run: string[] = []
      for (const w of tokens(chunk)) {
        if (isContent(w)) run.push(w)
        else {
          if (run.length) out.push(run.slice(0, maxWords))
          run = []
        }
      }
      if (run.length) out.push(run.slice(0, maxWords))
    }
  }
  return out
}

function topUnique(scored: Phrase[], top: number): Phrase[] {
  const kept: Phrase[] = []
  for (const p of scored.sort((a, b) => b.score - a.score)) {
    const l = p.phrase.toLowerCase()
    if (kept.some((k) => k.phrase.toLowerCase() === l || (l.split(" ").length === 1 && k.phrase.toLowerCase().split(" ").includes(l)))) continue
    kept.push(p)
    if (kept.length >= top) break
  }
  return kept
}

export function rake(text: string, { top = 12, maxWords = 4 }: KeyphraseOptions = {}): Phrase[] {
  const cands = candidates(text, maxWords)
  const freq = new Map<string, number>()
  const deg = new Map<string, number>()
  for (const c of cands) {
    for (const w of c) {
      const k = w.toLowerCase()
      freq.set(k, (freq.get(k) ?? 0) + 1)
      deg.set(k, (deg.get(k) ?? 0) + c.length - 1)
    }
  }
  const byPhrase = new Map<string, number>()
  for (const c of cands) {
    const key = c.join(" ")
    byPhrase.set(key, c.reduce((sum, w) => sum + ((deg.get(w.toLowerCase()) ?? 0) + (freq.get(w.toLowerCase()) ?? 1)) / (freq.get(w.toLowerCase()) ?? 1), 0))
  }
  return topUnique([...byPhrase].map(([phrase, score]) => ({ phrase, score })), top)
}

export function textrank(text: string, { top = 12, maxWords = 3 }: KeyphraseOptions = {}): Phrase[] {
  const WINDOW = 4
  const words = tokens(text).filter(isContent).map((w) => w.toLowerCase())
  const uniq = [...new Set(words)]
  const idx = new Map(uniq.map((w, i) => [w, i]))
  const adj: Array<Map<number, number>> = uniq.map(() => new Map())
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < Math.min(words.length, i + WINDOW); j++) {
      const a = idx.get(words[i]!)!
      const b = idx.get(words[j]!)!
      if (a === b) continue
      adj[a]!.set(b, (adj[a]!.get(b) ?? 0) + 1)
      adj[b]!.set(a, (adj[b]!.get(a) ?? 0) + 1)
    }
  }
  let rank = uniq.map(() => 1)
  const out = adj.map((m) => [...m.values()].reduce((a, b) => a + b, 0))
  for (let it = 0; it < 40; it++) {
    rank = rank.map((_, i) => 0.15 + 0.85 * [...adj[i]!].reduce((sum, [j, w]) => sum + (w / (out[j] || 1)) * rank[j]!, 0))
  }
  const score = (w: string) => rank[idx.get(w.toLowerCase()) ?? -1] ?? 0
  const top30 = new Set(uniq.map((w, i) => ({ w, r: rank[i]! })).sort((a, b) => b.r - a.r).slice(0, Math.max(top * 3, 20)).map((x) => x.w))
  // Adjacent top words merge into one phrase, as in the paper.
  const merged = new Map<string, number>()
  const raw = tokens(text)
  for (let i = 0; i < raw.length; ) {
    if (!top30.has(raw[i]!.toLowerCase()) || !isContent(raw[i]!)) { i++; continue }
    const run = [raw[i]!]
    let j = i + 1
    while (j < raw.length && run.length < maxWords && top30.has(raw[j]!.toLowerCase()) && isContent(raw[j]!)) run.push(raw[j++]!)
    const key = run.join(" ")
    merged.set(key, (merged.get(key) ?? 0) + run.reduce((s, w) => s + score(w), 0))
    i = j
  }
  return topUnique([...merged].map(([phrase, score]) => ({ phrase, score })), top)
}

export function yake(text: string, { top = 12, maxWords = 3 }: KeyphraseOptions = {}): Phrase[] {
  const sents = sentencesOf(text)
  const stats = new Map<string, { tf: number; caps: number; sents: Set<number>; left: Set<string>; right: Set<string> }>()
  sents.forEach((sent, si) => {
    const ws = tokens(sent)
    ws.forEach((w, i) => {
      if (!isContent(w)) return
      const k = w.toLowerCase()
      const st = stats.get(k) ?? { tf: 0, caps: 0, sents: new Set<number>(), left: new Set<string>(), right: new Set<string>() }
      st.tf++
      if (/^[A-Z]/.test(w) && i > 0) st.caps++
      st.sents.add(si)
      if (i > 0) st.left.add(ws[i - 1]!.toLowerCase())
      if (i < ws.length - 1) st.right.add(ws[i + 1]!.toLowerCase())
      stats.set(k, st)
    })
  })
  const tfs = [...stats.values()].map((s) => s.tf)
  const meanTf = tfs.reduce((a, b) => a + b, 0) / (tfs.length || 1)
  const sdTf = Math.sqrt(tfs.reduce((a, b) => a + (b - meanTf) ** 2, 0) / (tfs.length || 1))
  const maxTf = Math.max(1, ...tfs)
  const wordScore = new Map<string, number>()
  for (const [k, s] of stats) {
    const casing = s.caps / (1 + Math.log(s.tf))
    const position = Math.log(Math.log(3 + median([...s.sents])))
    const freq = s.tf / (meanTf + sdTf || 1)
    const rel = 1 + (s.left.size + s.right.size) / (s.tf || 1) * (s.tf / maxTf)
    const spread = s.sents.size / (sents.length || 1)
    wordScore.set(k, (rel * position) / (casing + freq / rel + spread / rel))
  }
  const phrases = new Map<string, { tf: number; ws: number[] }>()
  for (const c of candidates(text, maxWords)) {
    for (let n = 1; n <= c.length; n++) {
      for (let i = 0; i + n <= c.length; i++) {
        const key = c.slice(i, i + n).join(" ")
        const p = phrases.get(key) ?? { tf: 0, ws: c.slice(i, i + n).map((w) => wordScore.get(w.toLowerCase()) ?? 1) }
        p.tf++
        phrases.set(key, p)
      }
    }
  }
  const scored = [...phrases].map(([phrase, p]) => ({ phrase, raw: p.ws.reduce((a, b) => a * b, 1) / (p.tf * (1 + p.ws.reduce((a, b) => a + b, 0))) }))
  return topUnique(scored.map((x) => ({ phrase: x.phrase, score: 1 / (x.raw + 1e-9) })), top)
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)]! : 0
}

export function extractKeyphrases(method: KeyphraseMethod, text: string, opts?: KeyphraseOptions): Phrase[] {
  return method === "rake" ? rake(text, opts) : method === "textrank" ? textrank(text, opts) : yake(text, opts)
}
