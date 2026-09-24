import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  FRIEND_PIC_LS_PREFIX,
  friendPhotoUri,
  migratePhotoUriToVault,
  peekFriendPhoto,
  persistableFriendPhotoUri,
  putFriendPhoto,
} from "./friend-photo-vault"

const PNG = "data:image/png;base64,ZmFrZQ=="

describe("friend photo vault", () => {
  beforeEach(() => {
    resetLocalStorage()
  })

  it("writes bytes beside the gallery JSON and peeks them by friend: uri", async () => {
    const uri = await putFriendPhoto("lamb-1", PNG)
    expect(uri).toBe(friendPhotoUri("lamb-1"))
    expect(window.localStorage.getItem(`${FRIEND_PIC_LS_PREFIX}lamb-1`)).toBe(PNG)
    expect(peekFriendPhoto(uri)).toBe(PNG)
  })

  it("moves an inline data URL onto the vault without losing the picture", async () => {
    const next = persistableFriendPhotoUri("kit-1", PNG)
    expect(next).toBe(friendPhotoUri("kit-1"))
    expect(peekFriendPhoto(next)).toBe(PNG)
  })

  it("migrates a data URL gallery record into a friend: ref", async () => {
    const uri = await migratePhotoUriToVault("crow-1", PNG)
    expect(uri).toBe(friendPhotoUri("crow-1"))
    expect(peekFriendPhoto(uri)).toBe(PNG)
  })
})
