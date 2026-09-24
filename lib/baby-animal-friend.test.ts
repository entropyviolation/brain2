import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import { putAttachment } from "@/lib/attachments"
import { durablePhotoUri } from "./baby-animal-photos"
import { ensureWeeklyFriend, requestBabyAnimalFriend, rollBabyAnimalFriend, uploadFriendPicture } from "./baby-animal-friend"
import { useBabyAnimalsStore } from "./baby-animals-store"
import { FRIEND_PIC_LS_PREFIX, friendPhotoUri, peekFriendPhoto } from "./friend-photo-vault"

vi.mock("./baby-animal-photos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./baby-animal-photos")>()
  return {
    ...actual,
    storePhotoBytes: vi.fn(async (_blob: Blob, id: string) => friendPhotoUri(id)),
  }
})

function lamb() {
  return {
    id: "mine",
    animalId: "lamb",
    displayName: "Little Baby Lamb",
    query: "upload",
    sourceUrl: "https://cdn.example/lamb.jpg",
    via: "upload" as const,
    uri: "https://cdn.example/lamb.jpg",
    foundAt: "2026-09-21T00:00:00.000Z",
  }
}

const fetchSpy = vi.spyOn(globalThis, "fetch")

describe("baby animal friend persist", () => {
  beforeEach(() => {
    resetLocalStorage()
    useBabyAnimalsStore.getState().resetGallery()
    fetchSpy.mockClear()
  })

  it("keeps an uploaded cutout in the friend picture vault, not the store JSON", async () => {
    const file = new File([new Uint8Array([1, 2, 3])], "lamb.png", { type: "image/png" })
    const photo = await uploadFriendPicture(file)
    expect(photo.uri).toMatch(/^friend:/)
    expect(useBabyAnimalsStore.getState().photos[0]?.uri).toMatch(/^friend:/)
    expect(window.localStorage.getItem("cogs-baby-animals-store")).not.toMatch(/data:image\/png;base64/)
  })

  it("does not replace a stored friend with a fetch unless shuffle is forced", async () => {
    useBabyAnimalsStore.getState().importFriendPack()
    useBabyAnimalsStore.getState().addAndWear(lamb())
    const kept = await rollBabyAnimalFriend()
    expect(kept?.id).toBe("mine")
    expect(useBabyAnimalsStore.getState().currentPhotoId).toBe("mine")
    const shuffled = await rollBabyAnimalFriend({ force: true })
    expect(shuffled?.id).not.toBe("mine")
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("keeps the worn friend on refresh even when weekKey is empty (Monday race)", async () => {
    useBabyAnimalsStore.getState().addAndWear({
      ...lamb(),
      id: "bunny",
      animalId: "bunny",
      displayName: "baby bunny",
    })
    useBabyAnimalsStore.setState({ weekKey: "" })
    const kept = await ensureWeeklyFriend(new Date(2026, 8, 21))
    expect(kept?.displayName).toBe("baby bunny")
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(useBabyAnimalsStore.getState().displayName).toBe("baby bunny")
  })

  it("keeps the worn friend on refresh during the week and rolls on a new Monday", async () => {
    useBabyAnimalsStore.getState().importFriendPack()
    useBabyAnimalsStore.getState().addAndWear(lamb())
    useBabyAnimalsStore.getState().stampWeek("2026-09-21")
    const midweek = await ensureWeeklyFriend(new Date(2026, 8, 23))
    expect(midweek?.id).toBe("mine")
    expect(fetchSpy).not.toHaveBeenCalled()
    await ensureWeeklyFriend(new Date(2026, 8, 28))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(useBabyAnimalsStore.getState().photos.length).toBeGreaterThan(1)
  })

  it("names a preapproved card on request instead of fetching a new creature", async () => {
    const worn = await requestBabyAnimalFriend("Tiny Cute Striped Polecat")
    expect(worn.via).toBe("pack")
    expect(worn.displayName).toBe("Tiny Cute Striped Polecat")
    expect(worn.uri).toMatch(/^\/friend-pack\//)
    expect(useBabyAnimalsStore.getState().currentPhotoId).toBe(worn.id)
    expect(fetchSpy).not.toHaveBeenCalled()
    const again = await requestBabyAnimalFriend("tiny cute striped polecat")
    expect(again.id).toBe(worn.id)
    expect(useBabyAnimalsStore.getState().photos.filter((photo) => photo.displayName.trim())).toHaveLength(1)
  })

  it("seeds the pack and wears a preapproved card when the gallery is empty", async () => {
    const worn = await rollBabyAnimalFriend({ force: true })
    expect(worn?.via).toBe("pack")
    expect(useBabyAnimalsStore.getState().photos.length).toBeGreaterThan(1)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("does not fetch a new foal after that friend was deleted", async () => {
    useBabyAnimalsStore.getState().addAndWear({
      id: "foal-1",
      animalId: "foal",
      displayName: "small foal",
      query: "cute baby foal",
      sourceUrl: "https://cdn.example/foal.jpg",
      via: "openverse",
      uri: "https://cdn.example/foal.jpg",
      foundAt: "2026-09-21T00:00:00.000Z",
    })
    useBabyAnimalsStore.getState().removePhoto("foal-1")
    await ensureWeeklyFriend(new Date(2026, 8, 21))
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(useBabyAnimalsStore.getState().photos.every((photo) => photo.animalId !== "foal")).toBe(true)
  })
})

describe("durablePhotoUri", () => {
  it("turns an idb vault ref into a data URL", async () => {
    const uri = await putAttachment("baby_test", new Blob(["png"], { type: "image/png" }), {
      name: "x.png",
      mime: "image/png",
    })
    const durable = await durablePhotoUri(uri)
    expect(durable).toMatch(/^data:image\/png/)
  })
})

describe("peek after persistable upload mock", () => {
  it("can store a picture under the friend pic key", async () => {
    window.localStorage.setItem(`${FRIEND_PIC_LS_PREFIX}mine`, "data:image/png;base64,ZmFrZQ==")
    expect(peekFriendPhoto(friendPhotoUri("mine"))).toMatch(/^data:image/)
  })
})
