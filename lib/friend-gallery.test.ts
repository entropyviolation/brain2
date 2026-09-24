import { describe, expect, it } from "vitest"
import type { BabyAnimalPhoto } from "./baby-animal-photos"
import { friendPackPhoto, mergeFriendPackPhotos } from "./friend-pack"
import { FRIEND_PACK } from "./friend-pack-manifest"
import {
  friendIdentityKeys,
  friendIsDismissed,
  photoDismissKeys,
  photoIsDismissed,
  reconcileFriendPhotos,
  seedFriendPackIfFresh,
  scrubFalseCatalogDismissals,
} from "./friend-gallery"

function card(partial: Partial<BabyAnimalPhoto>): BabyAnimalPhoto {
  return {
    id: "pack-aaa",
    animalId: "pack-aaa",
    displayName: "",
    query: "friend-pack",
    sourceUrl: "/friend-pack/a.png",
    via: "pack",
    uri: "/friend-pack/a.png",
    foundAt: "2026-09-21T12:00:00.000Z",
    ...partial,
  }
}

describe("friend gallery identity", () => {
  it("does not treat a pack name as a catalog species", () => {
    const named = card({ displayName: "sweet hopping little bunny" })
    expect(photoDismissKeys(named)).toEqual(expect.arrayContaining(["pack-aaa", "/friend-pack/a.png"]))
    expect(photoDismissKeys(named)).not.toContain("bunny")
    expect(friendIsDismissed(["bunny"], "pack-aaa", named.displayName, named)).toBe(false)
    expect(friendIdentityKeys("pack-aaa", named.displayName)).toEqual(["pack-aaa"])
  })

  it("keeps names on the card id when two snapshots merge", () => {
    const a = card({ id: "pack-a", animalId: "pack-a", displayName: "Little Rock Hyrax", sourceUrl: "/friend-pack/a.png" })
    const b = card({ id: "pack-b", animalId: "pack-b", displayName: "mouse", sourceUrl: "/friend-pack/b.png" })
    const hubA = { ...a, displayName: "" }
    const hubB = { ...b, displayName: "Little Rock Hyrax" }
    const merged = reconcileFriendPhotos([a, b], [hubA, hubB])
    expect(merged.find((row) => row.id === "pack-a")?.displayName).toBe("Little Rock Hyrax")
    expect(merged.find((row) => row.id === "pack-b")?.displayName).toBe("mouse")
  })

  it("does not resurrect a deleted pack card from a later pack merge", () => {
    const first = friendPackPhoto(FRIEND_PACK[0]!)
    const rest = mergeFriendPackPhotos([], { ids: [first.id], urls: [first.sourceUrl] })
    expect(rest.find((row) => row.id === first.id)).toBeUndefined()
    expect(rest).toHaveLength(70)
    expect(seedFriendPackIfFresh([], [first.id], [first.sourceUrl])).toEqual([])
    expect(photoIsDismissed(first, [first.id], [])).toBe(true)
  })

  it("does not keep a catalog species dismissed while that card is still in the gallery", () => {
    const fox = card({
      id: "fox-1",
      animalId: "fox",
      via: "openverse",
      displayName: "tiny baby fox kit",
      sourceUrl: "https://cdn.example/fox.jpg",
    })
    const packBunny = card({
      id: "pack-named",
      animalId: "pack-named",
      displayName: "sweet hopping little bunny",
      sourceUrl: "/friend-pack/n.png",
    })
    const bunny = card({
      id: "bunny-1",
      animalId: "bunny",
      via: "openverse",
      displayName: "baby bunny",
      sourceUrl: "https://cdn.example/bunny.jpg",
    })
    expect(scrubFalseCatalogDismissals([fox], ["fox", "pack-named"])).toEqual(["fox", "pack-named"])
    expect(scrubFalseCatalogDismissals([bunny, packBunny], ["bunny", "pack-named"])).toEqual(["pack-named"])
  })
})
