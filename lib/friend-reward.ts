/**
 * lib/friend-reward.ts — Point grants when a friend mission is finished
 *
 * Goes through `points-store` so Home wells see it. Scale is personality
 * `rewardScale` (0–100). Trinkets / nest furniture stay later.
 */

import { pointsRuleValue } from "@/lib/points-rules-live"
import { usePointsStore } from "@/lib/points-store"

export function friendRewardPoints(rewardScale: number): number {
  const scale = Number.isFinite(rewardScale) ? rewardScale : 40
  const base = pointsRuleValue("friend.rewardBase")
  const divisor = pointsRuleValue("friend.rewardScaleDivisor")
  return Math.max(1, Math.round(base + Math.max(0, Math.min(100, scale)) / divisor))
}

export function grantFriendReward(ledgerId: string, points: number, title: string, date = new Date()): void {
  if (points <= 0) return
  usePointsStore.getState().addPoints(ledgerId, points, `Friend: ${title}`, date)
}
