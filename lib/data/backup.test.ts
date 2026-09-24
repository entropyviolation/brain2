import { describe, it, expect, beforeEach, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import {
  createBackup,
  createFullBackup,
  serializeBackup,
  parseBackup,
  restoreBackup,
  previewBackup,
  mergePersistPayload,
  recoveryBackupInfoFromJson,
  isSafeRecoveryBackupName,
  listRecoveryBackups,
  backupSchema,
  BACKUP_VERSION,
  BACKUP_STORES,
  backupFingerprint,
  buildCategoryExport,
  exportCategory,
  parseCategoryExport,
  importCategory,
} from "@/lib/data/backup"
import { attachmentUri, getAttachment, putAttachment } from "@/lib/attachments"
import { useMetricsStore } from "@/lib/metrics-store"
import { useRegretStore } from "@/lib/regret-store"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { taskRepository } from "@/lib/data/task-repository"
import { parseAppendLog, parseAppendLogDraft, serializeAppendLog } from "@/lib/append-log"
import { getPlanEntries, getStoredPlanText, saveStoredPlanText } from "@/lib/plan-text"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { useTaskStore } from "@/lib/task-store"
import type { Task, List } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...overrides,
})

const cat = (overrides: Partial<List> & { id: string }): List => ({
  name: overrides.id,
  color: "#000000",
  createdAt: new Date(),
  ...overrides,
})

describe("backup/restore", () => {
  beforeEach(() => resetAllStores())

  it("captures task-store state and plan text", () => {
    taskRepository.add(task({ id: "a", description: "backed up" }))
    saveStoredPlanText("day", "2026-06-20", "do the thing")

    const backup = createBackup()
    expect(backup.app).toBe("brain2")
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(backup.dataProfile).toBe("live")
    expect(backup.stores["brain2-task-storage"]).toBeDefined()
    expect(JSON.parse(backup.planText["dayPlan-2026-06-20"]).entries[0].text).toBe("do the thing")
  })

  it("round-trips a backup through serialize/parse", () => {
    taskRepository.add(task({ id: "a" }))
    const json = serializeBackup()
    const parsed = parseBackup(json)
    expect(backupSchema.safeParse(parsed).success).toBe(true)
  })

  it("restores tasks and plan text after data is wiped", async () => {
    taskRepository.add(task({ id: "a", description: "original" }))
    saveStoredPlanText("week", "2026-W25", "weekly plan")
    const backup = parseBackup(serializeBackup())

    resetAllStores()
    expect(taskRepository.getById("a")).toBeUndefined()
    expect(getStoredPlanText("week", "2026-W25")).toBeNull()

    const result = await restoreBackup(backup)
    expect(result.stores).toBeGreaterThan(0)
    expect(result.planText).toBeGreaterThanOrEqual(1)

    const restored = useTaskStore.getState().tasks.find((t) => t.id === "a")
    expect(restored?.description).toBe("original")
    // Restore round-trips exactly what the store persists (same as a reload).
    expect(restored?.createdAt).toBeDefined()
    expect(getPlanEntries("week", "2026-W25").map((e) => e.text)).toEqual(["weekly plan"])
  })

  it("rejects a malformed backup", () => {
    expect(() => parseBackup(JSON.stringify({ nope: true }))).toThrow()
  })

  it("refuses to restore a Demo snapshot onto Live", async () => {
    const backup = parseBackup(serializeBackup())
    backup.dataProfile = "demo"
    await expect(restoreBackup(backup)).rejects.toThrow(/Demo profile/)
  })

  it("replaces plan text on restore (no stale entries)", async () => {
    const backup = parseBackup(serializeBackup())
    saveStoredPlanText("day", "2026-06-21", "stale entry")
    await restoreBackup(backup)
    expect(getStoredPlanText("day", "2026-06-21")).toBeNull()
  })

  it("includes metrics and regret stores in a full backup", () => {
    expect(BACKUP_STORES.map((s) => s.key)).toEqual(
      expect.arrayContaining([
        "brain2-metrics-store",
        "regret-store",
        "brain2-ingest-store",
        "brain2-baby-animals-store",
        "brain2-screentime-prefs",
      ]),
    )
    useMetricsStore.getState().addDatapoint({ values: { joy: 41 } })
    useRegretStore.getState().addRegret("t1", 3, "slipped")
    const backup = createBackup()
    expect(backup.stores["brain2-metrics-store"]).toBeDefined()
    expect(backup.stores["regret-store"]).toBeDefined()
  })

  it("round-trips attachment bytes through createFullBackup", async () => {
    await putAttachment("file_rt", new Blob(["secret-bytes"], { type: "text/plain" }), {
      name: "s.txt",
      mime: "text/plain",
    })
    taskRepository.add(
      task({
        id: "with-file",
        attributes: {
          file: { id: "file_rt", name: "s.txt", mime: "text/plain", uri: attachmentUri("file_rt") },
        },
      }),
    )
    const backup = await createFullBackup()
    expect(backup.attachments?.file_rt?.name).toBe("s.txt")
    const before = backupFingerprint(backup)

    resetAllStores()
    await restoreBackup(backup)

    const after = backupFingerprint(await createFullBackup())
    expect(after.attachments).toEqual(before.attachments)
    expect(await (await getAttachment(attachmentUri("file_rt")))?.blob.text()).toBe("secret-bytes")
    expect(useTaskStore.getState().tasks.find((t) => t.id === "with-file")?.attributes?.file).toMatchObject({
      id: "file_rt",
      uri: attachmentUri("file_rt"),
    })
  })

  it("surfaces quota errors on restore instead of failing silently", async () => {
    const backup = parseBackup(serializeBackup())
    const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    })
    await expect(restoreBackup(backup)).rejects.toThrow(/Restore failed/)
    spy.mockRestore()
  })

  it("previews which registered stores a backup contains", () => {
    taskRepository.add(task({ id: "a", description: "listed" }))
    saveStoredPlanText("day", "2026-06-20", "notes")
    const preview = previewBackup(createBackup())
    expect(preview.stores.find((s) => s.key === "brain2-task-storage")?.present).toBe(true)
    expect(preview.stores.find((s) => s.key === "brain2-task-storage")?.label).toBe("Lists & items")
    expect(preview.planText.present).toBe(true)
    expect(preview.planText.keys).toBeGreaterThanOrEqual(1)
  })

  it("replace of chosen stores leaves other live stores alone", async () => {
    taskRepository.add(task({ id: "keep-me", description: "original task" }))
    const metricId = useMetricsStore.getState().addDatapoint({ values: { joy: 10 } })
    const backup = parseBackup(serializeBackup())

    taskRepository.update(task({ id: "keep-me", description: "edited task" }))
    useMetricsStore.getState().updateDatapoint(metricId, { values: { joy: 90 } })

    await restoreBackup(backup, { storeKeys: ["cogs-task-storage"], mode: "replace" })

    expect(useTaskStore.getState().tasks.find((t) => t.id === "keep-me")?.description).toBe("original task")
    expect(useMetricsStore.getState().datapoints.find((d) => d.id === metricId)?.values.joy).toBe(90)
  })

  it("merge of chosen stores keeps live ids and adds missing ones", async () => {
    taskRepository.add(task({ id: "a", description: "from backup" }))
    taskRepository.add(task({ id: "b", description: "also backup" }))
    const backup = parseBackup(serializeBackup())

    taskRepository.update(task({ id: "a", description: "live rename" }))
    taskRepository.add(task({ id: "c", description: "live only" }))
    taskRepository.remove("b")

    await restoreBackup(backup, { storeKeys: ["cogs-task-storage"], mode: "merge" })

    const tasks = useTaskStore.getState().tasks
    expect(tasks.find((t) => t.id === "a")?.description).toBe("live rename")
    expect(tasks.find((t) => t.id === "b")?.description).toBe("also backup")
    expect(tasks.find((t) => t.id === "c")?.description).toBe("live only")
  })

  it("mergePersistPayload keeps existing ids and adds new ones", () => {
    const existing = JSON.stringify({
      state: { tasks: [{ id: "a", name: "live" }], extra: true },
      version: 12,
    })
    const incoming = {
      state: { tasks: [{ id: "a", name: "file" }, { id: "b", name: "new" }] },
      version: 12,
    }
    const merged = JSON.parse(mergePersistPayload(existing, incoming)) as {
      state: { tasks: { id: string; name: string }[]; extra: boolean }
    }
    expect(merged.state.tasks.map((t) => t.id).sort()).toEqual(["a", "b"])
    expect(merged.state.tasks.find((t) => t.id === "a")?.name).toBe("live")
    expect(merged.state.extra).toBe(true)
  })

  it("summarizes recovery snapshots and rejects path-like names", () => {
    taskRepository.add(task({ id: "a" }))
    const json = serializeBackup()
    expect(recoveryBackupInfoFromJson("ok-file.json", json, json.length)?.storeKeys).toEqual(
      expect.arrayContaining(["brain2-task-storage"]),
    )
    expect(isSafeRecoveryBackupName("../secret.json")).toBe(false)
    expect(isSafeRecoveryBackupName("nested/path.json")).toBe(false)
    expect(recoveryBackupInfoFromJson("../x.json", json, 1)).toBeNull()
  })

  it("round-trips item history, module notes, and home layout", async () => {
    localStorage.setItem(
      "brain2-item-activity",
      JSON.stringify({ t1: [{ id: "e1", summary: "renamed" }] }),
    )
    localStorage.setItem("notes-mod1", "free write")
    localStorage.setItem("inbox-recent-list-ids", JSON.stringify(["groceries"]))
    useHomeWidgetsStore.getState().hideWidget("review")

    const backup = parseBackup(serializeBackup())
    expect(backup.stores["brain2-home-widgets"]).toBeDefined()
    expect(backup.extras?.["brain2-item-activity"]).toMatch(/renamed/)
    expect(backup.extras?.["notes-mod1"]).toBe("free write")
    expect(backup.extras?.["inbox-recent-list-ids"]).toMatch(/groceries/)
    expect(backup.extras?.["brain2-last-persist-ok"]).toBeUndefined()
    expect(backup.extras?.["brain2-pcb-pick"]).toBeUndefined()

    localStorage.removeItem("brain2-item-activity")
    localStorage.removeItem("notes-mod1")
    localStorage.removeItem("inbox-recent-list-ids")
    useHomeWidgetsStore.getState().resetWidgets()

    await restoreBackup(backup)
    expect(localStorage.getItem("brain2-item-activity")).toMatch(/renamed/)
    expect(localStorage.getItem("notes-mod1")).toBe("free write")
    expect(localStorage.getItem("inbox-recent-list-ids")).toMatch(/groceries/)
    expect(useHomeWidgetsStore.getState().hidden).toContain("review")
  })

  it("folds a leftover friend picture into attachments and keeps it out of extras", async () => {
    localStorage.setItem("brain2-friend-pic:p9", "data:image/png;base64,ZmFrZQ==")
    const backup = await createFullBackup()
    expect(backup.extras?.["brain2-friend-pic:p9"]).toBeUndefined()
    expect(backup.attachments?.friend_p9?.dataUrl).toBe("data:image/png;base64,ZmFrZQ==")
  })

  it("a store-only restore leaves other saved keys alone", async () => {
    localStorage.setItem("brain2-item-activity", "keep-me")
    const backup = parseBackup(serializeBackup())
    localStorage.setItem("brain2-item-activity", "live-newer")
    await restoreBackup(backup, { storeKeys: ["brain2-task-storage"], mode: "replace" })
    expect(localStorage.getItem("brain2-item-activity")).toBe("live-newer")
  })

  it("full replace drops extra keys the file does not have", async () => {
    localStorage.setItem("brain2-item-activity", "old")
    const backup = parseBackup(serializeBackup())
    localStorage.setItem("brain2-todo-prefs", "stale-pref")
    await restoreBackup(backup)
    expect(localStorage.getItem("brain2-todo-prefs")).toBeNull()
    expect(localStorage.getItem("brain2-item-activity")).toBe("old")
  })

  it("folds a plan draft left on the bare key into the copy restore reads", () => {
    localStorage.setItem(
      "brain2-monthPlan-2026-09",
      serializeAppendLog([{ id: "al_1", createdAt: "2026-09-21T23:00:05.308Z", text: "see" }]),
    )
    localStorage.setItem("monthPlan-2026-09", JSON.stringify({ v: 1, entries: [], draft: "hedgehog-month-persist-probe" }))
    const backup = createBackup()
    const canon = backup.planText["brain2-monthPlan-2026-09"]
    expect(parseAppendLog(canon).map((entry) => entry.text)).toEqual(["see"])
    expect(parseAppendLogDraft(canon)).toBe("hedgehog-month-persist-probe")
  })

  it("unions day notes split across the brain2 and cogs keys", () => {
    localStorage.setItem(
      "brain2-tracking-day-notes",
      JSON.stringify({ "2026-09-19": serializeAppendLog([{ id: "a", createdAt: null, text: "one" }]) }),
    )
    localStorage.setItem(
      "cogs-tracking-day-notes",
      JSON.stringify({
        "2026-09-19": serializeAppendLog([{ id: "b", createdAt: null, text: "also" }]),
        "2026-09-21": serializeAppendLog([{ id: "c", createdAt: null, text: "two" }]),
      }),
    )
    const notes = createBackup().stores["brain2-tracking-day-notes"] as Record<string, string>
    expect(parseAppendLog(notes["2026-09-19"]).map((entry) => entry.text).sort()).toEqual(["also", "one"])
    expect(parseAppendLog(notes["2026-09-21"]).map((entry) => entry.text)).toEqual(["two"])
  })

  it("keeps an unprefixed relic in the file", () => {
    localStorage.setItem("friend-worn", JSON.stringify({ photoId: "owl", displayName: "baby owlet" }))
    const backup = createBackup()
    expect(backup.extras?.["friend-worn"]).toMatch(/baby owlet/)
    expect(backup.extras?.["last-persist-ok"]).toBeUndefined()
  })

  it("includes a task that never reached disk", async () => {
    if (!useTaskStore.persist.hasHydrated()) {
      await new Promise<void>((resolve) => {
        const unsub = useTaskStore.persist.onFinishHydration(() => {
          unsub()
          resolve()
        })
      })
    }
    taskRepository.add(task({ id: "disk", description: "on disk" }))
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("The quota has been exceeded.", "QuotaExceededError")
    })
    taskRepository.add(task({ id: "memory", description: "only memory" }))
    spy.mockRestore()
    const raw = JSON.stringify(createBackup().stores["brain2-task-storage"])
    expect(raw).toMatch(/on disk/)
    expect(raw).toMatch(/only memory/)
  })

  it("exports a gallery picture that is still a data URL in the open window", async () => {
    useBabyAnimalsStore.setState({
      photos: [
        {
          id: "p9",
          animalId: "owl",
          displayName: "baby owlet",
          query: "owl",
          sourceUrl: "data:image/png;base64,ZmFrZQ==",
          via: "upload",
          uri: "data:image/png;base64,ZmFrZQ==",
          foundAt: "2026-09-21T00:00:00.000Z",
        },
      ],
    })
    const backup = await createFullBackup()
    expect(backup.attachments?.friend_p9?.dataUrl).toBe("data:image/png;base64,ZmFrZQ==")
  })

  it("an older backup without extras does not wipe other saved keys", async () => {
    localStorage.setItem("brain2-item-activity", "keep")
    const backup = parseBackup(serializeBackup())
    delete backup.extras
    localStorage.setItem("brain2-item-activity", "still-here")
    await restoreBackup(backup)
    expect(localStorage.getItem("brain2-item-activity")).toBe("still-here")
  })

  it("listRecoveryBackups treats a missing hub as no folder", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("offline"))
    await expect(listRecoveryBackups()).resolves.toEqual({ exists: false, backups: [] })
    spy.mockRestore()
  })
})

describe("per-category export/import", () => {
  beforeEach(() => resetAllStores())

  const seedTree = () => {
    const store = useTaskStore.getState()
    store.setLists([
      cat({ id: "parent" }),
      cat({ id: "child", parentListId: "parent" }),
      cat({ id: "other" }),
    ])
    store.setTasks([
      task({ id: "tp", lists: ["parent"] }),
      task({ id: "tc", lists: ["child"] }),
      task({ id: "to", lists: ["other"] }),
    ])
  }

  it("exports a category subtree and its member tasks (not siblings)", () => {
    seedTree()
    const data = buildCategoryExport("parent")!
    expect(data.lists.map((c) => c.id).sort()).toEqual(["child", "parent"])
    expect(data.tasks.map((t) => t.id).sort()).toEqual(["tc", "tp"])
    expect(data.kind).toBe("category")
  })

  it("returns null for an unknown category", () => {
    expect(buildCategoryExport("ghost")).toBeNull()
    expect(exportCategory("ghost")).toBeNull()
  })

  it("round-trips through serialize/parse with revived dates", () => {
    seedTree()
    const json = exportCategory("parent")!
    const parsed = parseCategoryExport(json)
    expect(parsed.lists[0].createdAt).toBeInstanceOf(Date)
    expect(parsed.tasks[0].createdAt).toBeInstanceOf(Date)
  })

  it("imports a subtree into a wiped store (merge)", () => {
    seedTree()
    const json = exportCategory("parent")!
    resetAllStores()
    const result = importCategory(parseCategoryExport(json), "merge")
    expect(result.lists).toBe(2)
    expect(result.tasks).toBe(2)
    const state = useTaskStore.getState()
    expect(state.lists.find((c) => c.id === "child")?.parentListId).toBe("parent")
    expect(state.tasks.find((t) => t.id === "tc")).toBeDefined()
  })

  it("merge leaves existing ids untouched but replace overwrites them", () => {
    seedTree()
    const json = exportCategory("parent")!
    // Mutate the live copy, then re-import the original export.
    const store = useTaskStore.getState()
    store.updateList(cat({ id: "parent", name: "renamed" }))
    importCategory(parseCategoryExport(json), "merge")
    expect(useTaskStore.getState().lists.find((c) => c.id === "parent")?.name).toBe("renamed")
    importCategory(parseCategoryExport(json), "replace")
    expect(useTaskStore.getState().lists.find((c) => c.id === "parent")?.name).toBe("parent")
  })

  it("rejects a malformed category export", () => {
    expect(() => parseCategoryExport(JSON.stringify({ nope: true }))).toThrow()
  })
})
