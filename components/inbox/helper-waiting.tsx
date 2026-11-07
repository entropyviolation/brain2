/**
 * Notice in the Inbox: timeblocks BIM chat sent to the Tracking BIMBY that wait for Add.
 * Click it to leave the Inbox and open that chat. Gone once every block is added or dismissed.
 */
"use client"

import { openTrackingHelper } from "@/lib/tracking-helper/open"
import { awaitingFromBim, useTrackingHelper } from "@/lib/tracking-helper/store"

export function InboxHelperWaiting({ onGo }: { onGo: () => void }) {
  const n = useTrackingHelper((s) => awaitingFromBim(s.lines))
  if (!n) return null
  return (
    <button
      type="button"
      className="inbox-undo inbox-waiting"
      data-no95=""
      onClick={() => {
        onGo()
        openTrackingHelper()
      }}
    >
      <span>{n === 1 ? "Proposed timeblock awaiting approval" : `${n} proposed timeblocks awaiting approval`}</span>
      <span aria-hidden="true">Review →</span>
    </button>
  )
}
