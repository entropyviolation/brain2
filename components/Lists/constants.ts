import type { AttributeDefinition } from "@/lib/types"
import type { ListTemplate, SmartId } from "./types"

export const ROOT_ALL_FOLDER_ID = "__root__"

/** Stable id for the virtual Objectives list (backed by goals-store). */
export const OBJECTIVES_LIST_ID = "objectives"

/** Stable default positions so icons don't jump when entries are added/removed. */
export const PRESET_ICON_POSITIONS: Record<string, { x: number; y: number }> = {
  "habits-habits": { x: 16, y: 16 },
  "habits-weekly-habits": { x: 104, y: 16 },
  "habits-monthly-habits": { x: 192, y: 16 },
  "smart-daily": { x: 16, y: 112 },
  "smart-weekly": { x: 104, y: 112 },
  "smart-monthly": { x: 192, y: 112 },
  "folder-all-all-root": { x: 16, y: 16 },
  "objectives-objectives": { x: 280, y: 16 },
}

export const LIST_TEMPLATES: Record<string, ListTemplate> = {
  none: { label: "Plain list", attributes: [] },
  shopping: {
    label: "Shopping",
    attributes: [
      { id: "price_est", name: "Est. price", type: "number", unit: "$", allowFloat: true },
      { id: "price_actual", name: "Actual price", type: "number", unit: "$", allowFloat: true },
      { id: "store", name: "Store / location", type: "string" },
      { id: "channel", name: "Online or in-person", type: "selection", options: ["Online", "In person"] },
    ] as AttributeDefinition[],
  },
  reading: {
    label: "Reading",
    attributes: [
      { id: "author", name: "Author", type: "string" },
      { id: "description", name: "Description", type: "string" },
      { id: "link", name: "Link", type: "link" },
      { id: "pages", name: "Pages", type: "number", allowFloat: false },
    ] as AttributeDefinition[],
  },
}

export const SMART_LISTS: { id: SmartId; name: string; color: string }[] = [
  { id: "daily", name: "Daily To Do List", color: "#16a34a" },
  { id: "weekly", name: "Weekly To Do List", color: "#2563eb" },
  { id: "monthly", name: "Monthly To Do List", color: "#9333ea" },
]
