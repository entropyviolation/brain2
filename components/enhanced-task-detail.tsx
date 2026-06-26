/**
 * components/enhanced-task-detail.tsx — Re-export barrel
 *
 * The full-screen task detail/editor now lives at
 * `components/ItemDetail/ItemDetailPage.tsx` as part of the consolidated
 * item-detail surface (docs/SPEC_MAPPING.md §5). This barrel preserves the
 * original import path. New code should import from
 * `@/components/ItemDetail/ItemDetailPage`.
 */
export { EnhancedTaskDetail } from "@/components/ItemDetail/ItemDetailPage"
