/**
 * components/Home/Tracking/entry-dialog/types.ts — Props for the block editor
 *
 * Shared by the form and its sections. Not a public export: callers still
 * import only `EntryDialog` from `entry-dialog.tsx`.
 */
import type { TimeEntry } from "@/lib/time-tracking-store"

export interface EntryDialogProps {
  entry: TimeEntry
  onClose: () => void
  /** Extra DialogContent classes (e.g. Analytics `an-popup` for crisp titles). */
  contentClassName?: string
  /** Open another block in this same dialog (the "Next timeblock" link). */
  onOpenEntry?: (entry: TimeEntry) => void
}
