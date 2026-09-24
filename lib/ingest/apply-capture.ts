/**
 * lib/ingest/apply-capture.ts — Inbox / Quick Add via the existing capture pipeline
 */
import { parseSmartCapture } from "@/lib/smart-parse"
import { buildCapturedTask, ensureCaptureTarget, type CaptureMutators } from "@/lib/capture-target"
import { useTaskStore } from "@/lib/task-store"
import type { ApplyResult } from "./types"

export function taskStoreMutators(): CaptureMutators {
  const s = useTaskStore.getState()
  return {
    lists: s.lists,
    folders: s.folders,
    addList: s.addList,
    addFolder: s.addFolder,
    addListToFolder: s.addListToFolder,
    updateList: s.updateList,
    updateFolder: s.updateFolder,
  }
}

export function applyCapture(text: string, opts?: { sendToInbox?: boolean; now?: Date }): ApplyResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { status: "error", kind: "capture", reply: "Nothing to capture." }
  }

  const sendToInbox = opts?.sendToInbox ?? true
  const { suggestion } = parseSmartCapture(trimmed, { now: opts?.now })
  const target = ensureCaptureTarget(suggestion, taskStoreMutators)
  const task = buildCapturedTask({
    suggestion,
    fallbackText: trimmed,
    sendToInbox,
    target,
    folders: useTaskStore.getState().folders,
  })
  useTaskStore.getState().addTask(task)
  const title = task.description.trim() || trimmed
  const where = task.monkeyBrain ? "Monkey brain" : sendToInbox ? "Inbox" : target.list?.name ?? "All Items"
  return {
    status: "ok",
    kind: "capture",
    reply: `${where}: ${title}`,
    summary: `Captured “${title}” → ${where}`,
    itemIds: [task.id],
  }
}
