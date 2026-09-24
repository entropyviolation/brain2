import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { useBabyAnimalsStore } from "./baby-animals-store"
import type { BabyAnimalPhoto } from "./baby-animal-photos"

function photo(partial: Partial<BabyAnimalPhoto> = {}): BabyAnimalPhoto {
  return {
    id: "p1",
    animalId: "hedgehog",
    displayName: "Little Baby Hedgehog",
    query: "cute baby hedgehog",
    sourceUrl: "https://cdn.example/h.jpg",
    via: "openverse",
    uri: "https://cdn.example/h.jpg",
    foundAt: "2026-09-20T12:00:00.000Z",
    ...partial,
  }
}

describe("baby animals store", () => {
  beforeEach(() => {
    resetLocalStorage()
    useBabyAnimalsStore.getState().resetGallery()
  })

  it("keeps a shuffled photograph in the gallery and can wear / delete it", () => {
    const first = photo()
    useBabyAnimalsStore.getState().addAndWear(first)
    expect(useBabyAnimalsStore.getState().photos).toHaveLength(1)
    expect(useBabyAnimalsStore.getState().currentPhotoId).toBe("p1")

    const second = photo({
      id: "p2",
      animalId: "puppy",
      displayName: "cute small puppy",
      sourceUrl: "https://cdn.example/p.jpg",
      uri: "https://cdn.example/p.jpg",
    })
    useBabyAnimalsStore.getState().addAndWear(second)
    expect(useBabyAnimalsStore.getState().photos).toHaveLength(2)
    useBabyAnimalsStore.getState().wearPhoto("p1")
    expect(useBabyAnimalsStore.getState().displayName).toBe("Little Baby Hedgehog")

    useBabyAnimalsStore.getState().renamePhoto("p1", "tiny baby hedgehog")
    expect(useBabyAnimalsStore.getState().displayName).toBe("tiny baby hedgehog")

    useBabyAnimalsStore.getState().replacePhoto("p2", { uri: "idb:baby_bytes_p2", via: "upload" })
    expect(useBabyAnimalsStore.getState().photos.find((p) => p.id === "p2")?.uri).toBe("idb:baby_bytes_p2")
    expect(useBabyAnimalsStore.getState().photos.find((p) => p.id === "p2")?.displayName).toBe("cute small puppy")
    expect(useBabyAnimalsStore.getState().weekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const raw = window.localStorage.getItem("cogs-baby-animals-store")
    expect(raw).toMatch(/tiny baby hedgehog/)
    expect(raw).toMatch(/idb:baby_bytes_p2/)

    useBabyAnimalsStore.getState().removePhoto("p1")
    expect(useBabyAnimalsStore.getState().photos.map((p) => p.id)).toEqual(["p2"])
    expect(useBabyAnimalsStore.getState().currentPhotoId).toBe("p2")
  })

  it("keeps one card per creature and does not recreate a removed friend", () => {
    useBabyAnimalsStore.getState().addAndWear(photo())
    useBabyAnimalsStore.getState().addAndWear(
      photo({
        id: "p1-again",
        displayName: "tiny baby hedgehog",
        sourceUrl: "https://cdn.example/h2.jpg",
        uri: "https://cdn.example/h2.jpg",
      }),
    )
    expect(useBabyAnimalsStore.getState().photos).toHaveLength(1)
    expect(useBabyAnimalsStore.getState().photos[0]?.id).toBe("p1")
    expect(useBabyAnimalsStore.getState().displayName).toBe("tiny baby hedgehog")

    useBabyAnimalsStore.getState().removePhoto("p1")
    expect(useBabyAnimalsStore.getState().dismissedAnimalIds).toEqual(
      expect.arrayContaining(["hedgehog", "tiny-baby-hedgehog"]),
    )
    expect(useBabyAnimalsStore.getState().addAndWear(photo({ id: "p3" }))).toBeNull()
    expect(useBabyAnimalsStore.getState().photos).toHaveLength(0)
    expect(window.localStorage.getItem("cogs-friend-dismissed") || window.localStorage.getItem("brain2-friend-dismissed")).toMatch(
      /hedgehog/,
    )
  })

  it("dismisses catalog species tokens so Small Foal cannot roll back as foal", () => {
    useBabyAnimalsStore.getState().addAndWear(
      photo({
        id: "foal-1",
        animalId: "foal",
        displayName: "small foal",
        sourceUrl: "https://cdn.example/foal.jpg",
        uri: "https://cdn.example/foal.jpg",
      }),
    )
    useBabyAnimalsStore.getState().removePhoto("foal-1")
    expect(useBabyAnimalsStore.getState().dismissedAnimalIds).toEqual(expect.arrayContaining(["foal", "small-foal"]))
    expect(
      useBabyAnimalsStore.getState().addAndWear(
        photo({
          id: "foal-2",
          animalId: "foal",
          displayName: "Little Baby Foal",
          sourceUrl: "https://cdn.example/foal2.jpg",
          uri: "https://cdn.example/foal2.jpg",
        }),
      ),
    ).toBeNull()
    expect(useBabyAnimalsStore.getState().photos).toHaveLength(0)
  })

  it("records history and pins the worn friend", () => {
    useBabyAnimalsStore.getState().addAndWear(photo())
    expect(useBabyAnimalsStore.getState().friendHistory.map((row) => row.animalId)).toContain("hedgehog")
    expect(window.localStorage.getItem("cogs-friend-worn")).toMatch(/Little Baby Hedgehog/)
    useBabyAnimalsStore.getState().addAndWear(
      photo({
        id: "p-bunny",
        animalId: "bunny",
        displayName: "baby bunny",
        sourceUrl: "https://cdn.example/b.jpg",
        uri: "https://cdn.example/b.jpg",
      }),
    )
    useBabyAnimalsStore.getState().wearPhoto("p1")
    expect(useBabyAnimalsStore.getState().displayName).toBe("Little Baby Hedgehog")
    expect(window.localStorage.getItem("cogs-friend-worn")).toMatch(/p1/)
    const hedgehog = useBabyAnimalsStore.getState().friendHistory.find((row) => row.animalId === "hedgehog")
    expect(hedgehog?.wearCount).toBeGreaterThanOrEqual(2)
  })

  it("offers, declines, and rewards missions", () => {
    useBabyAnimalsStore.getState().addAndWear(photo())
    useBabyAnimalsStore.getState().offerMission({
      animalId: "hedgehog",
      displayName: "Little Baby Hedgehog",
      title: "Brush fur",
      line: "Tick Brush fur today.",
      blurb: "Habit",
      source: "habit",
      taskId: "habit:h1",
      kind: "mission",
      points: 5,
      effect: "whisper",
    })
    expect(useBabyAnimalsStore.getState().friendMissions[0]?.status).toBe("offered")
    useBabyAnimalsStore.getState().declineMission("habit:h1", "Already brushed")
    expect(useBabyAnimalsStore.getState().friendMissions[0]?.status).toBe("declined")
    expect(useBabyAnimalsStore.getState().friendMissions[0]?.declineReason).toBe("Already brushed")
    useBabyAnimalsStore.getState().offerMission({
      animalId: "hedgehog",
      displayName: "Little Baby Hedgehog",
      title: "Draw a picture",
      line: "Side quest: Draw a picture!",
      blurb: "Whim",
      source: "whim",
      taskId: "whim:doodle",
      kind: "whim",
      points: 5,
      effect: "heart",
    })
    expect(useBabyAnimalsStore.getState().completeMission("whim:doodle")).toBeNull()
    useBabyAnimalsStore.getState().acceptMission("whim:doodle")
    expect(useBabyAnimalsStore.getState().friendMissions[0]?.status).toBe("accepted")
    expect(useBabyAnimalsStore.getState().friendMissions[0]?.deadline).toBeTruthy()
    expect(useBabyAnimalsStore.getState().completeMission("whim:doodle")?.status).toBe("done")
    expect(useBabyAnimalsStore.getState().friendMissions[0]?.status).toBe("done")
  })

  it("imports unnamed pack pictures and keeps a user-given name", () => {
    useBabyAnimalsStore.getState().importFriendPack()
    const photos = useBabyAnimalsStore.getState().photos
    expect(photos.length).toBeGreaterThanOrEqual(71)
    expect(photos.every((row) => row.via === "pack" && row.displayName === "")).toBe(true)
    const id = photos[0]!.id
    useBabyAnimalsStore.getState().renamePhoto(id, "  Little Rock Hyrax  ")
    expect(useBabyAnimalsStore.getState().photos.find((row) => row.id === id)?.displayName).toBe("Little Rock Hyrax")
    useBabyAnimalsStore.getState().importFriendPack()
    expect(useBabyAnimalsStore.getState().photos.find((row) => row.id === id)?.displayName).toBe("Little Rock Hyrax")
    useBabyAnimalsStore.getState().renamePhoto(id, "   ")
    expect(useBabyAnimalsStore.getState().photos.find((row) => row.id === id)?.displayName).toBe("")
    useBabyAnimalsStore.getState().importFriendPack()
    expect(useBabyAnimalsStore.getState().photos.find((row) => row.id === id)?.displayName).toBe("")
  })

  it("does not mix names across pack cards or resurrect a deleted pack picture", () => {
    useBabyAnimalsStore.getState().importFriendPack()
    const [first, second] = useBabyAnimalsStore.getState().photos
    expect(first && second).toBeTruthy()
    useBabyAnimalsStore.getState().renamePhoto(first!.id, "Little Rock Hyrax")
    useBabyAnimalsStore.getState().renamePhoto(second!.id, "mouse")
    expect(useBabyAnimalsStore.getState().photos.find((row) => row.id === first!.id)?.displayName).toBe("Little Rock Hyrax")
    expect(useBabyAnimalsStore.getState().photos.find((row) => row.id === second!.id)?.displayName).toBe("mouse")

    useBabyAnimalsStore.getState().removePhoto(first!.id)
    expect(useBabyAnimalsStore.getState().photos.find((row) => row.id === first!.id)).toBeUndefined()
    expect(useBabyAnimalsStore.getState().photos.find((row) => row.id === second!.id)?.displayName).toBe("mouse")
    expect(useBabyAnimalsStore.getState().dismissedAnimalIds).toContain(first!.id)
    expect(useBabyAnimalsStore.getState().dismissedAnimalIds).not.toContain("mouse")

    useBabyAnimalsStore.getState().importFriendPack()
    expect(useBabyAnimalsStore.getState().photos.find((row) => row.id === first!.id)).toBeUndefined()
    expect(useBabyAnimalsStore.getState().photos.find((row) => row.id === second!.id)?.displayName).toBe("mouse")
  })
})
