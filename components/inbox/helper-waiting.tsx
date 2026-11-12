/**
 * Notices in the Inbox: what BIM chat sent to a BIMBY that still waits for approval. Timeblocks wait
 * for Add in the Tracking BIMBY; habit changes wait for Accept in the Habits BIMBY. Click one to leave
 * the Inbox and open that chat. Gone once everything is decided.
 */
"use client"

import { openHabitsBimby } from "@/lib/habit-helper/open"
import { awaitingFromBim as habitsAwaiting, useHabitsBimby } from "@/lib/habit-helper/store"
import { openTrackingHelper } from "@/lib/tracking-helper/open"
import { awaitingFromBim, useTrackingHelper } from "@/lib/tracking-helper/store"

export function InboxHelperWaiting({ onGo }: { onGo: () => void }) {
  const blocks = useTrackingHelper((s) => awaitingFromBim(s.lines))
  const habits = useHabitsBimby((s) => habitsAwaiting(s.lines))
  const rows = [
    { n: blocks, text: blocks === 1 ? "Proposed timeblock awaiting approval" : `${blocks} proposed timeblocks awaiting approval`, go: openTrackingHelper },
    { n: habits, text: habits === 1 ? "Proposed habit change awaiting approval" : `${habits} proposed habit changes awaiting approval`, go: openHabitsBimby },
  ].filter((r) => r.n)
  if (!rows.length) return null
  return (
    <>
      {rows.map((r) => (
        <button
          key={r.text}
          type="button"
          className="inbox-undo inbox-waiting"
          data-no95=""
          onClick={() => {
            onGo()
            r.go()
          }}
        >
          <span>{r.text}</span>
          <span aria-hidden="true">Review →</span>
        </button>
      ))}
    </>
  )
}
