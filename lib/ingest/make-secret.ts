/**
 * lib/ingest/make-secret.ts — Right-click → Make secret on a BIM chat line, after the fact
 *
 * The line becomes one `\secret … \secret` span, so it hides wherever secrets are off (`docs/SECRETS.md`).
 * With it go the other side of the exchange (your line's reply, or the line of yours a reply answered) and the
 * Tracking log row the line was filed as that day ("Logged: …"). The words stay as written inside the marks.
 * **Planned:** other copies of the line (Inbox captures, the ingest log, Telegram's own history).
 */

import { revealSecretSpans, stripSecretSpans } from "@/lib/secrets"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatLocalDateKey } from "@/lib/date-utils"

/** The whole text as one secret span. A text that is already all secret is returned as it is. */
export function wholeSecret(text: string): string {
  if (!text.trim() || !stripSecretSpans(text).trim()) return text
  return `\\secret ${revealSecretSpans(text).trim()} \\secret`
}

const same = (a: string, b: string) => revealSecretSpans(a).trim().toLowerCase() === revealSecretSpans(b).trim().toLowerCase()

/** Wraps the title (and a note that repeats the words) of the log rows filed from `text` on the day of `at`. Returns how many. */
export function makeLoggedRowsSecret(text: string, at: string): number {
  const store = useTimeTrackingStore.getState()
  const date = formatLocalDateKey(new Date(at))
  const rows = store.entries.filter((e) => e.date === date && typeof e.title === "string" && same(e.title, text) && stripSecretSpans(e.title).trim())
  for (const e of rows) {
    store.updateEntry(e.id, { title: wholeSecret(e.title!), ...(e.notes && same(e.notes, text) ? { notes: wholeSecret(e.notes) } : {}) })
  }
  return rows.length
}
