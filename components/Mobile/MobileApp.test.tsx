/**
 * components/Mobile/MobileApp.test.tsx — The phone shell reads the Mac file.
 *
 * The shell's login gate is stubbed. Refresh loads `GET /api/persist?canon=1`
 * into memory. It does not restore `/api/sync` into localStorage.
 */
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { TASK_STORE_PERSIST_VERSION, useTaskStore } from "@/lib/task-store"
import { resetPhoneWindowForTests } from "@/lib/phone-window"
import { resetAllStores } from "@/tests/test-utils"

const HUB_TASK_ID = "hub-desk-task"

const hubTask = {
  state: {
    tasks: [
      {
        id: HUB_TASK_ID,
        description: "Pulled from the desktop hub",
        title: "Pulled from the desktop hub",
        notes: "the long note",
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

describe("MobileApp window", () => {
  beforeEach(() => {
    resetPhoneWindowForTests()
    resetAllStores()
    useTaskStore.getState().clearAllData()
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", language: "en-US" })
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
        if (url.includes("/api/persist")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              ok: true,
              items: { "brain2-task-storage": JSON.stringify(hubTask) },
            }),
          }
        }
        return { ok: false, status: 404, statusText: "Not Found", json: async () => ({ error: url }) }
      }),
    )
  })

  it("loads the Mac file into memory after login", async () => {
    render(<MobileApp />)
    expect(await screen.findByRole("button", { name: "Refresh from Mac" })).toBeEnabled()

    await waitFor(() => {
      expect(useTaskStore.getState().tasks.some((task) => task.id === HUB_TASK_ID)).toBe(true)
    })
    const task = useTaskStore.getState().tasks.find((row) => row.id === HUB_TASK_ID)
    expect(task?.description).toBe("Pulled from the desktop hub")
    expect(task?.notes).toBe("the long note")
    expect(localStorage.getItem("brain2-task-storage")).not.toContain("the long note")
  })

  it("loads the Mac file from the baked LAN hub on the native shell", async () => {
    vi.stubGlobal("location", {
      protocol: "capacitor:",
      hostname: "localhost",
      host: "localhost",
      origin: "capacitor://localhost",
      href: "capacitor://localhost/mobile/",
      pathname: "/mobile/",
      search: "",
      hash: "",
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes("mobile-hub.json")) {
          return { ok: true, status: 200, statusText: "OK", json: async () => ({ url: "http://192.168.0.150:3000" }) }
        }
        if (url.startsWith("http://192.168.0.150:3000/api/persist")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({
              ok: true,
              items: { "brain2-task-storage": JSON.stringify(hubTask) },
            }),
          }
        }
        return { ok: false, status: 404, statusText: "Not Found", json: async () => ({ error: url }) }
      }),
    )

    render(<MobileApp />)
    await waitFor(() => {
      expect(useTaskStore.getState().tasks.some((task) => task.id === HUB_TASK_ID)).toBe(true)
    })
    expect(useTaskStore.getState().tasks.find((row) => row.id === HUB_TASK_ID)?.notes).toBe("the long note")
  })
})
