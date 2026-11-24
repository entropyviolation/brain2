/**
 * lib/ingest/bim-owed-run.ts — The Text-back BIMBY's door in BIM chat (reads and writes stores)
 *
 * `tryOwed` answers "who do I need to text back?" from the hub's texts and your open to-dos
 * (`bim-owed.ts` reads them), and remembers the list. A later "already texted ruggles at 3pm"
 * checks off each matching reply to-do with that time (one undo step) and keeps the person off
 * the list until they text again (`bimchat-texted-back`, this device). A "texted X" that matches
 * no to-do and nobody on the last list is left to the other lanes.
 */
"use client"

import { runAsAction } from "@/lib/action-history"
import { snapshotFromStores } from "@/lib/bim-flow/store-snapshot"
import { loadTexts } from "@/lib/bim-flow/texts-client"
import { itemTitle } from "@/lib/item-utils"
import { isPhoneWebStorage } from "@/lib/phone-device"
import { formatHandle } from "@/lib/phone-sync/handles"
import { useTaskStore } from "@/lib/task-store"
import { finishTodo } from "./apply-todos"
import { OWED_DAYS, owedRows, owedText, parseOwedAsk, parseTextedBack, samePerson, todoName } from "./bim-owed"

const LIST_KEY = "bimchat-owed"
const ANSWERED_KEY = "bimchat-texted-back"
/** A "texted X" reads against the last list for this long. */
const LIST_FRESH_MS = 24 * 3_600_000

export interface OwedReply {
  text: string
  route: string
  evidence?: string[]
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

function openTodos(): { id: string; title: string }[] {
  return useTaskStore
    .getState()
    .tasks.filter((t) => !t.completed && t.type !== "person" && t.type !== "log" && !!itemTitle(t))
    .map((t) => ({ id: t.id, title: itemTitle(t) }))
}

async function hubTexts() {
  const snap = snapshotFromStores()
  const base = isPhoneWebStorage() ? (await import("@/lib/phone-window").then((m) => m.phoneHubRoute())).url : undefined
  if (base === "") return null
  return loadTexts({ days: OWED_DAYS, people: snap.people, hideHandles: snap.secretHandles, ...(base ? { base } : {}) })
}

const clock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).toLowerCase()

export async function tryOwed(text: string, now = new Date()): Promise<OwedReply | null> {
  const t0 = Date.now()
  const chip = () => `TEXT-BACK · code · ${((Date.now() - t0) / 1000).toFixed(1)}s`

  if (parseOwedAsk(text)) {
    const rows = await hubTexts().catch(() => null)
    const answered = readJson<Record<string, string>>(ANSWERED_KEY, {})
    const owed = owedRows(rows, openTodos(), now, answered, formatHandle)
    writeJson(LIST_KEY, { at: now.getTime(), who: owed.map((r) => r.who) })
    const evidence = owed.filter((r) => r.lastAt).map((r) => `${r.who}${r.contact ? ` · ${r.contact}` : ""} · last text ${new Date(r.lastAt!).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${r.lastText}`)
    return { text: owedText(owed, now, !!rows), route: chip(), ...(evidence.length ? { evidence } : {}) }
  }

  const said = parseTextedBack(text, now)
  if (!said) return null
  const list = readJson<{ at: number; who: string[] }>(LIST_KEY, { at: 0, who: [] })
  const listed = now.getTime() - list.at < LIST_FRESH_MS ? list.who : []
  const names = said.all ? listed.map((w) => w.toLowerCase()) : said.names
  if (!names.length) return null
  const todos = openTodos()
  const hits = names.map((n) => ({
    name: n,
    who: listed.find((w) => samePerson(w, n)),
    todos: todos.filter((t) => {
      const tn = todoName(t.title)
      return !!tn && samePerson(tn, n)
    }),
  }))
  // Nothing to close and nobody on the list: an ordinary line about texting, for the other lanes.
  if (!hits.some((h) => h.who || h.todos.length)) return null

  const answered = readJson<Record<string, string>>(ANSWERED_KEY, {})
  const closed: string[] = []
  runAsAction(`BIM: texted back ${names.join(", ")}`, () => {
    for (const h of hits) {
      for (const todo of h.todos) {
        finishTodo(todo.id, said.at, !said.told, now)
        closed.push(todo.title)
      }
      answered[(h.who ?? h.name).toLowerCase()] = said.at.toISOString()
      answered[h.name.toLowerCase()] = said.at.toISOString()
    }
  })
  writeJson(ANSWERED_KEY, answered)
  const when = said.told ? ` at ${clock(said.at)}` : ""
  const who = hits.map((h) => h.who ?? h.name.replace(/\b[a-z]/g, (c) => c.toUpperCase()))
  const parts = [
    closed.length ? `Checked off ${closed.map((c) => `“${c}”`).join(", ")}${when ? `, done${when}` : ""}.` : `No to-do for ${who.join(", ")}, so nothing to check off.`,
    `${who.join(", ")} ${who.length === 1 ? "is" : "are"} off the text-back list until they text again.`,
  ]
  const missed = hits.filter((h) => !h.who && !h.todos.length).map((h) => h.name)
  if (missed.length) parts.push(`I had nothing for ${missed.join(", ")}.`)
  return { text: parts.join(" "), route: chip() }
}
