/**
 * lib/lists-helper/types.ts — Shapes shared by the Lists BIMBY's tools, parser, and session
 *
 * The helper is a small set of typed tools over lists and items. A tool never writes: it reads a `World`
 * (a snapshot) and returns either an answer or a `Plan`. A plan is applied only after the person approves it,
 * through a `Port` that reaches the stores. Plan: `components/Lab/ListsHelper/README.md`.
 */

import type { ItemMergePlan } from "@/lib/item-merge"
import type { DueFilter } from "./dates"
import type { Folder, ItemTypeDefinition, List, Task } from "@/lib/types"

/** Everything a tool may read. Never mutated. */
export interface World {
  tasks: Task[]
  lists: List[]
  types: ItemTypeDefinition[]
  /** Folders, for filing a new list. Omitted in a snapshot that has none. */
  folders?: Folder[]
}

export type ToolName =
  | "find-items"
  | "find-duplicates"
  | "merge-items"
  | "exclusive-type"
  | "copy-attributes"
  | "retype-items"
  | "add-items"
  | "collect-items"
  | "merge-lists"
  | "lookup-id"

/** One call to one tool, with every name already resolved to an id. */
export type ToolCall =
  | { tool: "find-items"; typeId?: string; listId?: string; text?: string; lacksAttribute?: string }
  | { tool: "find-duplicates"; typeId?: string; listId?: string }
  | { tool: "merge-items"; ids: string[]; survivorId?: string }
  | { tool: "exclusive-type"; keep: string; drop: string }
  | { tool: "copy-attributes"; fromItemId: string; typeId?: string; listId?: string }
  | { tool: "retype-items"; to: string; from?: string; listId?: string; /** Make this item type first, and use it as `to` (which is then ignored). */ newTypeName?: string }
  | { tool: "add-items"; listId: string; titles: string[]; attributes: Record<string, string> }
  | { tool: "collect-items"; filter: CollectFilter; dest: CollectDest }
  | { tool: "merge-lists"; listIds: string[]; /** The list that stays. Defaults to the one holding the most items. */ keepId?: string; /** An existing item type every merged item becomes. */ typeId?: string; /** Make this item type first, and use it (then `typeId` is ignored). */ newTypeName?: string }
  | { tool: "lookup-id"; what: LookupKind; words: string; /** Narrow lists to those in this folder. */ folderId?: string; /** Narrow items to this primary type. */ typeId?: string }

export type LookupKind = "list" | "item" | "folder" | "type"

/** One possible match for a lookup: a key the person can click to choose it. */
export interface Candidate {
  id: string
  label: string
  /** Small second line: the folder a list is in, the type of an item. */
  detail?: string
  /** The line sent when it is clicked. */
  text: string
  /** The line that opens this one's detail (items, folder, types) so it can be judged before it is picked. */
  peek?: string
  /** The "Other…" key: it opens a search by other words rather than naming one thing. */
  other?: boolean
}

/** Which existing items to gather. Every part given must hold; at least one is required. */
export interface CollectFilter {
  typeId?: string
  /** Items must be on all of these lists. */
  inListIds?: string[]
  /** Items must be on at least one of these lists. */
  inAnyListIds?: string[]
  /** Items must be on none of these lists. */
  notInListIds?: string[]
  due?: DueFilter
  /** Finished items are left out unless this is true. */
  includeDone?: boolean
}

/** Where they go: a list that exists, or a list to make (with its folder and item type, which may be made too). */
export type CollectDest =
  | { listId: string }
  | {
      newList: {
        name: string
        /** An existing folder to file it in. */
        folderId?: string
        /** A folder to make (named by the person), when none by that name exists. */
        newFolderName?: string
        /** An existing item type the list pins. */
        typeId?: string
        /** An item type to make, which the list pins. */
        newTypeName?: string
      }
    }

/** One item edit: the patch to write and the values it replaces, for undo. */
export interface ItemChange {
  id: string
  title: string
  patch: Record<string, unknown>
  before: Record<string, unknown>
  /** One short clause: what happens to this item. */
  note: string
}

/** A line of the impact table: "142 items · primary type Task → Book". */
export interface Impact {
  count: number
  label: string
}

export interface Plan {
  tool: ToolName
  title: string
  /** What will happen, in plain sentences. */
  summary: string[]
  impacts: Impact[]
  /** Up to eight item names, so the person can see real rows. */
  samples: string[]
  /** Things left alone on purpose, and why. */
  warnings: string[]
  /** Short label for the progress bar while a big plan is written: "Rewriting Book items". */
  working?: string
  /** How the tool got there, one line per stage, shown in the chat. */
  trace?: string[]
  /** True when this is not a standing rule: it runs once and new items are not affected. */
  oneTime: boolean
  changes: ItemChange[]
  merge?: ItemMergePlan
  creates?: Task[]
  /** A list, folder, or item type made first so the changes have somewhere to land. Undo takes them away again. */
  setup?: { list?: List; folder?: Folder; fileInFolderId?: string; type?: ItemTypeDefinition }
  /** Lists folded into another and taken away once their items have moved (`merge-lists` only). Undo puts them back. */
  dropLists?: { list: List; folderId?: string }[]
  /** Items touched in all (changes, discards, creates). Over `CONFIRM_COUNT_ABOVE` the person types the number. */
  total: number
  /** Stable text for the exact effect. Apply recomputes the plan and refuses if this differs. */
  signature: string
}

/** Above this many touched items, "yes" is not enough: the person types the count back. */
export const CONFIRM_COUNT_ABOVE = 25

export interface DupGroup {
  /** Sorted ids joined; the key a dismissal is remembered by. */
  key: string
  ids: string[]
  /** Why they look alike, short. */
  why: string
}

export type ToolResult =
  | { kind: "answer"; text: string; rows?: string[]; trace?: string[]; candidates?: Candidate[] }
  | { kind: "groups"; groups: DupGroup[]; scope: string }
  | { kind: "plan"; plan: Plan }
  | { kind: "error"; text: string }

/** The doors a plan is applied through. The browser binding is `port.ts`; tests pass a fake. */
export interface Port {
  world(): World
  now(): Date
  commit(id: string, patch: Record<string, unknown>): void
  /**
   * Many item edits as one write: one store update, one History save. Returns how many items were found and
   * changed. This is the door for any plan over a handful of items; `commit` one at a time re-saves the whole
   * store per item and freezes the window on a thousand.
   */
  commitMany(changes: { id: string; patch: Record<string, unknown> }[]): number
  /** Bulk replace, as the Lists merge does. Discards are tombstoned. */
  replaceTasks(next: Task[], tombstoneIds: string[]): void
  addItem(task: Task): void
  /** Make a list, a folder, or an item type, and file a list in a folder. Only `collect-items` calls these. */
  addList(list: List): void
  removeList(id: string): void
  addFolder(folder: Folder): void
  removeFolder(id: string): void
  fileList(folderId: string, listId: string): void
  addType(type: ItemTypeDefinition): void
  removeType(id: string): void
  removeItem(id: string): void
  untombstone(ids: string[]): void
  isDismissed(key: string): boolean
  dismiss(key: string): void
}

/** What undo needs: the old values of every edited item, the pre-merge rows, the ids made. */
export interface Undo {
  label: string
  patches: { id: string; before: Record<string, unknown> }[]
  /** Rows as they were before a merge: the survivor, the discards, and any item whose links were retargeted. */
  rows: Task[]
  created: string[]
  tombstoned: string[]
  /** What a plan made besides items. */
  made?: { listId?: string; folderId?: string; typeId?: string }
  /** Lists a merge took away, and the folder each was in. */
  removedLists?: { list: List; folderId?: string }[]
}
