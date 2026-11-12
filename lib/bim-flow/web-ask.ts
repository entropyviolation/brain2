/**
 * lib/bim-flow/web-ask.ts — The Web BIMBY: one outside-world question, looked up on the web and answered
 *
 * "can you find out what time the laundromats by my house close?" is searched through the Mac hub
 * (`hubSearch` → `/api/web-search`, `web-search.mjs`). Only the query leaves the Mac. A question that leans on
 * where the person lives needs home first: with none kept, BIM asks for it once (`HOME_ASK`), keeps the answer
 * on this device (`bimchat-home`), and then runs the question it was holding.
 *
 * With LLM on, a local model answers from the pages it was given and cites them by number; it must say so when
 * the pages do not state the answer. With LLM off, or when no model answers, the reply is the best passages,
 * source by source, with no model words. The sources always go to the chat's evidence fold.
 */
"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { chatCrew } from "./chat-models"
import { ollamaCall, type ModelCall } from "./ollama"
import { cleanHome, codeQuery, hubSearch, needsHome, parseHomeTell, pickPassages, webCue, webLines, type WebSearch } from "./web-lane"

export const useHomeStore = create<{ home: string | null; setHome: (home: string | null) => void }>()(
  persist((set) => ({ home: null, setHome: (home) => set({ home }) }), { name: "bimchat-home", storage: createJSONStorage(() => localStorage) }),
)

export const HOME_ASK = "Where do you live? A neighborhood and city, or a street, is enough. Only that place goes into the web search."

/** The question held while BIM waits for home. In memory only: a reload drops it, and the person asks again. */
let holding: string | null = null

export interface WebAnswer {
  text: string
  route: string
  evidence: string[]
  /** BIM asked where home is and is holding the question. */
  askedHome?: boolean
}

const ANSWER_SYSTEM = `You answer one question using only the numbered web sources given. Rules:
- Use only what the sources say. Cite them like [1] or [2].
- Opening hours: name each place with the closing time its source states for today, when it states one.
- If the sources do not state the answer, say so in one sentence and say what to check instead.
- Two to five short sentences. No preamble.`

const ANSWER_SCHEMA = { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] }

/** A line that is worth a web search: it asks (a "?" or "find out / look up") and it is about the outside world. */
export function looksLikeWebQuestion(text: string): boolean {
  const t = text.trim()
  return t.length >= 8 && t.length <= 400 && webCue(t) && (/\?\s*$/.test(t) || /\b(?:find out|look (?:it |that |this )?up|google|search)\b/i.test(t))
}

/** The hub search for this device: same origin on the Mac, the synced hub on the iPhone. */
export async function phoneSearch(): Promise<WebSearch> {
  try {
    const { isPhoneWebStorage } = await import("@/lib/phone-device")
    if (!isPhoneWebStorage()) return hubSearch
    const { phoneHubRoute } = await import("@/lib/phone-window")
    const hub = await phoneHubRoute()
    return hub.url ? (q) => hubSearch(q, { base: hub.url, headers: hub.headers }) : async () => null
  } catch {
    return hubSearch
  }
}

/** Without a model: the passages that bear on the question, per source. */
function codeAnswer(found: NonNullable<Awaited<ReturnType<WebSearch>>>, question: string): string {
  const clock = /\b(?:hours|open|close|closing|opens|closes)\b/i.test(question)
  const byUrl = new Map(found.pages.map((p) => [p.url, p.text]))
  const rows = found.results.slice(0, 4).map((r, i) => {
    const page = byUrl.get(r.url)
    const said = (page ? pickPassages(page, `${found.query} ${question}`, { clock, cap: 260 }) : "") || r.snippet.slice(0, 200)
    return `[${i + 1}] ${r.title}${said ? `: ${said}` : ""}`
  })
  return [`What the web says for "${found.query}" (no model read it; these are the passages that match):`, ...rows].join("\n")
}

export interface AskOpts {
  llm: boolean
  /** Tests pass their own; default the hub (or the phone's hub). */
  search?: WebSearch
  /** Tests pass their own; default the crew's main model. Null: no model. */
  call?: ModelCall | null
  model?: string
}

/** Look one question up and answer it. Asks for home first when the question needs it and none is kept. */
export async function answerWeb(question: string, now: Date, opts: AskOpts): Promise<WebAnswer> {
  const t0 = Date.now()
  const q = question.trim()
  const home = useHomeStore.getState().home
  if (needsHome(q) && !home) {
    holding = q
    return { text: HOME_ASK, route: "WEB · home · code", evidence: [], askedHome: true }
  }
  const query = codeQuery(q, home ?? undefined)
  const search = opts.search ?? (await phoneSearch())
  const found = await search(query)
  const secs = () => ((Date.now() - t0) / 1000).toFixed(1)
  if (!found || !found.results.length) {
    return { text: `I could not search the web for "${query}" just now${found ? " (no results)" : " (the Mac hub did not answer)"}. Ask again in a bit, or look it up directly.`, route: `WEB · none · ${secs()}s`, evidence: [`searched the web: ${query}`] }
  }
  const { lines, sources } = webLines(found, q)
  let call: ModelCall | null = null
  let model = opts.model ?? ""
  if (opts.llm && opts.call !== null) {
    if (opts.call) call = opts.call
    else {
      const crew = await chatCrew().catch(() => null)
      if (crew) {
        model = crew.main
        call = ollamaCall(crew.main, AbortSignal.timeout(120_000))
      }
    }
  }
  if (call) {
    try {
      const out = (await call({ ...(model ? { model } : {}), system: ANSWER_SYSTEM, user: `TODAY: ${now.toDateString()}, ${now.toTimeString().slice(0, 5)}\nQUESTION: ${q}\n\nSOURCES:\n${lines.join("\n")}`, schema: ANSWER_SCHEMA, maxTokens: 260 })) as { answer?: string }
      const answer = String(out?.answer ?? "").trim()
      if (answer) return { text: `${answer}\n\n(From a web search for "${query}". Hours change; the sources are in the fold.)`, route: `WEB · model ${model || "local"} · ${secs()}s`, evidence: sources }
    } catch {
      /* fall through to the passages */
    }
  }
  return { text: codeAnswer(found, q), route: `WEB · passages · code · ${secs()}s`, evidence: sources }
}

/**
 * The line right after `HOME_ASK`: keep it as home and run the held question. Also keeps "I live in …" said any
 * time. Null when this line is not about home.
 */
export async function takeHome(text: string, now: Date, opts: AskOpts & { lastBim?: string }): Promise<WebAnswer | null> {
  const told = parseHomeTell(text)
  const answering = holding && opts.lastBim?.trim() === HOME_ASK && !/\?\s*$/.test(text) && text.trim().length <= 140
  if (!told && !answering) return null
  if (/^(skip|no|nah|not now|pass|never ?mind)$/i.test(text.trim())) {
    holding = null
    return { text: "Okay, I will not look it up.", route: "WEB · home · code", evidence: [] }
  }
  const home = told ?? cleanHome(text)
  useHomeStore.getState().setHome(home)
  const question = holding
  holding = null
  if (!question) return { text: `Kept: home is ${home}. A question about places near you will search near there. Say "I live in …" to change it.`, route: "WEB · home · code", evidence: [] }
  const answer = await answerWeb(question, now, opts)
  return { ...answer, text: `Kept: home is ${home}.\n\n${answer.text}` }
}

/** Tests only. */
export function resetWebAsk(): void {
  holding = null
}
