# `components/LiveSync/` — parked

Continuous phone ↔ desktop live sync is **deprecated for now**.

The host and CSS stay in the tree so a future **semi-mobile live sync**
component can reuse them. `LiveSyncHost` currently renders nothing, and
`lib/live-sync.ts` short-circuits (`LIVE_SYNC_DEPRECATED`) so the poll/push
engine cannot start.

We are finishing the rest of COGS first. When those surfaces are solid, live
sync will return as a dedicated semi-mobile component rather than an always-on
header chip.

Manual hub push/pull is unchanged: Settings → Mobile Sync, and
`components/Mobile/MobilePullCard.tsx`.
