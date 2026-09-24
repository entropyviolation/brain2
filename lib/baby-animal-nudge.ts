/**
 * lib/baby-animal-nudge.ts — Adapter: nest click → friend suggestion
 *
 * Picks from daily habits, today's To Do, and Next Actions using the worn
 * friend's personality. Click again skips the last id. Escape / close dismisses.
 * Flavor, missions, and rewards: `docs/FRIEND_COMPANION.md`.
 */
import { pickFriendSuggestion, type FriendSuggestion, type FriendSuggestionContext } from "@/lib/friend-suggestion"
import type { Folder, Task } from "@/lib/types"

export type FriendNudge = FriendSuggestion

export { EMPTY_FRIEND_NUDGE } from "@/lib/friend-copy"
export { openFriendNextActions } from "@/lib/friend-suggestion"

export function pickFriendTodoNudge(
  tasks: Task[],
  folders: Folder[],
  lastTaskId: string | null = null,
  rng: () => number = Math.random,
  ctx: FriendSuggestionContext = {},
): FriendNudge {
  return pickFriendSuggestion(tasks, folders, lastTaskId, rng, ctx)
}
