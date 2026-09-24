/**
 * lib/details-columns.ts — Details-table column choice (per list)
 *
 * Reuses the shared attribute catalog in `spreadsheet-catalog.ts` so Details
 * and Spreadsheet offer the same attributes (on-this-list first, then vault,
 * plus built-ins). Persistence is separate: `List.detailsColumns`, never
 * `List.sheetConfig.columnIds`.
 *
 * Hiding a Details column does not delete the attribute and does not change
 * spreadsheet columns.
 */
import { composeListAttributes } from "@/lib/item-types"
import {
  builtinColumnId,
  isBuiltinColumnId,
  type SheetColumnCandidate,
} from "@/lib/spreadsheet-catalog"
import { NAME_COLUMN_ID } from "@/lib/spreadsheet-contract"
import type { ItemTypeDefinition, List } from "@/lib/types"

export { filterCatalog, hideColumnId, insertColumnId, moveColumnId } from "@/lib/spreadsheet-catalog"

export interface ResolveDetailsOpts {
  /** Next Actions lists currently append Urgency / Importance / Scheduled. */
  nextActions?: boolean
}

/**
 * Default Details extras when `detailsColumns` is unset: schema attributes in
 * `displayedAttributes` order (or declaration order), then Next Actions
 * built-ins if this list is a Next Actions list.
 */
export function defaultDetailsColumnIds(
  candidates: SheetColumnCandidate[],
  list?: List,
  types: ItemTypeDefinition[] = [],
  opts: ResolveDetailsOpts = {},
): string[] {
  const ids: string[] = []
  const seen = new Set<string>()
  const known = new Set(candidates.map((c) => c.id))
  const push = (id: string) => {
    if (!id || seen.has(id) || id === NAME_COLUMN_ID) return
    seen.add(id)
    ids.push(id)
  }

  if (list) {
    const schema = composeListAttributes(list, types)
    const schemaIds = new Set(schema.map((d) => d.id))
    const displayed = list.displayedAttributes
    const ordered =
      displayed && displayed.length > 0
        ? displayed.filter((id) => schemaIds.has(id) || known.has(id))
        : schema.map((d) => d.id)
    for (const id of ordered) push(id)
  }

  if (opts.nextActions) {
    push(builtinColumnId("urgency"))
    push(builtinColumnId("importance"))
    push(builtinColumnId("scheduledDate"))
  }

  return ids
}

/**
 * Resolve persisted Details columns. `undefined` → default. `[]` → no extras
 * (Name / complete / Actions chrome still show). Spreadsheet `columnIds` is
 * never read.
 */
export function resolveDetailsColumnIds(
  detailsColumns: string[] | undefined,
  candidates: SheetColumnCandidate[],
  list?: List,
  types: ItemTypeDefinition[] = [],
  opts: ResolveDetailsOpts = {},
): string[] {
  if (detailsColumns !== undefined) {
    const known = new Set(candidates.map((c) => c.id))
    return detailsColumns.filter((id) => id !== NAME_COLUMN_ID && (known.has(id) || isBuiltinColumnId(id)))
  }
  return defaultDetailsColumnIds(candidates, list, types, opts)
}
