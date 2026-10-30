"use client"
import { clarifyInboxItems } from "@/lib/inbox-batch"
import type { ItemWriteAttribution } from "@/lib/item-write-source"
import type { Task } from "@/lib/types"

export function InboxClarifyKey({
  task,
  getDraft,
  commitDraft,
}: {
  task: Task
  getDraft: () => Task | null
  commitDraft: (next: Task, attribution?: ItemWriteAttribution) => Task
}) {
  if (task.completed || task.stage !== "inbox") return null
  return (
    <button
      type="button"
      className="id-clarify-key"
      title="Save and take this out of the inbox"
      onClick={() => {
        const draft = getDraft()
        if (!draft) return
        const [next] = clarifyInboxItems([draft], [draft.id])
        if (next) commitDraft(next)
      }}
    >
      Clarify
    </button>
  )
}
