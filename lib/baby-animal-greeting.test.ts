import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  DISMISSED_FRIEND_PIN_KEY,
  WORN_FRIEND_PIN_KEY,
  clearReunionLine,
  consumeReunionLine,
  isPriorMonday,
  noteFriendAssignment,
  pickReunionLine,
  readDismissedFriendPin,
  readWornFriendPin,
  rememberDismissedFriends,
  writeWornFriendPin,
} from "./baby-animal-greeting"

describe("baby animal greeting", () => {
  beforeEach(() => {
    resetLocalStorage()
    clearReunionLine()
  })

  it("never greets the first meeting, and never greets a refresh of the same card", () => {
    const first = noteFriendAssignment({
      animalId: "bunny",
      displayName: "baby bunny",
      previousPhotoId: null,
      nextPhotoId: "p-bunny",
      history: [],
      greet: true,
    })
    expect(first.greeted).toBe(false)
    expect(consumeReunionLine()).toBeNull()
    expect(first.history[0]?.animalId).toBe("bunny")

    const refresh = noteFriendAssignment({
      animalId: "bunny",
      displayName: "baby bunny",
      previousPhotoId: "p-bunny",
      nextPhotoId: "p-bunny",
      history: first.history,
      greet: true,
    })
    expect(refresh.greeted).toBe(false)
    expect(consumeReunionLine()).toBeNull()
  })

  it("greets when a known friend is assigned again", () => {
    const history = [
      {
        animalId: "bunny",
        displayName: "baby bunny",
        firstSeenAt: "2026-09-14T00:00:00.000Z",
        lastAssignedAt: "2026-09-14T00:00:00.000Z",
      },
    ]
    const again = noteFriendAssignment({
      animalId: "bunny",
      displayName: "baby bunny",
      previousPhotoId: "p-fox",
      nextPhotoId: "p-bunny",
      history,
      greet: true,
      now: new Date("2026-09-21T12:00:00.000Z"),
    })
    expect(again.greeted).toBe(true)
    expect(consumeReunionLine()).toMatch(/Hi again|remember me|Look who it is|Miss me/)
  })

  it("can pin the worn friend and treat an empty week key as this week", () => {
    writeWornFriendPin({
      photoId: "p-bunny",
      animalId: "bunny",
      displayName: "baby bunny",
      weekKey: "2026-09-21",
    })
    expect(readWornFriendPin()?.photoId).toBe("p-bunny")
    expect(window.localStorage.getItem(WORN_FRIEND_PIN_KEY)).toMatch(/baby bunny/)
    expect(isPriorMonday("", "2026-09-21")).toBe(false)
    expect(isPriorMonday("2026-09-14", "2026-09-21")).toBe(true)
    expect(isPriorMonday("2026-09-21", "2026-09-21")).toBe(false)
  })

  it("unions dismissed ids and never drops an earlier removal", () => {
    expect(rememberDismissedFriends(["foal"])).toEqual(["foal"])
    expect(rememberDismissedFriends(["small-foal"])).toEqual(expect.arrayContaining(["foal", "small-foal"]))
    expect(readDismissedFriendPin()).toEqual(expect.arrayContaining(["foal", "small-foal"]))
    expect(window.localStorage.getItem(DISMISSED_FRIEND_PIN_KEY) || window.localStorage.getItem("cogs-friend-dismissed")).toMatch(
      /foal/,
    )
  })

  it("includes the name in some reunion lines", () => {
    expect(pickReunionLine("baby bunny", () => 0.99)).toMatch(/baby bunny|Hi again|remember me|Look who|Miss me/)
  })
})
