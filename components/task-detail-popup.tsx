/**
 * components/task-detail-popup.tsx — Re-export barrel
 *
 * The compact task detail popup now lives at `components/ItemDetail/ItemDetailPopup.tsx`
 * as part of the consolidated item-detail surface (docs/SPEC_MAPPING.md §5). This
 * barrel preserves the original import path. New code should import from
 * `@/components/ItemDetail/ItemDetailPopup`.
 */
export { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
