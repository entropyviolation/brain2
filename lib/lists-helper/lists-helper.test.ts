import { describe, expect, it } from "vitest"
import { applyItemEditPatch } from "@/lib/commit-item-edit"
import { getBuiltinItemTypes, mergeTypeRegistry } from "@/lib/item-types"
import type { AttributeDefinition, Folder, ItemTypeDefinition, List, Task } from "@/lib/types"
import { newSession, step, type Session } from "./session"
import type { Port, World } from "./types"

const types = mergeTypeRegistry(getBuiltinItemTypes())
const list = (id: string, name: string, extra: Partial<List> = {}): List => ({ id, name, color: "#111", description: "", createdAt: new Date(), ...extra })
const task = (id: string, title: string, extra: Partial<Task> = {}): Task => ({
  id,
  description: title,
  title,
  lists: [],
  stage: "list",
  completed: false,
  createdAt: new Date(2026, 0, 1),
  ...extra,
})

function harness(tasks: Task[], lists: List[], folders: Folder[] = [], typeRows: ItemTypeDefinition[] = types) {
  const state = { tasks, lists, folders, types: typeRows, dismissed: new Set<string>(), tomb: [] as string[], writes: 0 }
  const port: Port = {
    world: (): World => ({ tasks: state.tasks, lists: state.lists, types: state.types, folders: state.folders }),
    now: () => new Date(2026, 10, 2, 12),
    commit: (id, patch) => {
      state.writes++
      state.tasks = state.tasks.map((t) => (t.id === id ? applyItemEditPatch(t, patch) : t))
    },
    commitMany: (changes) => {
      state.writes++
      const by = new Map(changes.map((c) => [c.id, c.patch]))
      let n = 0
      state.tasks = state.tasks.map((t) => {
        const patch = by.get(t.id)
        if (!patch) return t
        n++
        return applyItemEditPatch(t, patch)
      })
      return n
    },
    replaceTasks: (next, tomb) => {
      state.writes++
      state.tasks = next
      state.tomb.push(...tomb)
    },
    addItem: (t) => {
      state.writes++
      state.tasks = [...state.tasks, t]
    },
    removeItem: (id) => {
      state.tasks = state.tasks.filter((t) => t.id !== id)
    },
    addList: (l) => {
      state.lists = [...state.lists, l]
    },
    removeList: (id) => {
      state.lists = state.lists.filter((l) => l.id !== id)
      state.folders = state.folders.map((f) => ({ ...f, listIds: f.listIds.filter((x) => x !== id) }))
    },
    addFolder: (f) => {
      state.folders = [...state.folders, f]
    },
    removeFolder: (id) => {
      state.folders = state.folders.filter((f) => f.id !== id)
    },
    fileList: (fid, lid) => {
      state.folders = state.folders.map((f) => (f.id === fid ? { ...f, listIds: [...f.listIds, lid] } : f))
    },
    addType: (t) => {
      state.types = [...state.types, t]
    },
    removeType: (id) => {
      state.types = state.types.filter((t) => t.id !== id)
    },
    untombstone: (ids) => {
      state.tomb = state.tomb.filter((x) => !ids.includes(x))
    },
    isDismissed: (k) => state.dismissed.has(k),
    dismiss: (k) => state.dismissed.add(k),
  }
  let session: Session = newSession()
  const say = (text: string) => {
    const out = step(session, text, port)
    session = out.session
    return out.replies.filter((r) => r.kind !== "trace")
  }
  /** Every reply, including the thought-process trace. */
  const sayAll = (text: string) => {
    const out = step(session, text, port)
    session = out.session
    return out.replies
  }
  return { state, port, say, sayAll, get session() { return session } }
}

describe("duplicates", () => {
  const base = () =>
    harness(
      [
        task("a", "Dune", { lists: ["books"], type: "book", attributes: { author: "Frank Herbert" } }),
        task("b", "dune!", { lists: ["books"], type: "book" }),
        task("c", "Emma", { lists: ["books"], type: "book" }),
      ],
      [list("books", "Books", { itemTypeId: "book" })],
    )
  it("suggests a group, then merges on a click and undoes", () => {
    const h = base()
    const r = h.say("help me find and merge duplicate items")
    expect(r.some((x) => x.kind === "dup")).toBe(true)
    h.say("merge")
    expect(h.state.tasks.map((t) => t.id).sort()).toEqual(["a", "c"])
    expect(h.state.tasks.find((t) => t.id === "a")!.attributes?.author).toBe("Frank Herbert")
    expect(h.say("undo")[0]).toMatchObject({ kind: "result" })
    expect(h.state.tasks.map((t) => t.id).sort()).toEqual(["a", "b", "c"])
  })
  it("remembers a dismissal", () => {
    const h = base()
    h.say("find duplicate items")
    h.say("dismiss")
    expect(h.say("find duplicate items")[0]).toMatchObject({ kind: "say", text: expect.stringContaining("No duplicates") })
  })
})

describe("exclusive type", () => {
  const taskList = list("na", "Chores", { itemTypeId: "task" })
  const books = list("books", "Books", { itemTypeId: "book" })
  const make = () =>
    harness(
      [
        task("b1", "Dune", { type: "task", lists: ["books", "chores"] }),
        task("b2", "Emma", { type: "book", lists: ["books"] }),
        task("b3", "Ulysses", { type: "task", lists: ["chores"] }), // book only by... nothing: not a book item
        task("b4", "Hamlet", { type: "task", lists: ["books"] }),
      ],
      [books, list("chores", "Chores", { itemTypeId: "task" }), taskList],
    )
  it("plans first, writes nothing, then applies after yes", () => {
    const h = make()
    const r = h.say('For all Book type items, if that item is also a "Task" type item, it shouldn\'t be. Remove the "Task" item type from all Book type items, and have Book be made the primary item type for all books.')
    expect(r.find((x) => x.kind === "plan")).toBeTruthy()
    h.say("cancel")
    expect(h.state.writes).toBe(0)
    expect(h.say('for all Book type items remove the Task item type')[0]).toMatchObject({ kind: "plan" })
    h.say("cancel")
    const r2 = h.say('remove the Task item type from all Book type items')
    const plan = r2.find((x) => x.kind === "plan")
    expect(plan).toBeTruthy()
    expect(h.state.writes).toBe(0)
    h.say("yes")
    const byId = Object.fromEntries(h.state.tasks.map((t) => [t.id, t]))
    expect(byId.b1!.type).toBe("book")
    expect(byId.b1!.lists).toEqual(["books"])
    expect(byId.b1!.listMembershipExclusions).toEqual(["chores"])
    expect(byId.b4!.type).toBe("book")
    expect(byId.b3!.type).toBe("task")
    h.say("undo")
    expect(h.state.tasks.find((t) => t.id === "b1")!.type).toBe("task")
    expect(h.state.tasks.find((t) => t.id === "b1")!.lists).toEqual(["books", "chores"])
  })
  it("refuses to apply when the data moved after the plan", () => {
    const h = make()
    h.say("remove the Task item type from all Book type items")
    h.state.tasks = h.state.tasks.map((t) => (t.id === "b4" ? { ...t, type: "book" } : t))
    const r = h.say("yes")
    expect(r[0]).toMatchObject({ kind: "say", text: expect.stringContaining("Things changed") })
    expect(h.state.tasks.find((t) => t.id === "b1")!.type).toBe("task")
  })
  it("never orphans an item whose only list is a Task list", () => {
    const h = harness([task("x", "Solo", { type: "book", lists: ["chores"] })], [list("chores", "Chores", { itemTypeId: "task" })])
    const r = h.say("remove the Task item type from all Book type items")
    expect(r[0]).toMatchObject({ kind: "answer" })
  })
})

describe("copy attributes", () => {
  const author: AttributeDefinition = { id: "shelf", name: "Shelf", type: "string" }
  const mood: AttributeDefinition = { id: "mood", name: "Mood", type: "string" }
  const make = () =>
    harness(
      [
        task("17818603962663tgx5", "Model", { type: "book", itemAttributeDefinitions: [mood], attributes: { mood: "calm" } }),
        task("t1", "Dune", { type: "book" }),
        task("t2", "Emma", { type: "book", itemAttributeDefinitions: [mood], attributes: { mood: "wry" } }),
      ],
      [],
    )
  it("adds only the missing fields, never touching a value", () => {
    const h = make()
    h.state.tasks[0] = { ...h.state.tasks[0]!, itemAttributeDefinitions: [mood, author] }
    const r = h.say("make it so that all Book items have at least the attributes that item id 17818603962663tgx5 has")
    const plan = r.find((x) => x.kind === "plan")
    expect(plan).toBeTruthy()
    h.say("yes")
    const dune = h.state.tasks.find((t) => t.id === "t1")!
    expect(dune.itemAttributeDefinitions?.map((d) => d.id).sort()).toEqual(["mood", "shelf"])
    expect(dune.attributes).toBeUndefined()
    const emma = h.state.tasks.find((t) => t.id === "t2")!
    expect(emma.attributes?.mood).toBe("wry")
    expect(emma.itemAttributeDefinitions?.map((d) => d.id).sort()).toEqual(["mood", "shelf"])
  })
  it("says so when the id is unknown", () => {
    const h = make()
    const r = h.say("all Book items should have the attributes item 99999999999zzzz has")
    expect(r[0]).toMatchObject({ kind: "say", text: expect.stringContaining("can't find") })
  })
})

describe("add items", () => {
  const books = list("L1", "Reading", { itemTypeId: "book" })
  it("adds with typed values, skips existing, and undoes", () => {
    const h = harness([task("e", "Emma", { lists: ["L1"] })], [books])
    const r = h.say("add Dune, Emma, Ulysses to list L1 with attributes author: Frank Herbert; pageCount: 412")
    const plan = r.find((x) => x.kind === "plan") as Extract<(typeof r)[number], { kind: "plan" }>
    expect(plan.plan.creates).toHaveLength(2)
    expect(h.state.writes).toBe(0)
    h.say("yes")
    const dune = h.state.tasks.find((t) => t.title === "Dune")!
    expect(dune.lists).toEqual(["L1"])
    expect(dune.attributes?.author).toBe("Frank Herbert")
    expect(dune.attributes?.pageCount).toBe(412)
    h.say("undo")
    expect(h.state.tasks).toHaveLength(1)
  })
  it("uses the focused list", () => {
    const h = harness([], [books])
    h.say("focus on list Reading")
    expect(h.say("add Dune")[0]).toMatchObject({ kind: "plan" })
  })
  it("asks for the count back on a big change", () => {
    const many = Array.from({ length: 30 }, (_, i) => task(`n${i}`, `Item ${i}`, { type: "item" }))
    const h = harness(many, [])
    h.say("change all item items to book")
    expect(h.say("yes")[0]).toMatchObject({ kind: "say", text: expect.stringContaining("yes 30") })
    h.say("yes 30")
    expect(h.state.tasks.every((t) => t.type === "book")).toBe(true)
  })
})

describe("big plans and loose wording", () => {
  const books = list("books", "Books", { itemTypeId: "book" })
  const many = () =>
    harness(
      Array.from({ length: 1200 }, (_, i) => task(`t${i}`, `Book ${i}`, { type: "task", lists: ["books"] })),
      [books],
    )
  it("writes a 1200-item plan in one write and undoes it in one write", () => {
    const h = many()
    h.say("remove the Task item type from all Book type items")
    h.say("yes 1200")
    expect(h.state.writes).toBe(1)
    expect(h.state.tasks.every((t) => t.type === "book")).toBe(true)
    expect(h.state.tasks).toHaveLength(1200)
    h.say("undo")
    expect(h.state.writes).toBe(2)
    expect(h.state.tasks.every((t) => t.type === "task")).toBe(true)
  })
  it("offers the working sentence, both ways round, for a loose line", () => {
    const h = many()
    const r = h.say("Book items that are also Task items should not be Task items anymore")[0]!
    expect(r.kind).toBe("say")
    const texts = (r as Extract<typeof r, { kind: "say" }>).choices?.map((c) => c.text)
    expect(texts).toEqual(["Remove the Task item type from all Book type items", "Remove the Book item type from all Task type items"])
    expect(h.say(texts![0]!)[0]).toMatchObject({ kind: "plan" })
  })
})

describe("guardrails", () => {
  const books = list("books", "Books", { itemTypeId: "book" })
  const rows = () => Array.from({ length: 40 }, (_, i) => task(`g${i}`, `Book ${i}`, { type: "task", lists: ["books"] }))
  it("puts everything back when the write loses an item", () => {
    const h = harness(rows(), [books])
    const real = h.port.commitMany
    let ate = false
    h.port.commitMany = (c) => {
      const n = real(c)
      if (!ate) h.state.tasks = h.state.tasks.slice(1) // the first write eats a row
      ate = true
      return n
    }
    h.say("remove the Task item type from all Book type items")
    const r = h.say("yes 40")
    expect(JSON.stringify(r)).toContain("put everything back")
    expect(h.state.tasks.every((t) => t.type === "task")).toBe(true) // the rollback put the old values back
  })
  it("refuses a plan that writes a field the tool may not touch", async () => {
    const { refusal } = await import("./guard")
    const plan = { tool: "retype-items", title: "x", changes: [{ id: "a", title: "A", patch: { completed: true }, before: {}, note: "" }], total: 1 } as never
    expect(refusal(plan)).toMatch(/not allowed to touch/)
    expect(refusal({ tool: "retype-items", title: "x", changes: [{ id: "a", title: "A", patch: { type: "" }, before: {}, note: "" }], total: 1 } as never)).toMatch(/blank/)
    expect(refusal({ tool: "exclusive-type", title: "x", changes: [{ id: "a", title: "A", patch: { lists: [] }, before: {}, note: "" }], total: 1 } as never)).toMatch(/every list/)
  })
  it("offers a key per candidate when a name fits two things", () => {
    const h = harness([task("a", "x")], [])
    const r = h.say('remove the "Lo" item type from all Book type items')[0] as { text: string; choices?: { text: string }[] }
    expect(r.choices?.map((c) => c.text)).toEqual(expect.arrayContaining(['remove the "Location" item type from all Book type items']))
  })
})

describe("duplicates, scoped", () => {
  const rows = () => [
    task("a", "Dune", { lists: ["books"], type: "book" }),
    task("b", "dune!", { lists: ["books"], type: "book" }),
    task("c", "Walk dog", { lists: ["chores"], type: "task" }),
    task("d", "walk dog.", { lists: ["chores"], type: "task" }),
  ]
  const lists = [list("books", "Books", { itemTypeId: "book" }), list("chores", "Chores")]
  it("finds duplicates in a list by name, no 'list' word needed", () => {
    const h = harness(rows(), lists)
    const r = h.say("help me find duplicates in Chores")
    expect(JSON.stringify(r)).toContain("Walk dog")
    expect(JSON.stringify(r)).not.toContain("Dune")
  })
  it("finds duplicates of an item type", () => {
    const h = harness(rows(), lists)
    const r = h.say("find duplicates of item type Book")
    expect(JSON.stringify(r)).toContain("Dune")
    expect(JSON.stringify(r)).not.toContain("Walk dog")
  })
  it("says so when the list is unknown instead of searching everything", () => {
    const h = harness(rows(), lists)
    expect(JSON.stringify(h.say("find duplicates in Nonesuch"))).toContain("don't know a list")
  })
})

describe("collect-items", () => {
  const now = new Date(2026, 10, 2, 12)
  const d = (m: number, day: number) => new Date(2026, m - 1, day)
  const rows = () => [
    task("t1", "Pay rent", { type: "task", lists: ["inbox"], deadline: d(11, 5) }),
    task("t2", "File taxes", { type: "task", lists: ["inbox"], deadline: d(12, 20) }),
    task("t3", "Too late", { type: "task", lists: ["inbox"], deadline: d(12, 30) }),
    task("t4", "Call mom", { type: "note", lists: ["inbox"], deadline: d(11, 6) }),
    task("t5", "Done already", { type: "task", lists: ["inbox"], deadline: d(11, 7), completed: true }),
    task("t6", "No date", { type: "task", lists: ["inbox"] }),
    task("b1", "Dune", { type: "book", lists: ["want"] }),
    task("b2", "Emma", { type: "book", lists: ["want", "own"] }),
    task("b3", "Ulysses", { type: "book", lists: ["want"] }),
  ]
  const lists = () => [list("inbox", "Inbox"), list("want", "Books I want to own"), list("own", "Books I own"), list("plan", "Plan")]
  const folders = (): Folder[] => [{ id: "f1", name: "Home", createdAt: new Date(), listIds: [] }]
  const textOf = (r: unknown) => JSON.stringify(r)

  it("adds task items due from now until a date to an existing list", () => {
    const h = harness(rows(), lists(), folders())
    const r = h.say("add all task type items due from now until Dec 25 to list Plan")
    expect(r[0]).toMatchObject({ kind: "plan" })
    const plan = (r[0] as Extract<(typeof r)[number], { kind: "plan" }>).plan
    expect(plan.changes.map((c) => c.id).sort()).toEqual(["t1", "t2"]) // not t3 (late), t4 (note), t5 (done), t6 (undated)
    expect(textOf(plan.warnings)).toMatch(/finished/)
    h.say("yes")
    expect(h.state.tasks.find((t) => t.id === "t1")!.lists).toEqual(["inbox", "plan"])
    expect(h.state.tasks.find((t) => t.id === "t3")!.lists).toEqual(["inbox"])
    h.say("undo")
    expect(h.state.tasks.find((t) => t.id === "t1")!.lists).toEqual(["inbox"])
  })

  it("makes a new list in a folder for due items of any type", () => {
    const h = harness(rows(), lists(), folders())
    const r = h.say('add all items that are due from now until Dec 25 to new list called "Soon" in Home folder')
    expect(r[0]).toMatchObject({ kind: "plan" })
    h.say("yes")
    const made = h.state.lists.find((l) => l.name === "Soon")!
    expect(made).toBeTruthy()
    expect(h.state.folders[0]!.listIds).toContain(made.id)
    expect(h.state.tasks.filter((t) => t.lists?.includes(made.id)).map((t) => t.id).sort()).toEqual(["t1", "t2", "t4"])
    h.say("undo")
    expect(h.state.lists.some((l) => l.name === "Soon")).toBe(false)
    expect(h.state.folders[0]!.listIds).toEqual([])
  })

  it("collects items on one list that are not on another, into a new list with a new item type", () => {
    const h = harness(rows(), lists(), folders())
    const r = h.say('add all items in list "Books I want to own" that aren\'t in like "Books I own" to new list called "christmas list" with items of new item type "Wishlist Item"')
    expect(r[0]).toMatchObject({ kind: "plan" })
    const plan = (r[0] as Extract<(typeof r)[number], { kind: "plan" }>).plan
    expect(plan.changes.map((c) => c.id).sort()).toEqual(["b1", "b3"]) // Emma is already owned
    expect(plan.setup?.type?.name).toBe("Wishlist Item")
    h.say("yes")
    const made = h.state.lists.find((l) => l.name === "christmas list")!
    const type = h.state.types.find((t) => t.name === "Wishlist Item")!
    expect(made.itemTypeId).toBe(type.id)
    expect(h.state.tasks.find((t) => t.id === "b1")!.type).toBe("book") // primary type untouched
    expect(h.state.tasks.find((t) => t.id === "b1")!.lists).toEqual(["want", made.id])
    h.say("undo")
    expect(h.state.types.some((t) => t.name === "Wishlist Item")).toBe(false)
    expect(h.state.lists.some((l) => l.name === "christmas list")).toBe(false)
    expect(h.state.tasks.find((t) => t.id === "b1")!.lists).toEqual(["want"])
  })

  it("refuses to gather everything, a list name that exists, and an unknown folder", () => {
    const h = harness(rows(), lists(), folders())
    expect(textOf(h.say("add all items to list Plan"))).toMatch(/won't gather everything/)
    expect(textOf(h.say('add all Book items to new list called "Plan"'))).toMatch(/already exists/)
    expect(textOf(h.say('add all Book items to new list called "X" in Nowhere folder'))).toMatch(/don't know a folder/)
  })

  it("says which words it could not read as a date", () => {
    const h = harness(rows(), lists(), folders())
    expect(textOf(h.say("add all items due from now until blorp to list Plan"))).toMatch(/couldn't read/)
  })
})

describe("thought process", () => {
  it("shows the pick, the stages, and the outcome before the answer", () => {
    const h = harness(
      [task("b1", "Dune", { lists: ["want"] })],
      [list("want", "Want")],
    )
    const r = h.sayAll("find duplicate items")
    expect(r[0]).toMatchObject({ kind: "trace" })
    const lines = (r[0] as Extract<(typeof r)[number], { kind: "trace" }>).lines
    expect(lines[0].step).toBe("heard")
    expect(lines.some((l) => l.step === "pick" && /find-duplicates/.test(l.text))).toBe(true)
    expect(lines[lines.length - 1].step).toBe("out")
  })
})

describe("lookup-id", () => {
  const world = () =>
    harness(
      [task("100", "Doors of Perception", { type: "book" }), task("101", "Doors of Perception (notes)"), task("102", "Dune")],
      [list("la", "All Items"), list("lb", "All Items"), list("lc", "Reading")],
      [
        { id: "fa", name: "Next actions", createdAt: new Date(), listIds: ["la"] },
        { id: "fb", name: "Someday", createdAt: new Date(), listIds: ["lb", "lc"] },
      ],
    )
  type Ans = Extract<ReturnType<ReturnType<typeof world>["say"]>[number], { kind: "answer" }>

  it("finds a list by name inside a folder", () => {
    const r = world().say("what is the list id for the All Items list of Next actions folder?")
    expect(r[0]).toMatchObject({ kind: "answer", text: expect.stringContaining("la") })
    expect((r[0] as Ans).candidates).toHaveLength(1)
  })
  it("offers clickable candidates when a name fits several lists", () => {
    const h = world()
    const a = h.say("what is the list id for All Items")[0] as Ans
    expect(a.candidates?.filter((c) => !c.other).map((c) => c.id).sort()).toEqual(["la", "lb"])
    expect(a.candidates?.some((c) => c.other)).toBe(true)
    const picked = h.say(a.candidates![1]!.text)[0] as Ans
    expect(picked.candidates).toHaveLength(1)
    expect(picked.text).toContain(a.candidates![1]!.id)
  })
  it("finds an item by title, with or without its type", () => {
    const h = world()
    const withoutType = h.say("what is the item id for Doors of Perception")[0] as Ans
    expect(withoutType.candidates?.map((c) => c.id)).toEqual(["100"])
    const typed = h.say("what is the item id for Book Doors of Perception?")[0] as Ans
    expect(typed.candidates?.map((c) => c.id)).toEqual(["100"])
    const loose = h.say("item id for Doors")[0] as Ans
    expect(loose.candidates?.filter((c) => !c.other).map((c) => c.id).sort()).toEqual(["100", "101"])
  })
  it("says so when nothing fits", () => {
    expect(world().say("what is the item id for Zzzz")[0]).toMatchObject({ kind: "answer", text: expect.stringContaining("No item") })
  })
})

describe("apply a type to a list's items; pick when unsure", () => {
  const lists = [
    list("mut", "Instagram Mutuals"),
    list("nfb", "I follow (not following back)"),
    list("nfb2", "I follow, they don't follow back"),
    list("misc", "Groceries"),
  ]
  const rows = () => [task("a", "alice", { lists: ["mut"], type: "task" }), task("b", "bob", { lists: ["mut"], type: "task" }), task("c", "milk", { lists: ["misc"], type: "task" })]
  const typeOf = (h: ReturnType<typeof harness>, id: string) => h.state.tasks.find((t) => t.id === id)?.type

  it("makes a new item type and applies it to every item in the list, undoable", () => {
    const h = harness(rows(), lists)
    const r = h.say('apply new item type "Instagram Account" to all items in instagram mutuals list')
    expect(JSON.stringify(r)).toContain("new item type")
    h.say("yes")
    expect(typeOf(h, "a")).toBe("instagram-account")
    expect(typeOf(h, "b")).toBe("instagram-account")
    expect(typeOf(h, "c")).toBe("task")
    expect(h.state.types.some((t) => t.name === "Instagram Account")).toBe(true)
    h.say("undo")
    expect(typeOf(h, "a")).toBe("task")
    expect(h.state.types.some((t) => t.name === "Instagram Account")).toBe(false)
  })

  it("offers the closest lists plus Other when the id lookup finds no exact name", () => {
    const h = harness(rows(), lists)
    const a = h.say("what is the list id for i follow no follow back?")[0] as { candidates?: { id: string; label: string; other?: boolean }[] }
    expect(a.candidates?.filter((c) => !c.other).map((c) => c.id)).toEqual(expect.arrayContaining(["nfb", "nfb2"]))
    expect(JSON.stringify(a)).toContain("Is it one of these")
    expect(a.candidates?.some((c) => c.other)).toBe(true)
  })

  it("Other searches all lists by new words and finishes the request with the pick", () => {
    const h = harness(rows(), lists)
    const first = h.say("apply new item type Account to all items in Zzmutual list")
    expect(JSON.stringify(first)).toContain("Other")
    const ask = h.say("search lists")
    expect(JSON.stringify(ask)).toContain("Type a few words")
    const found = h.say("mutuals")
    const choice = (found[0] as { choices?: { label: string; text: string }[] }).choices!.find((c) => c.label.includes("Instagram Mutuals"))!
    expect(choice.text).toContain('"Instagram Mutuals"')
    expect(JSON.stringify(h.say(choice.text))).toContain('"kind":"plan"')
  })
})
