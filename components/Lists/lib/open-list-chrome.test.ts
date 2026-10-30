import { describe, expect, it } from "vitest"
import type { Folder, List } from "@/lib/types"
import { resolveOpenListChrome } from "./open-list-chrome"

const createdAt = new Date("2026-06-01T12:00:00")

function list(partial: Partial<List> & Pick<List, "id" | "name">): List {
  return {
    color: "#336699",
    createdAt,
    scheduleable: false,
    ...partial,
  }
}

function folder(id: string): Folder {
  return { id, name: id, createdAt, listIds: [] }
}

function chrome(
  openTarget: Parameters<typeof resolveOpenListChrome>[0]["openTarget"],
  categories: List[] = [],
  extra: Partial<Parameters<typeof resolveOpenListChrome>[0]> = {},
) {
  return resolveOpenListChrome({
    openTarget,
    categories,
    itemTypes: [],
    currentFolder: null,
    listDisplay: {},
    ...extra,
  })
}

describe("open list chrome", () => {
  it("defaults photo and document lists onto their galleries, and falls back when a saved display is no longer offered", () => {
    const photos = list({ id: "photos", name: "Snaps", itemTypeIds: ["photo"] })
    const docs = list({ id: "docs", name: "Papers", itemTypeIds: ["document"] })
    const both = list({ id: "both", name: "Both", itemTypeIds: ["photo", "document"] })
    const plain = list({ id: "plain", name: "Notes", itemTypeIds: ["item"] })

    const photoChrome = chrome({ type: "category", id: "photos" }, [photos])
    expect(photoChrome.currentDisplay).toBe("gallery")
    expect(photoChrome.offeredDisplays).toContain("gallery")
    expect(photoChrome.offeredDisplays).not.toContain("documents")

    const savedChecklist = chrome({ type: "category", id: "photos" }, [photos], {
      listDisplay: { photos: "checklist" },
    })
    expect(savedChecklist.currentDisplay).toBe("checklist")

    const docChrome = chrome({ type: "category", id: "docs" }, [docs])
    expect(docChrome.currentDisplay).toBe("documents")
    expect(docChrome.offeredDisplays).toContain("documents")
    expect(docChrome.offeredDisplays).not.toContain("gallery")

    const staleGallery = chrome({ type: "category", id: "docs" }, [docs], {
      listDisplay: { docs: "gallery" },
    })
    expect(staleGallery.currentDisplay).toBe("default")

    expect(chrome({ type: "category", id: "both" }, [both]).currentDisplay).toBe("gallery")
    expect(chrome({ type: "category", id: "both" }, [both]).offeredDisplays).toEqual(
      expect.arrayContaining(["gallery", "documents"]),
    )

    const plainChrome = chrome({ type: "category", id: "plain" }, [plain])
    expect(plainChrome.currentDisplay).toBe("default")
    expect(plainChrome.offeredDisplays).toBeUndefined()

    const narrowed = list({ id: "narrow", name: "Narrow", enabledDisplays: ["checklist", "icons"] })
    expect(
      chrome({ type: "category", id: "narrow" }, [narrowed], { listDisplay: { narrow: "spreadsheet" } }).currentDisplay,
    ).toBe("checklist")

    const smart = chrome({ type: "smart", id: "daily" })
    expect(smart.currentDisplay).toBe("checklist")
    expect(smart.offeredDisplays).toBeUndefined()
    expect(smart.openName).toBe("Daily To Do List")

    expect(chrome({ type: "habits", id: "season-habits" }).openName).toBe("Season Habits")
    expect(chrome({ type: "habits", id: "season-habits" }).currentDisplay).toBe("default")

    const scheduled = chrome({ type: "folder-all", folderId: "na-sched-m-2026-08" }, [], {
      currentFolder: folder("na-sched-m-2026-08"),
    })
    expect(scheduled.openName).toBe("All Items")
    expect(scheduled.canEditFolderAllSettings).toBe(false)

    const editable = chrome({ type: "folder-all", folderId: "trips" }, [], {
      currentFolder: folder("trips"),
    })
    expect(editable.canEditFolderAllSettings).toBe(true)
  })
})
