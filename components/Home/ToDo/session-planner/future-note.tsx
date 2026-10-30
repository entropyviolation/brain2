/**
 * The optional note to later-you, as a field and as a banner.
 */
import type { FutureNote } from "@/lib/session-plan"

/** The one optional line for the next sitting (FN-1). */
function FutureNoteInput({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return (
    <input
      className="todo-session-futurenote-input"
      value={value}
      aria-label="Note to you later"
      placeholder="Note to you later (optional)"
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

function FutureNoteBanner({ note }: { note?: FutureNote }) {
  if (!note) return null
  const when = new Date(note.at).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })
  return (
    <p className="todo-session-futurenote" role="note">
      <b>From {when}:</b> {note.text}
    </p>
  )
}

export { FutureNoteInput, FutureNoteBanner }
