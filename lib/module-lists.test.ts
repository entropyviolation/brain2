import { beforeEach, describe, expect, it } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import type { ModuleInstance } from "@/lib/modules-store"
import {
  MODULE_LISTS_FOLDER_ID,
  MODULE_LISTS_FOLDER_NAME,
  addModuleCreatedLists,
  filterTasksHiddenFromGlobalAll,
  isFolderHiddenFromGlobalAll,
  isListHiddenFromGlobalAll,
  listIdsUsedByModule,
  moduleChildFolderId,
  moduleChildFolderName,
  placeListsForModule,
  syncModuleListFolders,
  type ModuleListsMutators,
} from "./module-lists"
import { instantiateModuleTemplate } from "./module-templates"
import { useTaskStore } from "./task-store"
import { useModulesStore } from "./modules-store"
import { useWorkflowsStore } from "./workflows-store"
import { buildGridEntries } from "./lists-grid-entries"

function list(id: string, name: string, extra: Partial<List> = {}): List {
  return { id, name, color: "#3B82F6", createdAt: new Date(), ...extra }
}

function folder(partial: Partial<Folder> & Pick<Folder, "id" | "name">): Folder {
  return { createdAt: new Date(), listIds: [], ...partial }
}

function task(id: string, lists: string[]): Task {
  return {
    id,
    description: id,
    stage: "list",
    completed: false,
    createdAt: new Date(),
    lists,
    urgency: 1,
    importance: 1,
  }
}

function workspace(id: string, title: string, extra: Partial<ModuleInstance> = {}): ModuleInstance {
  return {
    id,
    type: "workspace",
    kind: "workspace",
    title,
    config: {},
    views: [],
    ...extra,
  }
}

function memoryMut(): ModuleListsMutators & { lists: List[]; folders: Folder[] } {
  const lists: List[] = []
  const folders: Folder[] = []
  return {
    lists,
    folders,
    addList: (c) => {
      if (!lists.some((x) => x.id === c.id)) lists.push(c)
    },
    updateList: (c) => {
      const i = lists.findIndex((x) => x.id === c.id)
      if (i >= 0) lists[i] = c
    },
    addFolder: (f) => {
      if (!folders.some((x) => x.id === f.id)) folders.push(f)
    },
    updateFolder: (f) => {
      const i = folders.findIndex((x) => x.id === f.id)
      if (i >= 0) folders[i] = f
    },
    addListToFolder: (folderId, categoryId) => {
      const i = folders.findIndex((x) => x.id === folderId)
      if (i < 0) return
      if (folders[i].listIds.includes(categoryId)) return
      folders[i] = { ...folders[i], listIds: [...folders[i].listIds, categoryId] }
    },
    removeListFromFolder: (folderId, categoryId) => {
      const i = folders.findIndex((x) => x.id === folderId)
      if (i < 0) return
      folders[i] = { ...folders[i], listIds: folders[i].listIds.filter((id) => id !== categoryId) }
    },
  }
}

describe("module-lists helpers", () => {
  it("names the child folder {ModuleName} Lists", () => {
    expect(moduleChildFolderName("Itinerary Creator")).toBe("Itinerary Creator Lists")
    expect(moduleChildFolderName("  ")).toBe("Untitled Lists")
  })

  it("collects list ids from views, cards, and config", () => {
    const ids = listIdsUsedByModule(
      workspace("m1", "Budget", {
        config: { placesCategoryId: "places" },
        planSync: { categoryId: "plan", dateAttrId: "day" },
        views: [
          { id: "v1", title: "Sheet", kind: "spreadsheet", config: { categoryId: "accounts" } },
          {
            id: "v2",
            title: "Dash",
            kind: "dashboard",
            config: {
              cards: [
                { id: "c1", label: "Net", categoryId: "assets", attrId: "bal", subtract: { categoryId: "debts", attrId: "bal" } },
              ],
            },
          },
        ],
      }),
    )
    expect(ids.sort()).toEqual(["accounts", "assets", "debts", "places", "plan"])
  })

  it("creates Module Lists / {name} Lists and files module-created lists there", () => {
    const mut = memoryMut()
    const packing = list("pack", "Packing")
    mut.addList(packing)
    const module = workspace("mod-1", "Itinerary Creator")
    addModuleCreatedLists(mut, module, [packing])

    expect(mut.folders.some((f) => f.id === MODULE_LISTS_FOLDER_ID && f.name === MODULE_LISTS_FOLDER_NAME)).toBe(true)
    const child = mut.folders.find((f) => f.id === moduleChildFolderId("mod-1"))
    expect(child?.name).toBe("Itinerary Creator Lists")
    expect(child?.parentFolderId).toBe(MODULE_LISTS_FOLDER_ID)
    expect(child?.listIds).toContain("pack")
    expect(mut.lists.find((c) => c.id === "pack")?.createdByModuleId).toBe("mod-1")
  })

  it("does not move a list the user already filed outside Module Lists", () => {
    const mut = memoryMut()
    mut.addList(list("reading", "Reading List"))
    mut.addFolder(folder({ id: "user-work", name: "Work", listIds: ["reading"] }))
    const module = workspace("mod-2", "Book Tasting", {
      views: [{ id: "v", title: "Books", kind: "spreadsheet", config: { categoryId: "reading" } }],
    })
    placeListsForModule(mut, module, ["reading"])
    expect(mut.folders.find((f) => f.id === "user-work")?.listIds).toContain("reading")
    const child = mut.folders.find((f) => f.id === moduleChildFolderId("mod-2"))
    expect(child?.listIds ?? []).not.toContain("reading")
  })

  it("hides Module Lists folders and their lists from Global All by default", () => {
    const mut = memoryMut()
    mut.addList(list("pack", "Packing"))
    mut.addList(list("errands", "Errands"))
    addModuleCreatedLists(mut, workspace("mod-1", "Trip"), [mut.lists[0]])

    const root = mut.folders.find((f) => f.id === MODULE_LISTS_FOLDER_ID)!
    const child = mut.folders.find((f) => f.id === moduleChildFolderId("mod-1"))!
    expect(isFolderHiddenFromGlobalAll(root, mut.folders)).toBe(true)
    expect(isFolderHiddenFromGlobalAll(child, mut.folders)).toBe(true)
    expect(isListHiddenFromGlobalAll(mut.lists.find((c) => c.id === "pack")!, mut.folders)).toBe(true)
    expect(isListHiddenFromGlobalAll(mut.lists.find((c) => c.id === "errands")!, mut.folders)).toBe(false)
  })

  it("allows an explicit Show in All override", () => {
    const mut = memoryMut()
    mut.addList(list("pack", "Packing"))
    addModuleCreatedLists(mut, workspace("mod-1", "Trip"), [mut.lists[0]])
    const shown = { ...mut.lists[0], hiddenFromGlobalAll: false }
    expect(isListHiddenFromGlobalAll(shown, mut.folders)).toBe(false)
    const child = mut.folders.find((f) => f.id === moduleChildFolderId("mod-1"))!
    expect(isFolderHiddenFromGlobalAll({ ...child, hiddenFromGlobalAll: false }, mut.folders)).toBe(false)
  })

  it("hides All Items that only belong to module lists, keeps mixed-membership items", () => {
    const mut = memoryMut()
    mut.addList(list("pack", "Packing"))
    mut.addList(list("errands", "Errands"))
    addModuleCreatedLists(mut, workspace("mod-1", "Trip"), [mut.lists.find((c) => c.id === "pack")!])
    const items = [
      task("only-mod", ["pack"]),
      task("user", ["errands"]),
      task("both", ["pack", "errands"]),
      task("loose", []),
    ]
    expect(filterTasksHiddenFromGlobalAll(items, mut.lists, mut.folders).map((t) => t.id)).toEqual([
      "user",
      "both",
      "loose",
    ])
  })

  it("syncs existing unfiled lists referenced by a workspace", () => {
    const mut = memoryMut()
    mut.addList(list("films", "Films"))
    const module = workspace("mod-film", "Film DNA Lab", {
      views: [{ id: "v", title: "Films", kind: "spreadsheet", config: { categoryId: "films" } }],
    })
    syncModuleListFolders(mut, [module])
    const child = mut.folders.find((f) => f.id === moduleChildFolderId("mod-film"))
    expect(child?.listIds).toContain("films")
    expect(mut.lists.find((c) => c.id === "films")?.createdByModuleId).toBe("mod-film")
  })

  it("renames the child folder when the module title changes", () => {
    const mut = memoryMut()
    const module = workspace("mod-1", "Trip")
    syncModuleListFolders(mut, [module])
    syncModuleListFolders(mut, [{ ...module, title: "Portugal 2026" }])
    expect(mut.folders.find((f) => f.id === moduleChildFolderId("mod-1"))?.name).toBe("Portugal 2026 Lists")
  })
})

describe("Global All grid hides the Module Lists tree", () => {
  it("omits the Module Lists folder and its lists from All, keeps user lists", () => {
    const folders = [
      folder({ id: MODULE_LISTS_FOLDER_ID, name: MODULE_LISTS_FOLDER_NAME }),
      folder({
        id: moduleChildFolderId("mod-1"),
        name: "Trip Lists",
        parentFolderId: MODULE_LISTS_FOLDER_ID,
        listIds: ["pack"],
      }),
      folder({ id: "user", name: "Work" }),
    ]
    const categories = [list("pack", "Packing", { createdByModuleId: "mod-1" }), list("errands", "Errands")]
    const entries = buildGridEntries({
      isHome: false,
      isAll: true,
      currentFolder: null,
      folders,
      categories,
      homePinned: [],
      showSmartLists: false,
      allTasks: [task("a", ["pack"]), task("b", ["errands"])],
      getSmartTasks: () => [],
      getTasksForCategory: (id) => (id === "pack" ? [task("a", ["pack"])] : [task("b", ["errands"])]),
      countForFolder: () => 0,
    })
    const ids = entries.map((e) => e.id)
    expect(ids).not.toContain(MODULE_LISTS_FOLDER_ID)
    expect(ids).not.toContain(moduleChildFolderId("mod-1"))
    expect(ids).not.toContain("pack")
    expect(ids).toContain("errands")
    expect(ids).toContain("user")
  })
})

describe("instantiateModuleTemplate files lists under Module Lists", () => {
  beforeEach(() => {
    localStorage.clear()
    useTaskStore.getState().clearAllData()
    useModulesStore.setState({ modules: [] })
    useWorkflowsStore.setState({ workflows: [] })
  })

  it("places template lists in {ModuleName} Lists and stamps createdByModuleId", () => {
    const id = instantiateModuleTemplate("blank")
    const { lists, folders } = useTaskStore.getState()
    const child = folders.find((f) => f.id === moduleChildFolderId(id))
    expect(folders.some((f) => f.id === MODULE_LISTS_FOLDER_ID)).toBe(true)
    expect(child?.name).toBe("New Workspace Lists")
    expect(lists.length).toBeGreaterThan(0)
    expect(lists.every((c) => c.createdByModuleId === id)).toBe(true)
    expect(child?.listIds.length).toBe(lists.length)
  })
})
