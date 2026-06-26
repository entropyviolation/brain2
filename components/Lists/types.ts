import type { AttributeDefinition } from "@/lib/types"

export type SmartId = "daily" | "weekly" | "monthly"

export type OpenTarget =
  | { type: "category"; id: string }
  | { type: "smart"; id: SmartId }
  | { type: "habits"; id: "habits" | "weekly-habits" | "monthly-habits" }
  | { type: "objectives" }
  | { type: "folder-all"; folderId: string }
  | null

export type OpenTargetState = Exclude<OpenTarget, null> | { mode: "closed" }

export type OpenTargetAction =
  | { type: "OPEN_CATEGORY"; id: string }
  | { type: "OPEN_SMART"; id: SmartId }
  | { type: "OPEN_HABITS"; id: "habits" | "weekly-habits" | "monthly-habits" }
  | { type: "OPEN_OBJECTIVES" }
  | { type: "OPEN_FOLDER_ALL"; folderId: string }
  | { type: "CLOSE" }
  | { type: "SET"; target: OpenTarget }

export type GridEntryKind = "folder" | "list" | "smart" | "habits" | "objectives" | "folder-all"

export interface GridEntry {
  kind: GridEntryKind
  id: string
  name: string
  color?: string
  icon?: string
  count: number
  sub?: string
}

export type IconPickerTarget = { kind: "category" | "folder" | "task"; id: string } | null

export interface CsvImportState {
  fileName: string
  headers: string[]
  rows: string[][]
  listName: string
  nameCol: number
  targetCategoryId: string
}

export type ListTemplateKey = "none" | "shopping" | "reading"

export interface ListTemplate {
  label: string
  attributes: AttributeDefinition[]
}
