import { describe, expect, it } from "vitest"
import { FRIEND_PACK } from "./friend-pack-manifest"
import {
  friendPackPhoto,
  mergeFriendPackPhotos,
  missingFriendPackPhotos,
  sortGalleryPhotos,
} from "./friend-pack"
import type { BabyAnimalPhoto } from "./baby-animal-photos"

describe("friend pack", () => {
  it("lists every processed animalsrcs picture", () => {
    expect(FRIEND_PACK).toHaveLength(71)
    expect(FRIEND_PACK.every((entry) => entry.id.startsWith("pack-") && entry.file.endsWith(".png"))).toBe(true)
    expect(FRIEND_PACK.filter((entry) => entry.knock)).toHaveLength(10)
  })

  it("merges missing pack cards without duplicating", () => {
    const first = friendPackPhoto(FRIEND_PACK[0]!)
    expect(first.displayName).toBe("")
    expect(first.via).toBe("pack")
    const once = mergeFriendPackPhotos([])
    expect(once).toHaveLength(71)
    expect(missingFriendPackPhotos(once)).toEqual([])
    expect(mergeFriendPackPhotos(once)).toBe(once)
    const named: BabyAnimalPhoto = { ...first, displayName: "Little Rock Hyrax" }
    const merged = mergeFriendPackPhotos([named])
    expect(merged[0]?.displayName).toBe("Little Rock Hyrax")
    expect(merged).toHaveLength(71)
    expect(mergeFriendPackPhotos([], { ids: [first.id], urls: [first.sourceUrl] })).toHaveLength(70)
  })

  it("sorts unnamed cards first", () => {
    const photos: BabyAnimalPhoto[] = [
      friendPackPhoto(FRIEND_PACK[1]!),
      { ...friendPackPhoto(FRIEND_PACK[0]!), displayName: "named" },
    ]
    expect(sortGalleryPhotos(photos).map((photo) => photo.displayName)).toEqual(["", "named"])
  })
})
