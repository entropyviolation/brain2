/**
 * lib/module-list-import.test.ts — Tidy / Trip → Module Lists mapping
 *
 * Fixture is modeled on the user's Whole-house Tidy sample: Kitchen chores with
 * estimates, actuals, and done rows; a Living Room parent with subtasks;
 * duplicate titles; a dresser parent with 0/2-style children.
 */
import { beforeEach, describe, expect, it } from "vitest"
import type { Folder, List, Task } from "@/lib/types"
import type { ModuleInstance } from "@/lib/modules-store"
import type { HouseCleaningState, HouseTask, Importance } from "@/lib/house-cleaning"
import { blankHouseCleaning } from "@/lib/house-cleaning"
import {
  MODULE_LISTS_FOLDER_ID,
  addModuleCreatedLists,
  moduleChildFolderId,
  type ModuleListsMutators,
} from "@/lib/module-lists"
import {
  MODULE_SOURCE_TIDY,
  actualMinutesFromSec,
  mergeImportedItem,
  moduleImportAreaListId,
  moduleImportNeededItemId,
  moduleImportRootListId,
  moduleImportTidyItemId,
  planModuleLists,
  rollupFromItems,
  subtaskProgress,
  syncModuleListContents,
  type ModuleListImportMutators,
} from "@/lib/module-list-import"
import { instantiateModuleTemplate } from "@/lib/module-templates"
import { useTaskStore } from "@/lib/task-store"
import { useModulesStore } from "@/lib/modules-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import type { TripItineraryData } from "@/lib/trip-itinerary"

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

function chore(
  partial: Partial<HouseTask> & Pick<HouseTask, "id" | "areaId" | "title" | "importance">,
): HouseTask {
  return {
    parentId: null,
    estMin: 0,
    actualSec: 0,
    done: false,
    collapsed: false,
    createdAt: 1,
    ...partial,
  }
}

/** Kitchen + Living Room parent/subtasks + Bedroom dresser, plus duplicate titles. */
function sampleTidyHouse(): HouseCleaningState {
  const s = blankHouseCleaning()
  s.areas = [
    { id: "kitchen", name: "Kitchen" },
    { id: "living", name: "Living Room" },
    { id: "bedroom", name: "Bedroom" },
  ]
  s.tasks = [
    chore({ id: "k-trash", areaId: "kitchen", title: "TAKE OUT TRASH", importance: "crucial" }),
    chore({
      id: "k-dishes",
      areaId: "kitchen",
      title: "Do dishes",
      importance: "crucial",
      estMin: 15,
    }),
    chore({
      id: "k-pots",
      areaId: "kitchen",
      title: "Sort/ clean out stinky pots, pans, tupperware cabinet",
      importance: "crucial",
      estMin: 45,
    }),
    chore({
      id: "k-counters",
      areaId: "kitchen",
      title: "Clear counters",
      importance: "important",
      estMin: 10,
    }),
    chore({
      id: "k-away",
      areaId: "kitchen",
      title: "Put existing dishes away",
      importance: "important",
      estMin: 10,
      actualSec: 3 * 60 + 51,
      done: true,
      completedAt: 1_700_000_000_000,
    }),
    chore({
      id: "k-fridge",
      areaId: "kitchen",
      title: "sort/clean out fridge",
      importance: "important",
      estMin: 30,
      actualSec: 5 * 60 + 52,
      done: true,
      completedAt: 1_700_000_100_000,
    }),
    chore({
      id: "k-music-1",
      areaId: "kitchen",
      title: "organize music area",
      importance: "optional",
    }),
    chore({
      id: "k-music-2",
      areaId: "kitchen",
      title: "organize music area",
      importance: "optional",
    }),
    chore({
      id: "lr-giveaway",
      areaId: "living",
      title: "Get rid of jenny/elijah giveaway clothes.",
      importance: "crucial",
      estMin: 15,
    }),
    chore({
      id: "lr-bags",
      areaId: "living",
      parentId: "lr-giveaway",
      title: "move bags...",
      importance: "crucial" as Importance,
    }),
    chore({
      id: "lr-heavy",
      areaId: "living",
      parentId: "lr-giveaway",
      title: "figure out heavy thing",
      importance: "crucial",
    }),
    chore({
      id: "lr-rug",
      areaId: "living",
      parentId: "lr-giveaway",
      title: "clear rug area",
      importance: "crucial",
      estMin: 10,
      actualSec: 3 * 60 + 9,
      done: true,
      completedAt: 1_700_000_200_000,
    }),
    chore({
      id: "br-dresser",
      areaId: "bedroom",
      title: "clear elijah dresser top",
      importance: "crucial",
      estMin: 15,
      actualSec: 28,
    }),
    chore({
      id: "br-off",
      areaId: "bedroom",
      parentId: "br-dresser",
      title: "get stuff off",
      importance: "important",
      estMin: 5,
      actualSec: 28,
      done: true,
      completedAt: 1_700_000_300_000,
    }),
    chore({
      id: "br-sort",
      areaId: "bedroom",
      parentId: "br-dresser",
      title: "sort stuff",
      importance: "important",
      estMin: 10,
    }),
  ]
  s.needed = [{ id: "bags", areaId: "kitchen", text: "more trash bags", got: false, createdAt: 1 }]
  return s
}

function sampleTrip(): TripItineraryData {
  return {
    startDate: "2026-07-10",
    endDate: "2026-07-11",
    days: [
      {
        date: "2026-07-10",
        cityMode: "city",
        city: "Lima, Peru",
        dayNote: "First night",
        sleepName: "Hotel B",
        sleepAddress: "Barranco",
        schedule: [
          { id: "breakfast", kind: "plan", time: "09:00", text: "Breakfast in Barranco" },
          {
            id: "la4090",
            kind: "flight",
            time: "14:30",
            text: "LA 4090 LIM → CUZ",
            flight: { flightNumber: "LA4090", title: "LA 4090 LIM → CUZ", detail: "2h 10m" },
          },
        ],
      },
    ],
  }
}

function memoryMut(): ModuleListImportMutators & ModuleListsMutators & { lists: List[]; folders: Folder[]; tasks: Task[] } {
  const lists: List[] = []
  const folders: Folder[] = []
  const tasks: Task[] = []
  return {
    lists,
    folders,
    tasks,
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
    upsertImportedItem: (item) => {
      const i = tasks.findIndex((t) => t.id === item.id)
      if (i < 0) tasks.push(item)
      else tasks[i] = item
    },
    deleteImportedItem: (id) => {
      const i = tasks.findIndex((t) => t.id === id)
      if (i >= 0) tasks.splice(i, 1)
    },
  }
}

describe("Tidy → Module Lists mapping", () => {
  const module = workspace("mod-tidy", "Tidy", { config: { houseCleaning: sampleTidyHouse() } })
  const plan = planModuleLists(module)
  const kitchenId = moduleImportAreaListId("mod-tidy", "kitchen")
  const livingId = moduleImportAreaListId("mod-tidy", "living")
  const bedroomId = moduleImportAreaListId("mod-tidy", "bedroom")
  const houseId = moduleImportRootListId("mod-tidy", MODULE_SOURCE_TIDY)

  it("nests areas as sublists of Whole house, not a flat dump", () => {
    const house = plan.lists.find((l) => l.id === houseId)
    const kitchen = plan.lists.find((l) => l.id === kitchenId)
    const living = plan.lists.find((l) => l.id === livingId)
    expect(house?.name).toBe("Whole house")
    expect(kitchen?.name).toBe("Kitchen")
    expect(kitchen?.parentListId).toBe(houseId)
    expect(living?.parentListId).toBe(houseId)
    expect(plan.lists.find((l) => l.name === "General")?.parentListId).toBe(houseId)
  })

  it("keeps full untruncated titles, including duplicate names as separate items", () => {
    const pots = plan.items.find((t) => t.id === moduleImportTidyItemId("mod-tidy", "k-pots"))
    expect(pots?.title).toBe("Sort/ clean out stinky pots, pans, tupperware cabinet")
    const dupes = plan.items.filter((t) => t.title === "organize music area")
    expect(dupes).toHaveLength(2)
    expect(dupes[0].id).not.toBe(dupes[1].id)
  })

  it("maps Crucial/Important/Optional onto Lists importance 5/4/2 and tidyImportance", () => {
    const dishes = plan.items.find((t) => t.id === moduleImportTidyItemId("mod-tidy", "k-dishes"))!
    const counters = plan.items.find((t) => t.id === moduleImportTidyItemId("mod-tidy", "k-counters"))!
    const music = plan.items.find((t) => t.id === moduleImportTidyItemId("mod-tidy", "k-music-1"))!
    expect(dishes.importance).toBe(5)
    expect(dishes.attributes?.tidyImportance).toBe("Crucial")
    expect(counters.importance).toBe(4)
    expect(counters.attributes?.tidyImportance).toBe("Important")
    expect(music.importance).toBe(2)
    expect(music.attributes?.tidyImportance).toBe("Optional")
  })

  it("ports estimates, actual seconds (3:51), and completed rows", () => {
    const dishes = plan.items.find((t) => t.id === moduleImportTidyItemId("mod-tidy", "k-dishes"))!
    const away = plan.items.find((t) => t.id === moduleImportTidyItemId("mod-tidy", "k-away"))!
    expect(dishes.estimatedDuration).toBe(15)
    expect(dishes.completed).toBe(false)
    expect(away.completed).toBe(true)
    expect(away.status).toBe("done")
    expect(away.estimatedDuration).toBe(10)
    expect(away.actualDuration).toBe(actualMinutesFromSec(3 * 60 + 51))
    expect(away.attributes?.actualSec).toBe(231)
    expect(away.completedDate).toEqual(new Date(1_700_000_000_000))
    expect(plan.items.filter((t) => t.lists?.includes(kitchenId) && t.completed)).toHaveLength(2)
  })

  it("nests Living Room subtasks via parentTaskId and reports 1/3 progress", () => {
    const parentId = moduleImportTidyItemId("mod-tidy", "lr-giveaway")
    const parent = plan.items.find((t) => t.id === parentId)!
    const kids = plan.items.filter((t) => t.parentTaskId === parentId)
    expect(parent.title).toBe("Get rid of jenny/elijah giveaway clothes.")
    expect(parent.lists).toEqual([livingId])
    expect(kids.map((k) => k.title).sort()).toEqual(["clear rug area", "figure out heavy thing", "move bags..."])
    expect(kids.every((k) => k.lists?.[0] === livingId)).toBe(true)
    expect(subtaskProgress(plan.items, parentId)).toEqual({ done: 1, total: 3 })
    const rug = kids.find((k) => k.title === "clear rug area")!
    expect(rug.completed).toBe(true)
    expect(rug.actualDuration).toBe(actualMinutesFromSec(3 * 60 + 9))
  })

  it("keeps dresser children as 1/2 (done + open) with parent actual seconds", () => {
    const parentId = moduleImportTidyItemId("mod-tidy", "br-dresser")
    expect(subtaskProgress(plan.items, parentId)).toEqual({ done: 1, total: 2 })
    const parent = plan.items.find((t) => t.id === parentId)!
    expect(parent.lists).toEqual([bedroomId])
    expect(parent.actualDuration).toBe(actualMinutesFromSec(28))
    expect(parent.completed).toBe(false)
  })

  it("computes Kitchen rollup from leaves (done imported, est on open only)", () => {
    const kitchenItems = plan.items.filter((t) => t.lists?.includes(kitchenId))
    const rollup = rollupFromItems(kitchenItems)
    expect(rollup.done).toBe(2)
    expect(rollup.open).toBe(6)
    expect(rollup.estMin).toBe(15 + 45 + 10)
  })

  it("imports Needed supplies as their own list", () => {
    const needed = plan.items.find((t) => t.id === moduleImportNeededItemId("mod-tidy", "bags"))!
    expect(needed.title).toBe("more trash bags")
    expect(needed.completed).toBe(false)
    expect(plan.lists.some((l) => l.name === "Needed")).toBe(true)
  })
})

describe("Tidy import sync", () => {
  it("files lists under Module Lists / Tidy Lists and is idempotent", () => {
    const mut = memoryMut()
    const module = workspace("mod-tidy", "Tidy", { config: { houseCleaning: sampleTidyHouse() } })
    syncModuleListContents(mut, [module])
    const count = mut.tasks.length
    const listCount = mut.lists.length
    expect(mut.folders.some((f) => f.id === MODULE_LISTS_FOLDER_ID)).toBe(true)
    expect(mut.folders.find((f) => f.id === moduleChildFolderId("mod-tidy"))?.listIds.length).toBeGreaterThan(0)
    syncModuleListContents(mut, [module])
    expect(mut.tasks.length).toBe(count)
    expect(mut.lists.length).toBe(listCount)
  })

  it("updates in place and preserves user notes + extra list membership", () => {
    const mut = memoryMut()
    const house = sampleTidyHouse()
    const module = workspace("mod-tidy", "Tidy", { config: { houseCleaning: house } })
    syncModuleListContents(mut, [module])
    const dishesId = moduleImportTidyItemId("mod-tidy", "k-dishes")
    const dishes = mut.tasks.find((t) => t.id === dishesId)!
    mut.upsertImportedItem({
      ...dishes,
      notes: "use the good sponge",
      lists: [...(dishes.lists ?? []), "user-errands"],
      tags: [...(dishes.tags ?? []), "weekend"],
    })
    const nextHouse: HouseCleaningState = {
      ...house,
      tasks: house.tasks.map((t) => (t.id === "k-dishes" ? { ...t, title: "Do ALL the dishes", estMin: 20 } : t)),
    }
    syncModuleListContents(mut, [{ ...module, config: { houseCleaning: nextHouse } }])
    const updated = mut.tasks.find((t) => t.id === dishesId)!
    expect(updated.title).toBe("Do ALL the dishes")
    expect(updated.estimatedDuration).toBe(20)
    expect(updated.notes).toBe("use the good sponge")
    expect(updated.lists).toContain("user-errands")
    expect(updated.tags).toContain("weekend")
  })

  it("does not duplicate forever when addModuleCreatedLists already ran", () => {
    const mut = memoryMut()
    const module = workspace("mod-tidy", "Tidy", { config: { houseCleaning: sampleTidyHouse() } })
    const plan = planModuleLists(module)
    addModuleCreatedLists(mut, module, plan.lists)
    syncModuleListContents(mut, [module])
    syncModuleListContents(mut, [module])
    expect(mut.lists.filter((l) => l.name === "Kitchen")).toHaveLength(1)
    expect(mut.tasks.filter((t) => t.title === "Do dishes")).toHaveLength(1)
  })
})

describe("mergeImportedItem", () => {
  it("keeps user notes when the mapped row has none", () => {
    const mapped = planModuleLists(workspace("m", "Tidy", { config: { houseCleaning: sampleTidyHouse() } })).items[0]
    const merged = mergeImportedItem({ ...mapped, notes: "mine" }, { ...mapped, title: "renamed" })
    expect(merged.notes).toBe("mine")
    expect(merged.title).toBe("renamed")
  })
})

describe("Trip itinerary → Module Lists", () => {
  it("nests days under Itinerary and ports timed plans + flights", () => {
    const module = workspace("mod-trip", "Portugal 2026", { config: { tripItinerary: sampleTrip() } })
    const plan = planModuleLists(module)
    const root = plan.lists.find((l) => l.name === "Itinerary")
    const day = plan.lists.find((l) => l.name.startsWith("2026-07-10"))
    expect(root).toBeTruthy()
    expect(day?.parentListId).toBe(root?.id)
    expect(day?.name).toContain("Lima")
    const breakfast = plan.items.find((t) => t.title === "Breakfast in Barranco")!
    expect(breakfast.scheduledTime).toBe("09:00")
    expect(breakfast.lists).toEqual([day!.id])
    const flight = plan.items.find((t) => t.title.includes("LA 4090"))!
    expect(flight.type).toBe("flight")
    expect(flight.attributes?.flightNumber).toBe("LA4090")
    expect(plan.items.some((t) => t.title === "Hotel B")).toBe(true)
  })
})

describe("instantiateModuleTemplate house-cleaning", () => {
  beforeEach(() => {
    localStorage.clear()
    useTaskStore.getState().clearAllData()
    useModulesStore.setState({ modules: [] })
    useWorkflowsStore.setState({ workflows: [] })
  })

  it("projects seed Tidy chores into Whole house area lists", () => {
    const id = instantiateModuleTemplate("house-cleaning")
    const { lists, tasks, folders } = useTaskStore.getState()
    expect(folders.some((f) => f.id === MODULE_LISTS_FOLDER_ID)).toBe(true)
    expect(lists.some((l) => l.name === "Whole house" && l.createdByModuleId === id)).toBe(true)
    expect(lists.some((l) => l.name === "Kitchen" && l.parentListId === moduleImportRootListId(id, MODULE_SOURCE_TIDY))).toBe(
      true,
    )
    expect(tasks.some((t) => t.title === "Do dishes")).toBe(true)
    const dishes = tasks.find((t) => t.title === "Do dishes")!
    expect(dishes.importance).toBe(5)
    expect(dishes.estimatedDuration).toBe(15)
    expect(dishes.completed).toBe(false)
  })
})
