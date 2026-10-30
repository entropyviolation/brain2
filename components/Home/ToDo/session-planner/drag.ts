/**
 * Draft drag payloads: a line already in a tier, or a task or step from the pick list.
 */
import type { DragEvent } from "react"

/** Drag payloads in the draft: a line already in a tier, or a task or step from the pick list. */
const LINE_MIME = "application/x-b2-session-line"
const REF_MIME = "application/x-b2-session-ref"
const isSessionDrag = (e: DragEvent) => e.dataTransfer.types.includes(LINE_MIME) || e.dataTransfer.types.includes(REF_MIME)

export { LINE_MIME, REF_MIME, isSessionDrag }
