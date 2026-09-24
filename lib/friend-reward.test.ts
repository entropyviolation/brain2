import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { friendRewardPoints, grantFriendReward } from "./friend-reward"
import { usePointsStore } from "./points-store"

describe("friend reward", () => {
  beforeEach(() => {
    resetLocalStorage()
    usePointsStore.setState({ pointsHistory: [] })
  })

  it("scales points from personality rewardScale", () => {
    expect(friendRewardPoints(0)).toBe(2)
    expect(friendRewardPoints(40)).toBeGreaterThan(friendRewardPoints(0))
    expect(friendRewardPoints(100)).toBeGreaterThan(friendRewardPoints(40))
  })

  it("writes through the points store", () => {
    grantFriendReward("friend-mission:x", 5, "Draw a picture")
    expect(usePointsStore.getState().pointsHistory.some((row) => row.points === 5 && row.taskDescription.includes("Draw"))).toBe(true)
  })
})
