import type { OpenTarget, OpenTargetAction } from "./types"

export function openTargetKey(target: Exclude<OpenTarget, null>): string {
  return target.type === "folder-all" ? target.folderId : target.id
}

export function openTargetReducer(_state: OpenTarget, action: OpenTargetAction): OpenTarget {
  switch (action.type) {
    case "CLOSE":
      return null
    case "OPEN_CATEGORY":
      return { type: "category", id: action.id }
    case "OPEN_SMART":
      return { type: "smart", id: action.id }
    case "OPEN_HABITS":
      return { type: "habits", id: action.id }
    case "OPEN_FOLDER_ALL":
      return { type: "folder-all", folderId: action.folderId }
    case "SET":
      return action.target
    default:
      return _state
  }
}

export function openTargetFromEntry(
  entry: { kind: string; id: string },
  ctx: { isAll: boolean; currentFolderId: string | null; rootAllFolderId: string },
): OpenTarget {
  if (entry.kind === "folder") return null
  if (entry.kind === "folder-all") {
    if (ctx.isAll || entry.id === "all-root") {
      return { type: "folder-all", folderId: ctx.rootAllFolderId }
    }
    if (ctx.currentFolderId) {
      return { type: "folder-all", folderId: ctx.currentFolderId }
    }
    return null
  }
  if (entry.kind === "list") return { type: "category", id: entry.id }
  if (entry.kind === "habits") {
    return { type: "habits", id: entry.id as "habits" | "weekly-habits" | "monthly-habits" }
  }
  return { type: "smart", id: entry.id as "daily" | "weekly" | "monthly" }
}
