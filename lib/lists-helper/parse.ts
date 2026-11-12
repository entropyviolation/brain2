/**
 * lib/lists-helper/parse.ts — Turn a typed line into one tool call (pure, code only)
 *
 * The grammar is deliberately narrow: each shape names a tool and its slots, and every name is resolved to an id
 * (`resolve.ts`) or the line is answered with what could not be resolved. A line that fits nothing is never
 * guessed at. Planned: a local model picks the tool from the same closed list for free-form lines; it would emit
 * the same `ToolCall`, so nothing below changes.
 */

import { parseDueClause } from "./dates"
import { itemIdsIn, listsNamed, resolveFolder, resolveList, resolveType, type Resolved } from "./resolve"
import type { CollectDest, CollectFilter, ToolCall, World } from "./types"

export type Intent =
  | { kind: "tool"; call: ToolCall }
  | { kind: "focus"; listId: string | null; name?: string }
  | { kind: "help" }
  | { kind: "undo" }
  | {
      kind: "error"
      text: string
      /** Whole lines the person can send as they are, each with a short key label. */
      suggest?: { label: string; text: string; /** The line that opens this choice's detail, so it can be judged before it is picked. */ peek?: string }[]
      /** Words that matched nothing for sure. The session offers "Other…", which searches this kind by new words and puts the pick back into `line`. */
      other?: { noun: string; words: string; line: string }
    }
  | { kind: "none" }

export interface Context {
  /** The list the person said to work in. "add items" with no list goes here. */
  listId?: string
  /** The clock for "due today" and "until Friday". Defaults to the real time. */
  now?: Date
}

const Q = `["“”'‘’]?`
const unquote = (s: string) => s.trim().replace(/^["“”'‘’{]+|["“”'‘’}.,!?]+$/g, "").trim()

/** Split "a, b; c" or lines into rows. Semicolons and newlines win over commas, so a title can hold a comma. */
export function splitRows(raw: string): string[] {
  const hard = raw.split(/\n|;/).map((s) => s.trim()).filter(Boolean)
  const rows = hard.length > 1 ? hard : raw.split(/,|\n|;/).map((s) => s.trim()).filter(Boolean)
  return rows.map((r) => r.replace(/^[-*•]\s*/, "").replace(/^and\s+/i, "")).filter(Boolean)
}

/** "author: Frank Herbert; pages = 412" → { author: "Frank Herbert", pages: "412" }. */
export function parseAttributePairs(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const row of splitRows(raw)) {
    const m = /^(.+?)\s*(?::|=|\bis\b)\s*(.+)$/i.exec(row)
    if (m) out[unquote(m[1]!)] = unquote(m[2]!)
  }
  return out
}

/** The line with the unclear words (and their quotes) replaced by one exact name. */
export function swapName(text: string, words: string, name: string): string | null {
  const w = unquote(words)
  const at = w ? text.toLowerCase().indexOf(w.toLowerCase()) : -1
  if (at < 0) return null
  const quote = /["“”'‘’]/
  const from = quote.test(text[at - 1] ?? "") ? at - 1 : at
  const to = at + w.length + (quote.test(text[at + w.length] ?? "") ? 1 : 0)
  return `${text.slice(0, from)}"${name}"${text.slice(to)}`
}

/**
 * An error that carries a key per candidate: the same line with the unclear words replaced by each exact name.
 * When the words fit nothing for sure it also carries `other`, so the person can search by other words.
 */
function failed(text: string, words: string, r: Extract<Resolved, { ok: false }>): Intent {
  const w = unquote(words)
  // Two things can share a name, so a key swaps in the exact id and says where the thing lives.
  const suggest = r.choices?.length
    ? r.choices.flatMap((c) => {
        const line = swapName(text, w, c.id)
        return line ? [{ label: c.detail ? `${c.name} · ${c.detail}` : c.name, text: line, ...(r.noun === "list" ? { peek: `peek list ${c.id}` } : {}) }] : []
      })
    : (r.options ?? []).flatMap((name) => {
        const line = swapName(text, w, name)
        return line ? [{ label: name, text: line }] : []
      })
  const other = r.noun && w ? { noun: r.noun, words: w, line: text } : undefined
  if (!suggest.length && !other) return { kind: "error", text: r.error }
  return { kind: "error", text: r.error, ...(suggest.length ? { suggest } : {}), ...(other ? { other } : {}) }
}

const typeOr = (w: World, words: string): Resolved => resolveType(w, unquote(words))
const err = (text: string): Intent => ({ kind: "error", text })

const LEAD_WORDS = /^(?:all|every|the|my|duplicate|any|some|are|is|there|do|i|have|of|many|much|how|items?)$/i

/**
 * The item type named at the end of some words: "how many Book" → Book. Tries the longest run of words first and
 * drops one word from the front each time, so the question words never hide the type.
 */
function typeEndingIn(w: World, phrase: string): string | undefined {
  const parts = unquote(phrase).trim().replace(/\s+(?:are|is|do|does|have|has|that|which)$/i, "").split(/\s+/).filter(Boolean)
  for (let i = 0; i < parts.length; i++) {
    const words = parts.slice(i)
    if (words.length === 1 && LEAD_WORDS.test(words[0]!)) continue
    const r = resolveType(w, words.join(" "))
    if (r.ok) return r.id
  }
  return undefined
}

function scopeOf(w: World, t: string, orig = t): { typeId?: string; listId?: string; fail?: Intent } {
  const out: { typeId?: string; listId?: string; fail?: Intent } = {}
  let rest = t
  // "of item type Book", "among type Book", "for the item type Book".
  const phrase = new RegExp(`\\b(?:of|for|among|in|with|on)\\s+(?:the\\s+)?(?:item\\s+)?types?\\s+${Q}([\\w][\\w ]*?)${Q}(?=\\s+(?:in|within|on)\\b|\\s*[?.!]*$)`, "i").exec(rest)
  if (phrase) {
    const r = resolveType(w, phrase[1]!)
    if (!r.ok) {
      out.fail = failed(orig, phrase[1]!, r)
      return out
    }
    out.typeId = r.id
    rest = rest.replace(phrase[0], "")
  }
  const typed = new RegExp(`\\b${Q}([\\w][\\w ]*?)${Q}\\s+(?:type\\s+)?items\\b`, "i").exec(rest)
  if (typed && !out.typeId) {
    const id = typeEndingIn(w, typed[1]!)
    if (id) out.typeId = id
  }
  // "how many books lack an author": a type named right before the lack words, no "items" at all.
  const beforeLack = /^(?:how many|count|find|show|list|which|what)\b(.+?)\s+(?:that\s+|which\s+|who\s+)?(?:lack|lacks|lacking|missing|without|with no|have no|has no|don'?t have|doesn'?t have)\b/i.exec(rest)
  if (beforeLack && !out.typeId) {
    const id = typeEndingIn(w, beforeLack[1]!)
    if (id) out.typeId = id
  }
  // "duplicates of Books", "duplicates among Book".
  const bare = /\bduplicates?\s+(?:of|among|for)\s+(?:the\s+|all\s+|my\s+)?([\w ]+?)\s*[?.!]*$/i.exec(rest)
  if (bare && !out.typeId) {
    const r = resolveType(w, bare[1]!)
    if (r.ok) out.typeId = r.id
  }
  const inList = /\b(?:in|within|on)\s+(?:the\s+)?(?:list\s+(?:id\s+)?)?([^,.?]+?)(?:\s+list)?\s*[?.!]*$/i.exec(rest)
  if (inList && !(out.typeId && bare)) {
    const words = unquote(inList[1]!)
    const r = resolveList(w, words)
    if (r.ok) out.listId = r.id
    else if (/\blist\b/i.test(inList[0]!) || (r.options && r.options.length)) out.fail = failed(orig, words, r)
    else if (!out.typeId && !/^(all|every|my|any|everything|here|total|the)\b/i.test(words)) out.fail = failed(orig, words, r)
  }
  return out
}

export function parseIntent(w: World, text: string, ctx: Context = {}): Intent {
  const t = text.trim()
  if (!t) return { kind: "none" }
  const lower = t.toLowerCase()

  if (/^(help|what can you do\??|tools|\?)$/.test(lower)) return { kind: "help" }
  if (/^undo\b/.test(lower)) return { kind: "undo" }
  if (/^(clear|drop|forget)\s+(the\s+)?(focus|list)\b/.test(lower)) return { kind: "focus", listId: null }

  const focus = /^(?:focus on|work on|work in|switch to|use|open)\s+(?:the\s+)?(?:list\s+)(?:id\s+)?(.+)$/i.exec(t) ?? /^focus\s+(?:on\s+)?(.+)$/i.exec(t)
  if (focus) {
    const r = resolveList(w, unquote(focus[1]!))
    return r.ok ? { kind: "focus", listId: r.id, name: r.name } : failed(t, focus[1]!, r)
  }

  const lookup = parseLookup(w, t)
  if (lookup) return lookup

  const merge = parseMergeLists(w, t)
  if (merge) return merge

  const shopping = parseShopping(w, t, ctx.now ?? new Date())
  if (shopping) return shopping

  const collect = parseCollect(w, t, ctx.now ?? new Date())
  if (collect) return collect

  // Apply a type to a list's items: "apply new item type "Instagram Account" to all items in instagram mutuals list".
  const apply = new RegExp(`^(?:please\\s+)?(?:apply|assign|give|set|make)\\s+(?:the\\s+)?(new\\s+|existing\\s+)?(?:item\\s+)?type\\s+${REF}\\s+(?:to|on|for)\\s+(?:all\\s+|every\\s+)?(?:the\\s+)?items?\\s+(?:in|on|of|from)\\s+(?:the\\s+)?(?:list\\s+)?${REF}(?:\\s+list)?\\s*[?.!]*$`, "i").exec(t)
  if (apply) {
    const flag = apply[1]?.trim().toLowerCase()
    const typeWords = unquote(apply[2] ?? apply[3]!)
    const listWords = unquote(apply[4] ?? apply[5]!)
    const l = resolveList(w, listWords)
    if (!l.ok) return failed(t, listWords, l)
    if (flag === "new") return { kind: "tool", call: { tool: "retype-items", to: "", listId: l.id, newTypeName: typeWords } }
    const ty = resolveType(w, typeWords)
    if (ty.ok) return { kind: "tool", call: { tool: "retype-items", to: ty.id, listId: l.id } }
    // Unknown and not said to be "existing": say what happens, and let the person pick, or make it.
    if (flag !== "existing" && !ty.options?.length) return { kind: "tool", call: { tool: "retype-items", to: "", listId: l.id, newTypeName: typeWords } }
    return failed(t, typeWords, ty)
  }

  // Make one type primary: "remove the Task item type from all Book type items".
  const drop =
    new RegExp(`(?:remove|drop|take off|strip)\\s+(?:the\\s+)?${Q}([\\w ]+?)${Q}\\s+(?:item\\s+)?type\\s+from\\s+(?:all\\s+|every\\s+)?${Q}([\\w ]+?)${Q}\\s+(?:type\\s+)?items`, "i").exec(t) ??
    null
  // Other order: "For all Book type items ... remove the Task item type".
  const dropLate = drop
    ? null
    : new RegExp(`(?:for\\s+)?(?:all|every)\\s+${Q}([\\w ]+?)${Q}\\s+(?:type\\s+)?items[\\s\\S]*?(?:remove|drop|take off|strip)\\s+(?:the\\s+)?${Q}([\\w ]+?)${Q}\\s+(?:item\\s+)?type`, "i").exec(t)
  const dropPair = drop ?? (dropLate ? [dropLate[0], dropLate[2], dropLate[1]] : null)
  if (dropPair) {
    const dropT = typeOr(w, dropPair[1]!)
    const keepT = typeOr(w, dropPair[2]!)
    if (!dropT.ok) return failed(t, dropPair[1]!, dropT)
    if (!keepT.ok) return failed(t, dropPair[2]!, keepT)
    return { kind: "tool", call: { tool: "exclusive-type", keep: keepT.id, drop: dropT.id } }
  }

  // Copy attributes: "make all Book items have the attributes item <id> has".
  if (/\battributes?\b/i.test(t)) {
    const { known, unknown } = itemIdsIn(w, t)
    const wantsAdd = /^add\b/i.test(t) && /\bto\s+(?:the\s+)?list\b/i.test(t)
    if (!wantsAdd && (known.length || unknown.length)) {
      if (!known.length) return err(`I can't find an item with id ${unknown[0]}. Check the id and try again.`)
      const all = new RegExp(`\\b(?:all|every)\\s+${Q}([\\w ]+?)${Q}\\s+(?:type\\s+)?items\\b`, "i").exec(t)
      const call: Extract<ToolCall, { tool: "copy-attributes" }> = { tool: "copy-attributes", fromItemId: known[0]! }
      if (all) {
        const r = typeOr(w, all[1]!)
        if (!r.ok) return err(r.error)
        call.typeId = r.id
      } else {
        const sc = scopeOf(w, t)
        if (sc.fail) return sc.fail
        if (sc.listId) call.listId = sc.listId
      }
      return { kind: "tool", call }
    }
  }

  // Add items: "add Dune, Emma to list <id> with attributes author: X; pages: 300".
  const add =
    /^add\s+(?:items?\s+)?([\s\S]+?)\s+to\s+(?:the\s+)?list\s+(?:id\s+)?(\S+?)(?:\s+with\s+(?:the\s+following\s+)?(?:attributes?\s*)?:?\s*([\s\S]+))?$/i.exec(t)
  const addHere = !add && ctx.listId ? /^add\s+(?:items?\s+)?([\s\S]+?)(?:\s+with\s+(?:the\s+following\s+)?(?:attributes?\s*)?:?\s*([\s\S]+))?$/i.exec(t) : null
  if (add || addHere) {
    let listId = ctx.listId
    if (add) {
      const r = resolveList(w, unquote(add[2]!))
      if (!r.ok) return failed(t, add[2]!, r)
      listId = r.id
    }
    const titles = splitRows(unquote((add ? add[1] : addHere![1])!))
    const attrRaw = (add ? add[3] : addHere![2]) ?? ""
    return { kind: "tool", call: { tool: "add-items", listId: listId!, titles, attributes: parseAttributePairs(attrRaw) } }
  }

  // Duplicates.
  if (/\b(duplicates?|dupes?|same item|identical)\b/i.test(t) && /\b(find|show|suggest|look|help|any|check|merge|list|review|start)\b/i.test(t)) {
    const sc = scopeOf(w, t)
    if (sc.fail) return sc.fail
    return { kind: "tool", call: { tool: "find-duplicates", typeId: sc.typeId, listId: sc.listId ?? ctx.listId } }
  }

  // Change type: "change all Task items in Reading to Book".
  const retype = new RegExp(`^(?:change|convert|retype|turn)\\s+(?:all\\s+)?${Q}([\\w ]+?)${Q}\\s+(?:type\\s+)?items?\\s+(?:in\\s+(?:the\\s+)?(?:list\\s+)?(.+?)\\s+)?(?:to|into)\\s+(?:type\\s+)?${Q}([\\w ]+?)${Q}$`, "i").exec(t)
  if (retype) {
    const from = typeOr(w, retype[1]!)
    const to = typeOr(w, retype[3]!)
    if (!from.ok) return failed(t, retype[1]!, from)
    if (!to.ok) return failed(t, retype[3]!, to)
    let listId: string | undefined
    if (retype[2]) {
      const l = resolveList(w, unquote(retype[2]))
      if (!l.ok) return err(l.error)
      listId = l.id
    }
    return { kind: "tool", call: { tool: "retype-items", from: from.id, to: to.id, listId } }
  }
  const inListType = new RegExp(`^(?:make|set)\\s+(?:all\\s+)?items?\\s+in\\s+(?:the\\s+)?(?:list\\s+)?(.+?)\\s+(?:be\\s+|to be\\s+|of type\\s+|type\\s+)${Q}([\\w ]+?)${Q}$`, "i").exec(t)
  if (inListType) {
    const l = resolveList(w, unquote(inListType[1]!))
    const to = typeOr(w, inListType[2]!)
    if (!l.ok) return err(l.error)
    if (!to.ok) return err(to.error)
    return { kind: "tool", call: { tool: "retype-items", to: to.id, listId: l.id } }
  }

  // Find / count.
  const askLack = /^(how many|count|find|show|list|which|what)\b/i.test(t) && /\b(?:lack|lacks|lacking|missing|without|with no|have no|has no|don'?t have|doesn'?t have)\b/i.test(t)
  if (/^(how many|count|find|show|list|which|what)\b/i.test(t) && (/\bitems?\b/i.test(t) || askLack)) {
    const sc = scopeOf(w, t)
    if (sc.fail) return sc.fail
    // Without the word "items", only a recognised type makes this a find; otherwise let the other readings try.
    if (!/\bitems?\b/i.test(t) && !sc.typeId) return suggestWording(w, t) ?? { kind: "none" }
    const lacks = new RegExp(`\\b(?:lack|lacks|lacking|missing|without|with no|have no|has no|don'?t have|doesn'?t have)\\s+(?:an?\\s+|the\\s+)?${Q}([\\w ]+?)${Q}\\s*(?:attribute|value)?\\s*[?.!]*$`, "i").exec(t.replace(/\s+in\s+(?:the\s+)?(?:list\s+)?.*$/i, ""))
    const named = /\b(?:named|called|containing|with the word)\s+["“]?([^"”?]+?)["”]?\s*[?.!]*$/i.exec(t)
    return {
      kind: "tool",
      call: { tool: "find-items", typeId: sc.typeId, listId: sc.listId ?? ctx.listId, text: named?.[1], lacksAttribute: lacks?.[1] },
    }
  }

  return suggestWording(w, t) ?? { kind: "none" }
}


// ---------------------------------------------------------------- lookup

/** "what is the list id for the All Items list of Next actions folder?", "item id for Book Doors of Perception". */
function parseLookup(w: World, t: string): Intent | null {
  const m = /^(?:(?:what(?:'s|\s+is|\s+are)|get|give(?:\s+me)?|tell\s+me|find|show(?:\s+me)?|look\s*up)\s+)?(?:me\s+)?(?:the\s+)?(list|item|folder|(?:item\s+)?type)\s+ids?\s+(?:for|of)\s+(.+?)\s*[?.!]*$/i.exec(t)
  if (!m) return null
  const what = (/type/i.test(m[1]!) ? "type" : m[1]!.toLowerCase()) as "list" | "item" | "folder" | "type"
  let words = unquote(m[2]!).replace(/^(?:the|a|an)\s+/i, "")
  const call: Extract<ToolCall, { tool: "lookup-id" }> = { tool: "lookup-id", what, words }
  if (what === "list") {
    const inFolder = /^(.+?)\s+(?:list\s+)?(?:of|in|from|inside)\s+(?:the\s+)?(.+?)\s+folder$/i.exec(words)
    if (inFolder) {
      const f = resolveFolder(w, unquote(inFolder[2]!))
      if (!f.ok) return failed(t, inFolder[2]!, f)
      call.folderId = f.id
      words = unquote(inFolder[1]!).replace(/\s+list$/i, "")
    } else words = words.replace(/\s+list$/i, "")
  } else if (what === "item") {
    // A leading item type narrows: "Book Doors of Perception".
    const first = words.split(/\s+/)[0]!
    const ty = w.types.find((x) => x.name.toLowerCase() === first.toLowerCase())
    if (ty && words.split(/\s+/).length > 1) {
      call.typeId = String(ty.id)
      words = words.slice(first.length).trim()
    }
  }
  call.words = unquote(words)
  return { kind: "tool", call }
}

// ---------------------------------------------------------------- collect

const REF = `(?:["“”]([^"“”]+)["“”]|(\\S[^,.?!]*?))`
/** Where an unquoted list name ends. */
const NAME_END = `(?=\\s+(?:that|which|who|but|and|where|with|due|aren['’]?t|are|is|isn['’]?t|not|also)\\b|[,.?!]|\\s*$)`

/** "add all items due from now until Dec 25 to list Gifts" and its relatives. Null when the line is not that shape. */
function parseCollect(w: World, t: string, now: Date): Intent | null {
  const split = /^(?:please\s+)?(?:add|put|collect|gather|include)\s+((?:all|every|everything|any)\b[\s\S]*?)\s+(?:to|into)\s+((?:an?\s+|the\s+)?(?:new\s+)?list\b[\s\S]*)$/i.exec(t)
  if (!split) return null
  const source = split[1]!
  const destText = split[2]!.trim()

  // ---- destination
  let dest: CollectDest
  if (/^(?:an?\s+)?new\s+list\b/i.test(destText)) {
    let rest = destText.replace(/^(?:an?\s+)?new\s+list\b\s*(?:called|named|titled)?\s*/i, "")
    let typeWord: string | undefined
    let typeFlag: string | undefined
    let folderWord: string | undefined
    let folderNew = false
    for (let pass = 0; pass < 2; pass++) {
      const ty = /\s*,?\s*\b(?:with|using|and)\s+(?:the\s+)?(?:items?\s+(?:of|as|being)\s+)?(?:an?\s+)?(new\s+|existing\s+)?item\s*type\s+(.+?)\s*$/i.exec(rest)
      if (ty && typeWord === undefined) {
        typeFlag = ty[1]?.trim().toLowerCase()
        typeWord = unquote(ty[2]!)
        rest = rest.slice(0, ty.index)
        continue
      }
      const fo = /\s+(?:in|inside|under|into)\s+(?:the\s+)?(new\s+)?(?:folder\s+(.+?)|(.+?)\s+folder)\s*$/i.exec(rest)
      if (fo && folderWord === undefined) {
        folderNew = !!fo[1]
        folderWord = unquote((fo[2] ?? fo[3])!)
        rest = rest.slice(0, fo.index)
      }
    }
    const name = unquote(rest)
    if (!name) return err("What should the new list be called? Say it like: to new list called \"Christmas list\".")
    const newList: Extract<CollectDest, { newList: unknown }>["newList"] = { name }
    if (folderWord) {
      const f = folderNew ? ({ ok: false, error: "" } as Resolved) : resolveFolder(w, folderWord)
      if (f.ok) newList.folderId = f.id
      else if (folderNew) newList.newFolderName = folderWord
      else if (f.options?.length) return failed(t, folderWord, f)
      else return { kind: "error", text: `I don't know a folder called "${folderWord}". Say "in new folder ${folderWord}" and I'll make it.`, suggest: [{ label: `Make folder "${folderWord}"`, text: t.replace(new RegExp(`(in\\s+(?:the\\s+)?)(?:folder\\s+)?["“]?${folderWord.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["”]?(\\s+folder)?`, "i"), `in new folder "${folderWord}"`) }] }
    }
    if (typeWord) {
      const ty = typeFlag === "new" ? ({ ok: false, error: "" } as Resolved) : resolveType(w, typeWord)
      if (ty.ok) newList.typeId = ty.id
      else if (typeFlag !== "new" && ty.options?.length) return failed(t, typeWord, ty)
      else newList.newTypeName = typeWord
    }
    dest = { newList }
  } else {
    const m = /^(?:an?\s+|the\s+)?list\s+(?:id\s+)?([\s\S]+)$/i.exec(destText)
    const words = unquote(m?.[1] ?? "")
    if (!words) return err("Add them to which list?")
    const r = resolveList(w, words)
    if (!r.ok) return failed(t, words, r)
    dest = { listId: r.id }
  }

  // ---- source
  let src = source
  const filter: CollectFilter = {}
  if (/\b(?:including|and|even)\s+(?:the\s+)?(?:done|completed|finished)\b/i.test(src)) {
    filter.includeDone = true
    src = src.replace(/\b(?:including|and|even)\s+(?:the\s+)?(?:done|completed|finished)(?:\s+(?:ones|items))?/i, "")
  }
  const resolveRef = (quoted: string | undefined, bare: string | undefined, source: string): Intent | string => {
    const words = unquote(quoted ?? bare ?? "").replace(/^like\s+/i, "")
    const r = resolveList(w, words)
    return r.ok ? r.id : failed(t, words, r)
  }
  // Not in: "that aren't in like "Books I own"", "not already on list Gifts".
  const notRe = new RegExp(`(?:\\b(?:that|which|who)\\s+)?(?:aren['’]?t|are\\s+not|isn['’]?t|is\\s+not|not|n['’]t)\\s+(?:already\\s+|also\\s+|yet\\s+)?(?:in|on)\\s+(?:like\\s+)?(?:the\\s+)?(?:list\\s+)?${REF}${NAME_END}`, "gi")
  const notIds: string[] = []
  for (const m of [...src.matchAll(notRe)]) {
    const got = resolveRef(m[1], m[2], m[0])
    if (typeof got !== "string") return got
    notIds.push(got)
  }
  src = src.replace(notRe, " ")
  // In: needs the word "list" or quotes, so "in the next 7 days" is not read as a list.
  const inRe = new RegExp(`\\b(?:in|from|on)\\s+(?:the\\s+)?(?:(?:list\\s+(?:id\\s+)?)${REF}|["“”]([^"“”]+)["“”])${NAME_END}`, "gi")
  const inIds: string[] = []
  for (const m of [...src.matchAll(inRe)]) {
    const got = resolveRef(m[1] ?? m[3], m[2], m[0])
    if (typeof got !== "string") return got
    inIds.push(got)
  }
  src = src.replace(inRe, " ")
  if (inIds.length) filter.inListIds = [...new Set(inIds)]
  if (notIds.length) filter.notInListIds = [...new Set(notIds)]

  // Due.
  const due = parseDueClause(src, now)
  if (due && "error" in due) return err(`${due.error} Try "due from now until December 25", "due this week", or "due by Friday".`)
  if (due) {
    filter.due = due.due
    src = src.replace(/\boverdue\b|\bpast due\b/i, " ")
  }

  // Type: "task type items", "Book items", "items of type Book", "tasks that ...".
  const head = src.replace(/^\s*(?:all|every|any)\s+(?:of\s+)?(?:the\s+)?/i, "").replace(/^everything\b/i, "")
  const ofType = new RegExp(`\\bitems?\\s+(?:of|with)\\s+(?:the\\s+)?(?:item\\s+)?types?\\s+${REF}${NAME_END}`, "i").exec(head)
  const before = /^(?:(.+?)\s+)?items?\b/i.exec(head.trim())
  const plural = /^([a-z][\w ]*?)\s+(?:that|which|who|due|in|from|not)\b/i.exec(head.trim())
  let typeWords: string | undefined
  if (ofType) typeWords = unquote(ofType[1] ?? ofType[2]!)
  else if (before?.[1]) typeWords = unquote(before[1]).replace(/^the\s+/i, "").replace(/\s+(?:item\s+)?type$/i, "").trim()
  if (typeWords && !/^(the|my|these|those|open|due|overdue|undone|unfinished)$/i.test(typeWords)) {
    const r = resolveType(w, typeWords)
    if (!r.ok) return failed(t, typeWords, r)
    filter.typeId = r.id
  } else if (!before && plural) {
    const r = resolveType(w, plural[1]!)
    if (r.ok) filter.typeId = r.id
  }
  return { kind: "tool", call: { tool: "collect-items", filter, dest } }
}

/**
 * A line that names two item types and talks about one being the other ("Book items that are also Task items
 * should not be Task") fits no shape above. Offer the one shape that does the job, both ways round, first mention
 * as the type to keep.
 */
function suggestWording(w: World, t: string): Intent | null {
  if (!/\b(remove|removed|primary|also|shouldn'?t|should not|isn'?t|not be|instead of|stop being)\b/i.test(t)) return null
  const lower = t.toLowerCase()
  const named = w.types
    .map((ty) => ({ name: ty.name, at: lower.search(new RegExp(`\\b${ty.name.toLowerCase().replace(/[^a-z0-9 ]/g, "")}s?\\b`)) }))
    .filter((x) => x.at >= 0 && x.name.length > 2 && x.name.toLowerCase() !== "item")
    .sort((a, b) => a.at - b.at)
  if (named.length < 2) return null
  const [a, b] = [named[0]!.name, named[1]!.name]
  return {
    kind: "error",
    text: `I think you want one item type to stop being another. I only do that in one shape: "Remove the <type> item type from all <type> type items". Which do you mean?`,
    suggest: [
      { label: `${a} stays, ${b} goes`, text: `Remove the ${b} item type from all ${a} type items` },
      { label: `${b} stays, ${a} goes`, text: `Remove the ${a} item type from all ${b} type items` },
    ],
  }
}


// ---------------------------------------------------------------- merge lists

const COUNT_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 }

/**
 * "Merge all 3 instagram mutuals lists into 1 list (keep all items) and make the item type new item type "X"".
 * The lists are every list with that exact name (or a list per name joined by "and"); a stated count that does
 * not match is said back, never guessed past.
 */
function parseMergeLists(w: World, t: string): Intent | null {
  const m = new RegExp(`^(?:please\\s+)?merge\\s+(?:all\\s+)?(?:(\\d+|${Object.keys(COUNT_WORDS).join("|")})\\s+)?(?:of\\s+)?(?:the\\s+)?(.+?)\\s+lists?\\s+(?:together\\s+)?(?:in)?to\\s+(?:1|one|a|single|one single|a single)\\s+list\\b([\\s\\S]*)$`, "i").exec(t)
  if (!m) return null
  const said = m[1] ? (COUNT_WORDS[m[1].toLowerCase()] ?? Number(m[1])) : undefined
  const words = unquote(m[2]!)
  const rest = m[3] ?? ""
  let ids: string[] = []
  const same = listsNamed(w, words)
  if (same.length >= 2) ids = same.map((l) => l.id)
  else {
    const parts = words.split(/\s*(?:,|\band\b|&)\s*/i).map(unquote).filter(Boolean)
    if (parts.length < 2) {
      return err(same.length === 1 ? `Only one list is called "${same[0]!.name}", so there is nothing to merge it with. Name the lists to merge, like "merge A and B into one list".` : `I can't find two or more lists called "${words}". Name them, like "merge A and B into one list".`)
    }
    for (const p of parts) {
      const r = resolveList(w, p)
      if (!r.ok) return failed(t, p, r)
      ids.push(r.id)
    }
  }
  ids = [...new Set(ids)]
  if (ids.length < 2) return err("That is the same list twice. Name two or more different lists.")
  if (said && said !== ids.length) {
    return {
      kind: "error",
      text: `You said ${said} lists, but I found ${ids.length} called "${words}". Merge those ${ids.length}?`,
      suggest: [{ label: `Merge all ${ids.length}`, text: t.replace(new RegExp(`\\b${m[1]}\\b`), String(ids.length)) }],
    }
  }
  const call: Extract<ToolCall, { tool: "merge-lists" }> = { tool: "merge-lists", listIds: ids }
  const tm = new RegExp(`\\btype\\s+(?:to\\s+)?(new\\s+|existing\\s+)?(?:item\\s+)?(?:type\\s+)?${REF}\\s*[?.!]*$`, "i").exec(rest)
  if (tm) {
    const flag = tm[1]?.trim().toLowerCase()
    const typeWords = unquote(tm[2] ?? tm[3]!)
    if (flag === "new") call.newTypeName = typeWords
    else {
      const ty = resolveType(w, typeWords)
      if (ty.ok) call.typeId = ty.id
      else if (flag !== "existing" && !ty.options?.length) call.newTypeName = typeWords
      else return failed(t, typeWords, ty)
    }
  }
  return { kind: "tool", call }
}


// ---------------------------------------------------------------- shopping list

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const MONTH_RE = `(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?`
const monthName = (m: string) => {
  const i = MONTHS.indexOf(m.slice(0, 3).toLowerCase())
  return i < 0 ? m : `${m.slice(0, 1).toUpperCase()}${m.slice(1, 3).toLowerCase()}`
}
const dayName = (d: Date) => `${monthName(MONTHS[d.getMonth()]!)} ${d.getDate()}`

/** What the list is called: "called X", else "<date> shopping list", else "Shopping list <today>". */
function shoppingName(t: string, now: Date): string {
  const quoted = /\b(?:called|named|titled)\s+["“]([^"”]+)["”]/i.exec(t)
  if (quoted) return quoted[1]!.trim()
  const called = /\b(?:called|named|titled)\s+([^,.;()"“”]+?)(?=\s*(?:[,.;()]|\b(?:so|it|and|with|that|skip|except|leave|not|but|must|should)\b|$))/i.exec(t)
  if (called) return unquote(called[1]!)
  const noun = `(shopping|buy|to-?buy|order|orders|online order|purchase|wish ?)\\s*list`
  const md = new RegExp(`\\b(${MONTH_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:['’]s)?\\s+${noun}`, "i").exec(t)
  if (md) return `${monthName(md[1]!)} ${Number(md[2])} ${md[3]!.toLowerCase().replace(/\s+/g, " ").trim()} list`
  const dm = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_RE})(?:['’]s)?\\s+${noun}`, "i").exec(t)
  if (dm) return `${monthName(dm[2]!)} ${Number(dm[1])} ${dm[3]!.toLowerCase().replace(/\s+/g, " ").trim()} list`
  const rel = new RegExp(`\\b(today|tonight|tomorrow)(?:['’]s)?\\s+${noun}`, "i").exec(t)
  if (rel) {
    const d = new Date(now)
    if (/tomorrow/i.test(rel[1]!)) d.setDate(d.getDate() + 1)
    return `${dayName(d)} ${rel[2]!.toLowerCase().replace(/\s+/g, " ").trim()} list`
  }
  return `${dayName(now)} shopping list`
}

/** "it must have at least modafinil, brow bleach, hair dye" → the three things. */
function mustHaves(t: string): string[] {
  const m =
    /\b(?:must|should|needs?\s+to|has\s+to|have\s+to)\s+(?:have|include|contain|hold)\s+(?:at\s+least\s*)?:?\s*([\s\S]+)$/i.exec(t) ??
    /\b(?:at\s+least|including|make\s+sure\s+(?:it\s+)?(?:has|includes))\s*:?\s*([\s\S]+)$/i.exec(t)
  if (!m) return []
  const raw = m[1]!.replace(/\([^)]*\)/g, " ").split(/\b(?:skip|except|leave\s+out|not\s+from)\b/i)[0]!
  return [
    ...new Set(
      raw
        .split(/\s*(?:,|;|\n|\+|&|\band\b|\bplus\b)\s*/i)
        .map((s) => unquote(s).replace(/^(?:some|a|an|the|more|new)\s+/i, "").trim())
        .filter((s) => s && !/^(?:etc|stuff|things|more)$/i.test(s) && s.length <= 60),
    ),
  ]
}

/**
 * "Help me find all the things I need to get or want or need to buy (create a consolidated Nov 8th shopping list
 * so I can place online orders). It must have at least modafinil, brow bleach, hair dye." Null when the line is
 * not a request for a consolidated list of things to get.
 */
function parseShopping(w: World, t: string, now: Date): Intent | null {
  const listWord = /\b(?:shopping|buy|to-?buy|order|orders|online\s+order|purchase|wish)\s*list\b/i.test(t)
  const make = /\b(?:make|create|build|consolidat\w*|compile|put\s+together|start|generate|combine)\b/i.test(t)
  const things = /\b(?:things|stuff|everything|all|what)\b[\s\S]*\b(?:need|want|wanted)\b[\s\S]*\b(?:buy|get|order|purchase)\b/i.test(t) && /\blist\b/i.test(t)
  if (!((listWord && make) || things)) return null
  // Lines that already say exactly which items go where belong to "collect items".
  if (/^(?:please\s+)?(?:add|put|collect|gather|include)\s+(?:all|every|everything|any)\b[\s\S]*\s(?:to|into)\s+(?:an?\s+|the\s+)?(?:new\s+)?list\b/i.test(t)) return null

  const skipIds: string[] = []
  const skip = /\b(?:skip|except(?:\s+for)?|leave\s+out|not\s+from|but\s+not)\s+(?:the\s+)?(?:lists?\s+)?([\s\S]+?)(?=\s*(?:[.;]|\b(?:it|and\s+it|must|should|make\s+sure)\b|$))/i.exec(t)
  if (skip) {
    const quoted = [...skip[1]!.matchAll(/["“]([^"”]+)["”]/g)].map((m) => m[1]!)
    const parts = quoted.length ? quoted : skip[1]!.split(/\s*(?:,|\band\b|&)\s*/i).map(unquote).filter(Boolean)
    for (const p of parts) {
      const r = resolveList(w, p.replace(/\s+lists?$/i, ""))
      if (!r.ok) return failed(t, p, r)
      skipIds.push(r.id)
    }
  }
  const call: ToolCall = { tool: "shopping-list", name: shoppingName(t, now), mustHave: mustHaves(t) }
  if (skipIds.length) call.skipListIds = [...new Set(skipIds)]
  return { kind: "tool", call }
}
