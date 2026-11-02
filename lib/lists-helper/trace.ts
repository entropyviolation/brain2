/**
 * lib/lists-helper/trace.ts — The Lists BIMBY's thought process, as lines to show (pure)
 *
 * Every line the person sends gets a trace: what was heard, which tool was picked and with which slots (names,
 * not ids), the stages the tool went through, and what came back. It is the cognitive architecture on screen,
 * so a wrong pick or a wrong slot can be seen and fixed. Drawn by `components/Lab/ListsHelper/ListsHelperChat.tsx`.
 */

import type { Intent } from "./parse"
import type { ToolCall, ToolResult, World } from "./types"

export interface TraceLine {
  /** heard: the line; pick: tool and slots; stage: inside the tool; out: what came back. */
  step: "heard" | "pick" | "stage" | "out"
  text: string
}

const typeName = (w: World, id: string) => w.types.find((t) => String(t.id) === id)?.name ?? id
const listName = (w: World, id: string) => w.lists.find((l) => l.id === id)?.name ?? id
const q = (s: string) => `"${s}"`
const names = (ids: string[] | undefined, f: (id: string) => string) => (ids?.length ? ids.map(f).join(", ") : undefined)

/** Slots of a call with every id turned back into a name. */
export function describeCall(w: World, c: ToolCall): string[] {
  const out: string[] = []
  const add = (k: string, v: string | undefined | false) => {
    if (v) out.push(`${k}: ${v}`)
  }
  const ln = (id: string) => q(listName(w, id))
  switch (c.tool) {
    case "find-items":
      add("type", c.typeId && typeName(w, c.typeId))
      add("list", c.listId && ln(c.listId))
      add("text", c.text)
      add("lacks", c.lacksAttribute)
      break
    case "find-duplicates":
      add("type", c.typeId && typeName(w, c.typeId))
      add("list", c.listId && ln(c.listId))
      if (!c.typeId && !c.listId) out.push("scope: every item")
      break
    case "collect-items": {
      const f = c.filter
      add("type", f.typeId && typeName(w, f.typeId))
      add("on all of", names(f.inListIds, ln))
      add("on any of", names(f.inAnyListIds, ln))
      add("on none of", names(f.notInListIds, ln))
      add("due", f.due?.label ?? (f.due ? "range" : undefined))
      add("done items", f.includeDone && "included")
      if ("listId" in c.dest) add("to list", ln(c.dest.listId))
      else {
        const n = c.dest.newList
        add("to NEW list", q(n.name))
        add("folder", n.newFolderName ? `NEW ${q(n.newFolderName)}` : n.folderId && q(w.folders?.find((f2) => f2.id === n.folderId)?.name ?? n.folderId))
        add("list item type", n.newTypeName ? `NEW ${q(n.newTypeName)}` : n.typeId && typeName(w, n.typeId))
      }
      break
    }
    case "lookup-id":
      add("kind", c.what)
      add("name", q(c.words))
      add("folder", c.folderId && q(w.folders?.find((f) => f.id === c.folderId)?.name ?? c.folderId))
      add("item type", c.typeId && typeName(w, c.typeId))
      break
    case "add-items":
      add("list", ln(c.listId))
      add("titles", c.titles.join(", "))
      add("attributes", Object.keys(c.attributes).length ? Object.entries(c.attributes).map(([k, v]) => `${k}=${v}`).join("; ") : undefined)
      break
    case "merge-items":
      add("ids", c.ids.join(", "))
      break
    case "exclusive-type":
      add("keep", typeName(w, c.keep))
      add("drop", typeName(w, c.drop))
      break
    case "copy-attributes":
      add("from item", c.fromItemId)
      add("type", c.typeId && typeName(w, c.typeId))
      add("list", c.listId && ln(c.listId))
      break
    case "retype-items":
      add("from", c.from && typeName(w, c.from))
      add("to", c.newTypeName ? `NEW ${q(c.newTypeName)}` : typeName(w, c.to))
      add("list", c.listId && ln(c.listId))
      break
  }
  return out
}

/** The trace for one request: what was heard, what was picked, the tool's stages, the outcome. */
export function traceOf(w: World, text: string, intent: Intent, result?: ToolResult, outcome?: string): TraceLine[] {
  const lines: TraceLine[] = [{ step: "heard", text: `Heard: ${q(text.trim())}` }]
  switch (intent.kind) {
    case "tool": {
      lines.push({ step: "pick", text: `Picked tool ${intent.call.tool}` })
      for (const s of describeCall(w, intent.call)) lines.push({ step: "pick", text: `  ${s}` })
      const stages = result?.kind === "plan" ? result.plan.trace : result?.kind === "answer" ? result.trace : undefined
      for (const s of stages ?? []) lines.push({ step: "stage", text: s })
      if (result?.kind === "groups") lines.push({ step: "stage", text: `Compared names and types: ${result.groups.length} possible duplicate group(s) among ${result.scope}.` })
      break
    }
    case "error":
      lines.push({ step: "pick", text: "No tool picked: a name could not be resolved or the line is unclear." })
      break
    case "none":
      lines.push({ step: "pick", text: "No tool picked: the line fits none of the grammar shapes." })
      break
    case "focus":
      lines.push({ step: "pick", text: "Set the working list (no tool)." })
      break
    case "undo":
      lines.push({ step: "pick", text: "Undo the last change (no tool)." })
      break
    case "help":
      lines.push({ step: "pick", text: "Show the tool list (no tool)." })
      break
  }
  if (outcome) lines.push({ step: "out", text: outcome })
  return lines
}
