/**
 * lib/ingest/parse-message.ts — Verb + payload parser for phone ingest
 *
 * Longest alias wins. Prefix-less text is Inbox capture, except a multi-line
 * list dump (`Name:` then items), which is bulk add. A header that merely
 * starts with a verb (`Grocery list:`) stays a list name. `get:` (colon
 * required) is the needed-list form of that dump pattern. `now` rolls
 * `before 9/12:` onto the next matching day. Telegram slash commands
 * (`/start`, `/help`, `/stop`, `/info`) are recognized.
 */
import { looksLikeListDump, parseDueBeforeHeader } from "./parse-bulk"
import { parsePathHeader } from "@/lib/smart-parse"
import type { IngestIntent, IngestIntentKind } from "./types"

interface VerbSpec {
  kind: IngestIntentKind
  aliases: string[]
}

const VERBS: VerbSpec[] = [
  { kind: "help", aliases: ["/help", "help", "commands", "?help"] },
  { kind: "info", aliases: ["/info", "instructions", "manual", "cmds", "info"] },
  { kind: "pair", aliases: ["/start", "pair"] },
  { kind: "bulk", aliases: ["bulk add", "bulkadd", "bulk"] },
  { kind: "habit", aliases: ["habit", "did"] },
  { kind: "location", aliases: ["location", "here", "loc", "at"] },
  { kind: "track", aliases: ["tracking", "track", "doing"] },
  { kind: "iphone-screen", aliases: ["phone-screen", "screentime", "screen", "iphone", "ios"] },
  { kind: "iphone-call", aliases: ["phone-call", "called", "call"] },
  { kind: "iphone-text", aliases: ["imessage", "sms", "sent", "text"] },
  { kind: "mood", aliases: ["feeling", "mood", "feel", "state"] },
  { kind: "sleep", aliases: ["slept", "sleep"] },
  { kind: "start", aliases: ["start"] },
  { kind: "stop", aliases: ["/stop", "stop"] },
  { kind: "stopped-activity", aliases: ["stopped"] },
  { kind: "currently", aliases: ["currently", "current"] },
  { kind: "switched-to", aliases: ["switched to", "switch to", "switched"] },
  { kind: "read", aliases: ["peek", "dump", "show", "read"] },
  { kind: "lists", aliases: ["list of lists", "list lists", "lists", "ls"] },
  { kind: "folders", aliases: ["list of folders", "list folders", "folders", "dirs"] },
  { kind: "inbox", aliases: ["dump inbox", "show inbox", "read inbox", "open inbox"] },
  { kind: "search", aliases: ["search", "find", "?"] },
  { kind: "today", aliases: ["today", "tdy"] },
  { kind: "habits", aliases: ["habit board", "habits", "hi"] },
  { kind: "status", aliases: ["working now", "where", "status", "now"] },
  { kind: "ops", aliases: ["operations", "ops"] },
  { kind: "count", aliases: ["counts", "count"] },
  { kind: "tags", aliases: ["tags"] },
  { kind: "plan-now", aliases: ["plan for now", "plan for rn", "plan now", "plan rn"] },
  { kind: "read-plans", aliases: ["read plans for today", "read plans today", "read plans"] },
  { kind: "read-plan", aliases: ["read plan for today", "read plan today", "latest plan"] },
  { kind: "read-todo-today", aliases: ["read to do today", "read todo today", "read todays list"] },
  { kind: "todo-today", aliases: ["to do today", "todo today", "do today", "tdt"] },
  { kind: "do", aliases: ["next action", "do"] },
  { kind: "morning", aliases: ["good morning", "goodmorning", "gm"] },
  { kind: "reviews", aliases: ["reviews"] },
  { kind: "review", aliases: ["review"] },
  { kind: "cancel", aliases: ["nevermind", "never mind", "cancel", "quit"] },
  { kind: "gps", aliases: ["geo", "gps"] },
  { kind: "plan", aliases: ["calendar", "agenda"] },
  { kind: "ping", aliases: ["ping", "pong"] },
  { kind: "grocery", aliases: ["groceries", "grocery", "groc", "shop", "shopping"] },
  { kind: "needed", aliases: ["needed"] },
  { kind: "bought", aliases: ["check off", "checkoff", "checkout", "bought", "got", "x"] },
  { kind: "note", aliases: ["day note", "daynote", "dnote", "memo", "note", "jot", "n"] },
  { kind: "iphone-notes", aliases: ["iphone-notes", "iphone notes", "phone notes", "inotes"] },
  { kind: "pin", aliases: ["snapshot", "live", "pin"] },
  { kind: "receipt", aliases: ["receipt", "reciept", "slip"] },
  { kind: "journal", aliases: ["notebook", "journal", "pages", "scan"] },
  { kind: "pdf", aliases: ["pdf"] },
  { kind: "inventory", aliases: ["inventory", "pantry", "inv"] },
  { kind: "capture", aliases: ["quick add", "quickadd", "capture", "inbox", "idea", "add", "qa"] },
]

const ALIAS_INDEX: { alias: string; kind: IngestIntentKind }[] = VERBS.flatMap((v) =>
  v.aliases.map((alias) => ({ alias: alias.toLowerCase(), kind: v.kind })),
).sort((a, b) => b.alias.length - a.alias.length)

export function parseMessage(raw: string, now = new Date()): IngestIntent {
  const text = String(raw ?? "").replace(/^\uFEFF/, "").trim()
  if (!text) return { kind: "unknown", payload: "", raw: "" }

  const matched = matchVerb(text, now)
  if (matched) return matched

  if (looksLikeListDump(text, now)) return { kind: "bulk", payload: text, raw: text }

  return { kind: "capture", payload: text, raw: text }
}

/** True only when the first line actually used a known verb (not prefix-less capture). */
export function looksLikeVerb(text: string, now = new Date()): boolean {
  return matchVerb(text, now) != null
}

function matchVerb(text: string, now: Date): IngestIntent | null {
  const firstLineEnd = text.indexOf("\n")
  const firstLine = (firstLineEnd === -1 ? text : text.slice(0, firstLineEnd)).trim()
  const restLines = firstLineEnd === -1 ? "" : text.slice(firstLineEnd + 1)

  // `log:` / `log-` (with or without a space) — discrete event, not habit.
  const logHeader = /^(log)\s*[:\-]\s*([\s\S]*)$/i.exec(firstLine)
  if (logHeader) {
    const payload = [logHeader[2].trim(), restLines].filter((s) => s.length > 0).join("\n")
    return { kind: "event-log", payload, raw: text }
  }

  // `get:` (colon required) — same writer as `needed:` (list "needed").
  // Bare `get` / `get milk` stay capture so normal notes are not stolen.
  const getHeader = /^(get)\s*[:：]\s*([\s\S]*)$/i.exec(firstLine)
  if (getHeader) {
    const payload = [getHeader[2].trim(), restLines].filter((s) => s.length > 0).join("\n")
    return { kind: "needed", payload, raw: text }
  }

  for (const { alias, kind } of ALIAS_INDEX) {
    const hit = matchAlias(firstLine, alias)
    if (!hit) continue
    // `Grocery list:` starts with the grocery verb but is a list header.
    // A bare `grocery:` / `groc:` still means the verb. `iphone-notes 2/3:` is a
    // continuation, not a list named "iphone-notes 2/3".
    if (
      kind !== "iphone-notes" &&
      isListHeader(firstLine, now) &&
      !isBareAlias(firstLine, alias)
    ) {
      continue
    }
    const restOfFirst = hit.rest
    const payload =
      kind === "bulk" ||
      kind === "grocery" ||
      kind === "needed" ||
      kind === "bought" ||
      kind === "iphone-notes" ||
      kind === "receipt" ||
      kind === "journal" ||
      kind === "inventory" ||
      kind === "plan-now" ||
      kind === "do" ||
      kind === "todo-today" ||
      kind === "gps" ||
      kind === "event-log" ||
      kind === "currently" ||
      kind === "stopped-activity" ||
      kind === "switched-to"
        ? [restOfFirst, restLines].filter((s) => s.length > 0).join("\n")
        : restOfFirst
    return { kind, payload, raw: text }
  }
  return null
}

function isListHeader(line: string, now: Date): boolean {
  return parseDueBeforeHeader(line, now) != null || parsePathHeader(line) != null
}

function isBareAlias(line: string, alias: string): boolean {
  const name = line.trim().toLowerCase().replace(/[:：]\s*$/, "").trim()
  return name === alias
}

function matchAlias(line: string, alias: string): { rest: string } | null {
  const lower = line.toLowerCase()
  if (!lower.startsWith(alias)) return null
  const after = line.slice(alias.length)
  if (after.length === 0) return { rest: "" }
  const ch = after[0]
  if (ch === ":" || ch === "：" || /\s/.test(ch)) {
    return { rest: after.replace(/^[:：]\s*/, "").trim() }
  }
  // Telegram `/start123456` without a space still counts for pair.
  if (alias.startsWith("/") && /^\d/.test(after)) {
    return { rest: after.trim() }
  }
  return null
}
