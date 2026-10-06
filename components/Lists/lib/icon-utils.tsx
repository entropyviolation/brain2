/**
 * @deprecated Import from `@/components/Icons` instead.
 * Kept as a thin barrel so existing imports keep working unchanged.
 * `entryIconSrc` lives here as the shared Lists grid/list icon resolver.
 */
import { orbFor, iconFor, folderFor } from "@/components/Icons/Icon"
import type { GridEntry } from "@/components/Lists/types"

export { orbFor, iconFor, folderFor, FolderGlyph } from "@/components/Icons/Icon"

/** Resolve the img src for a folder/list/smart grid entry (Icons + List views). */
export function entryIconSrc(entry: GridEntry): string {
  if (entry.kind === "folder" || entry.kind === "folder-all") {
    return entry.icon || folderFor(entry.id)
  }
  if (entry.kind === "smart" || entry.kind === "habits" || entry.kind === "objectives") {
    return orbFor(entry.id)
  }
  return iconFor(entry.id, entry.icon)
}
