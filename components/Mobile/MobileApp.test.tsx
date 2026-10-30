/**
 * components/Mobile/MobileApp.test.tsx — Manual hub pull onto the phone.
 *
 * The shell's login gate is stubbed. The pull button is the real card:
 * a mocked hub response is restored through lib/mobile-sync.
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { persistKey } from "@/lib/storage-keys"
import { TASK_STORE_PERSIST_VERSION, useTaskStore } from "@/lib/task-store"
import { resetAllStores } from "@/tests/test-utils"

const HUB_TASK_ID = "hub-desk-task"

const hubBackup = {
  app: "brain2",
  version: 1,
  exportedAt: "2026-10-27T19:00:00.000Z",
  stores: {
    [persistKey("task-storage")]: {
      state: {
        tasks: [
          {
            id: HUB_TASK_ID,
            description: "Pulled from the desktop hub",
            title: "Pulled from the desktop hub",
            stage: "inbox",
            createdAt: "2026-10-27T19:00:00.000Z",
            completed: false,
            lists: [],
          },
        ],
        lists: [],
        folders: [],
        removedTaskIds: [],
        removedListIds: [],
      },
      version: TASK_STORE_PERSIST_VERSION,
    },
  },
  planText: {},
}

vi.mock("@/lib/mobile-auth", () => ({
  readMobileSession: () => ({ username: "admin", loggedInAt: "2026-10-27T19:00:00.000Z" }),
  clearMobileSession: () => {},
}))

vi.mock("@/components/Home/home-dashboard", () => ({ HomeDashboard: () => <div>Home</div> }))
vi.mock("@/components/Reviews/reviews", () => ({ Reviews: () => null }))
vi.mock("@/components/inbox", () => ({ Inbox: () => null }))
vi.mock("@/components/enhanced-bulk-add", () => ({ EnhancedBulkAdd: () => null }))
vi.mock("@/components/quick-add", () => ({ QuickAdd: () => null }))
vi.mock("@/components/quick-add-wrote", () => ({ QuickAddWroteHost: () => null }))
vi.mock("@/components/notes-ingest", () => ({ NotesIngest: () => null }))
vi.mock("@/components/iphone-notes-store", () => ({ IphoneNotesStore: () => null }))
vi.mock("@/components/ItemDetail/ItemDetailPopup", () => ({ TaskDetailPopup: () => null }))
vi.mock("@/components/Mobile/location/MobileLocationCard", () => ({ MobileLocationCard: () => null }))
vi.mock("@/components/Mobile/nfc/MobileNfcCard", () => ({ MobileNfcCard: () => null }))
vi.mock("@/components/PersistStatusBanner", () => ({ PersistStatusBanner: () => null }))

import { MobileApp } from "./MobileApp"

describe("MobileApp pull", () => {
  beforeEach(() => {
    resetAllStores()
    useTaskStore.getState().clearAllData()
    vi.stubGlobal("location", {
      protocol: "http:",
      hostname: "127.0.0.1",
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      href: "http://127.0.0.1:3000/mobile/",
      pathname: "/mobile/",
      search: "",
      hash: "",
      reload: vi.fn(),
      assign: vi.fn(),
      replace: vi.fn(),
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith("/api/sync/status")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              ok: true,
              hasData: true,
              updatedAt: "2026-10-27T19:00:00.000Z",
              exportedAt: "2026-10-27T19:00:00.000Z",
            }),
          }
        }
        if (url.endsWith("/api/sync/pull")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({ ok: true, backup: hubBackup, updatedAt: "2026-10-27T19:00:00.000Z" }),
          }
        }
        return { ok: false, status: 404, statusText: "Not Found", json: async () => ({ error: url }) }
      }),
    )
    vi.spyOn(window, "confirm").mockReturnValue(true)
  })

  it("pulls a desktop snapshot into the task store", async () => {
    render(<MobileApp />)
    const pull = await screen.findByRole("button", { name: "Pull desktop data onto phone" })
    await waitFor(() => expect(pull).toBeEnabled())

    fireEvent.click(pull)

    await waitFor(() => {
      expect(useTaskStore.getState().tasks.some((task) => task.id === HUB_TASK_ID)).toBe(true)
    })
    expect(useTaskStore.getState().tasks.find((task) => task.id === HUB_TASK_ID)?.description).toBe(
      "Pulled from the desktop hub",
    )
  })
})
