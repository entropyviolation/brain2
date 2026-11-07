/**
 * app/lab/inbox-bimby/page.tsx — Try the Inbox BIMBY on an idea
 *
 * A standalone route, like `/lab/swarm-vote`. See `lib/inbox-bimby/types.ts`.
 */
"use client"

import { InboxBimbyLab } from "@/components/Lab/InboxBimby/InboxBimbyLab"

export default function Page() {
  return <InboxBimbyLab />
}
