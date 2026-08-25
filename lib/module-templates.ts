/**
 * lib/module-templates.ts — Pre-built "mini-app" module templates
 *
 * Turns a one-click choice ("Itinerary Creator", "Cleaning", "Budget") into a
 * full workspace module: the supporting **lists** (lists) with their
 * **attribute schemas + defaults** (spec §5), a few seed items, and a
 * **workspace `ModuleInstance`** wiring those lists into bound views (editable
 * spreadsheet, agenda, rollup summary, gamified randomizer, focus timer,
 * checklist, notes).
 *
 * `buildModuleTemplate` is pure (data only, unit-testable). `instantiateModuleTemplate`
 * commits the result to the task + modules stores and returns the new module id.
 */
import type { AttributeDefinition, AttributeValue, FileValue, Task, List, WorkflowDefinition } from "@/lib/types"
import type { DashboardCard, ModuleInstance, ModuleView, ModuleViewConfig, ModuleViewKind } from "@/lib/modules-store"
import { createListItem, withCategoryDefaults } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useModulesStore } from "@/lib/modules-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import { FILMRECS_SHELVES } from "@/lib/filmrecs-types"
import { seedFilmToTask, type SeedFilm } from "@/lib/filmrecs-catalog"
import filmrecsSeed from "@/lib/filmrecs-seed.json"

export type ModuleTemplateId = "itinerary" | "cleaning" | "budget" | "book-tasting" | "filmrecs" | "blank"

export interface ModuleTemplateMeta {
  id: ModuleTemplateId
  name: string
  description: string
}

export const MODULE_TEMPLATES: ModuleTemplateMeta[] = [
  {
    id: "itinerary",
    name: "Itinerary Creator",
    description:
      "Write a trip plan in a doc, build a printable day-by-day itinerary (auto days, weather API, flight lookup), map activities by city, plus packing and before-trip checklists.",
  },
  {
    id: "cleaning",
    name: "Cleaning System",
    description:
      "Room inventory, a gamified random-task picker (\"pick up 20 things\"), a focus timer, per-room progress, and a notes space for your cleaning systems.",
  },
  {
    id: "budget",
    name: "Budget Tracker",
    description:
      "Accounts, monthly payments, debts, and expected spend with a dashboard of optional-inclusion rollups: liquid total, net worth, expected spend, and debts — each row toggle-able in/out of the calculation.",
  },
  {
    id: "book-tasting",
    name: "Book Tasting",
    description:
      "A reading list plus a PDF shelf: a matcher that links each PDF to its book (with confidence + unmatched flags) and a \"taste it\" quiz that shows a random snippet and asks you to guess the title.",
  },
  {
    id: "filmrecs",
    name: "Film DNA Lab",
    description:
      "Letterboxd taste map: vibe shelves, likes wall, Watch ranking (safe / balanced / explore), blend with a friend's CSV, and import watchlist/likes exports into a Films list.",
  },
  {
    id: "blank",
    name: "Blank Workspace",
    description: "An empty workspace. Add your own lists and views (spreadsheet, agenda, summary, randomizer, timer, …).",
  },
]

/** Result of building a template — pure data, ready to commit to stores. */
export interface BuiltModuleTemplate {
  lists: List[]
  seedTasks: Task[]
  module: ModuleInstance
  /** Seeded workflows wired to this module (committed to the workflows store). */
  workflows?: WorkflowDefinition[]
}

type Uid = (suffix: string) => string

function makeUid(seed: number): Uid {
  let n = 0
  return (suffix: string) => `tmpl-${seed}-${n++}-${suffix}`
}

// ---- attribute + view builders ------------------------------------------------

function attr(
  id: string,
  name: string,
  type: AttributeDefinition["type"],
  extra: Partial<AttributeDefinition> = {},
): AttributeDefinition {
  return { id, name, type, ...extra }
}

function makeCategory(
  uid: Uid,
  name: string,
  opts: {
    color: string
    itemLabel: string
    description?: string
    icon?: string
    attributes?: AttributeDefinition[]
    displayedAttributes?: string[]
    defaultAttributeValues?: Record<string, AttributeValue>
  },
): List {
  return {
    id: uid(slug(name)),
    name,
    color: opts.color,
    description: opts.description,
    createdAt: new Date(),
    scheduleable: false,
    itemLabel: opts.itemLabel,
    itemAttributes: opts.attributes,
    displayedAttributes: opts.displayedAttributes,
    defaultAttributeValues: opts.defaultAttributeValues,
  }
}

function view(kind: ModuleViewKind, title: string, config: ModuleViewConfig, uid: Uid): ModuleView {
  return { id: uid(`view-${kind}`), title, kind, config }
}

function workflow(
  uid: Uid,
  moduleId: string,
  name: string,
  def: Omit<WorkflowDefinition, "id" | "name" | "moduleId">,
): WorkflowDefinition {
  return { id: uid(`wf-${slug(name)}`), name, moduleId, ...def }
}

/** A `FileValue` seed carrying pre-extracted text so PDF demos work offline. */
function fileSeed(uid: Uid, name: string, extractedText: string): FileValue {
  return { id: uid(`file-${slug(name)}`), name, mime: "application/pdf", uri: `data:application/pdf;base64,`, extractedText }
}

function seed(category: List, description: string, attributes: Record<string, AttributeValue>): Task {
  return withCategoryDefaults(
    { ...createListItem(description, [category.id]), attributes },
    category,
  )
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

// ---- templates ----------------------------------------------------------------

function buildItinerary(uid: Uid): BuiltModuleTemplate {
  const PLACE_KINDS = ["Place", "Airport", "Landmark", "Stay", "Home", "Work", "Significant"]
  const BUCKETS = ["Must do", "Maybe"]

  const places = makeCategory(uid, "City Places", {
    color: "#ec4899",
    itemLabel: "place",
    description: "Wishlist and landmarks plotted on the Activities map, grouped by city and list (Must do / Maybe).",
    attributes: [
      attr("city", "City", "string"),
      attr("bucket", "List", "selection", {
        optionSource: "manual",
        options: BUCKETS,
        allowMultiple: true,
      }),
      attr("placeKind", "Kind", "selection", {
        optionSource: "manual",
        options: PLACE_KINDS,
      }),
      attr("address", "Address", "string"),
      attr("lat", "Latitude", "number", { allowFloat: true }),
      attr("lng", "Longitude", "number", { allowFloat: true }),
      attr("notes", "Notes", "string"),
    ],
    displayedAttributes: ["city", "bucket", "placeKind", "address"],
    defaultAttributeValues: { bucket: "Must do", placeKind: "Place" },
  })

  const packing = makeCategory(uid, "Packing", {
    color: "#8b5cf6",
    itemLabel: "item",
    attributes: [
      attr("packKind", "Category", "selection", {
        optionSource: "manual",
        options: ["Clothes", "Toiletries", "Electronics", "Documents", "Other"],
      }),
    ],
    displayedAttributes: ["packKind"],
  })

  const todo = makeCategory(uid, "To Do Before Trip", {
    color: "#f59e0b",
    itemLabel: "task",
    description: "Everything to handle before you leave.",
    attributes: [
      attr("priority", "Priority", "selection", {
        optionSource: "manual",
        options: ["High", "Medium", "Low"],
      }),
    ],
    displayedAttributes: ["priority"],
  })

  const planDocId = uid("plan-doc")
  const planDoc: Task = {
    id: planDocId,
    description: "Trip plan",
    type: "note",
    stage: "list",
    createdAt: new Date(),
    completed: false,
    lists: [],
    body: `<h1>Trip plan</h1>
<p>Use this space like a Docs note — themes, rough outline, links, and anything that doesn't fit the day grid.</p>
<h2>Goals</h2>
<ul>
<li>Settle in and walk Alfama</li>
<li>Day trip to Sintra</li>
<li>Train or fly to Porto</li>
</ul>`,
    attributes: {
      docsFolder: "Trips",
      docsFontFamily: "Merriweather",
      status: "draft",
    },
    links: [],
    tags: ["docs", "trip"],
  }

  const tripItinerary = {
    startDate: "2026-07-10",
    endDate: "2026-07-12",
    days: [
      {
        date: "2026-07-10",
        cityMode: "city" as const,
        city: "Lisbon, Portugal",
        dayNote: "Settle in, walk Alfama",
        sleepName: "Hotel Alfama",
        sleepAddress: "Rua de São Miguel 12, 1100-542 Lisboa, Portugal",
        schedule: [
          {
            id: uid("sched-arrive"),
            kind: "plan" as const,
            time: "14:00",
            text: "Belém Tower & pastéis",
          },
        ],
      },
      {
        date: "2026-07-11",
        cityMode: "travel" as const,
        city: "",
        fromCity: "Lisbon",
        toCity: "Sintra",
        schedule: [
          {
            id: uid("sched-sintra"),
            kind: "plan" as const,
            time: "09:30",
            text: "Sintra palaces tour",
          },
        ],
        sleepName: "Hotel Alfama",
        sleepAddress: "Rua de São Miguel 12, Lisboa",
      },
      {
        date: "2026-07-12",
        cityMode: "city" as const,
        city: "Porto",
        schedule: [],
        sleepName: "",
        sleepAddress: "",
      },
    ],
  }

  const seedTasks: Task[] = [
    planDoc,
    seed(places, "LIS Airport", {
      city: "Lisbon",
      bucket: "Must do",
      placeKind: "Airport",
      address: "Aeroporto Humberto Delgado, Lisboa",
      lat: 38.7756,
      lng: -9.1354,
    }),
    seed(places, "Belém Tower", {
      city: "Lisbon",
      bucket: "Must do",
      placeKind: "Landmark",
      address: "Av. Brasília, 1400-038 Lisboa",
      lat: 38.6916,
      lng: -9.216,
    }),
    seed(places, "LX Factory", {
      city: "Lisbon",
      bucket: "Maybe",
      placeKind: "Place",
      address: "R. Rodrigues de Faria 103, 1300-501 Lisboa",
      lat: 38.7034,
      lng: -9.179,
    }),
    seed(packing, "Passport", { packKind: "Documents" }),
    seed(packing, "Power adapter (EU)", { packKind: "Electronics" }),
    seed(packing, "Sunscreen", { packKind: "Toiletries" }),
    seed(todo, "Hold mail", { priority: "Medium" }),
    seed(todo, "Notify bank of travel", { priority: "High" }),
  ]

  const moduleId = uid("module")
  const module: ModuleInstance = {
    id: moduleId,
    type: "workspace",
    kind: "workspace",
    title: "Trip Itinerary",
    description: "Write a trip doc, build a day-by-day itinerary (weather + flights by number), map activities by city, and pack.",
    templateId: "itinerary",
    config: {
      planDocId,
      itineraryUiVersion: 3,
      placesCategoryId: places.id,
      tripItinerary,
    },
    enablePrint: true,
    views: [
      view("doc", "Plan", { docId: planDocId }, uid),
      view("itinerary-doc", "Itinerary", {}, uid),
      view("trip-map", "Activities", {
        categoryId: places.id,
        placesCategoryId: places.id,
      }, uid),
      view("checklist", "Packing", { categoryId: packing.id, checklistStyle: "packing" }, uid),
      view("checklist", "Before Trip", { categoryId: todo.id, checklistStyle: "pretrip" }, uid),
    ],
  }

  const workflows: WorkflowDefinition[] = [
    workflow(uid, moduleId, "Build pre-trip to-do list", {
      scope: { listIds: [todo.id] },
      trigger: { kind: "manual", buttonLabel: "Generate to-dos" },
      actions: [
        { kind: "createItem", categoryId: todo.id, defaults: { title: "Check passport expiry" } },
        { kind: "createItem", categoryId: todo.id, defaults: { title: "Arrange airport transfer" } },
      ],
    }),
  ]

  return { lists: [places, packing, todo], seedTasks, module, workflows }
}

function buildCleaning(uid: Uid): BuiltModuleTemplate {
  const rooms = makeCategory(uid, "Rooms", {
    color: "#10b981",
    itemLabel: "room",
    description: "Inventory each room and its cleaning progress.",
    attributes: [
      attr("progress", "Progress", "goal", { labels: { current: "Done", target: "Total" } }),
      attr("priority", "Priority", "selection", { optionSource: "manual", options: ["Low", "Medium", "High"] }),
    ],
    displayedAttributes: ["progress", "priority"],
  })

  const systems = makeCategory(uid, "Systems", {
    color: "#0ea5e9",
    itemLabel: "system",
    description: "Recurring cycles (laundry, dishes, trash) and how often they run.",
    attributes: [
      attr("cycleType", "Cycle", "selection", { optionSource: "manual", options: ["Laundry", "Dishes", "Trash", "Sheets", "Floors"] }),
      attr("progress", "Cycle progress", "goal", { labels: { current: "Done", target: "Loads" } }),
      attr("frequency", "Frequency", "selection", { optionSource: "manual", options: ["Daily", "Every few days", "Weekly"] }),
    ],
    displayedAttributes: ["cycleType", "progress", "frequency"],
  })

  const tasks = makeCategory(uid, "Cleaning Tasks", {
    color: "#06b6d4",
    itemLabel: "task",
    attributes: [
      attr("room", "Room", "selection", { optionSource: "list", optionListId: rooms.id }),
      attr("effort", "Effort", "selection", { optionSource: "manual", options: ["Quick", "Medium", "Deep"] }),
    ],
    displayedAttributes: ["room", "effort"],
  })

  const seedTasks: Task[] = [
    seed(rooms, "Kitchen", { progress: { current: 2, target: 10 }, priority: "High" }),
    seed(rooms, "Bedroom", { progress: { current: 1, target: 8 }, priority: "Medium" }),
    seed(rooms, "Living Room", { progress: { current: 0, target: 6 }, priority: "Medium" }),
    seed(rooms, "Bathroom", { progress: { current: 0, target: 5 }, priority: "High" }),
    seed(systems, "Laundry", { cycleType: "Laundry", progress: { current: 1, target: 3 }, frequency: "Weekly" }),
    seed(systems, "Dishes", { cycleType: "Dishes", progress: { current: 0, target: 2 }, frequency: "Daily" }),
    seed(systems, "Take out trash", { cycleType: "Trash", progress: { current: 0, target: 1 }, frequency: "Every few days" }),
    seed(tasks, "Wipe counters", { room: "Kitchen", effort: "Quick" }),
    seed(tasks, "Do the dishes", { room: "Kitchen", effort: "Medium" }),
    seed(tasks, "Clear the table", { room: "Kitchen", effort: "Quick" }),
    seed(tasks, "Make the bed", { room: "Bedroom", effort: "Quick" }),
    seed(tasks, "Put away laundry", { room: "Bedroom", effort: "Medium" }),
    seed(tasks, "Fluff cushions", { room: "Living Room", effort: "Quick" }),
    seed(tasks, "Dust shelves", { room: "Living Room", effort: "Medium" }),
    seed(tasks, "Scrub sink", { room: "Bathroom", effort: "Medium" }),
    seed(tasks, "Empty bins", { room: "Bathroom", effort: "Quick" }),
  ]

  const moduleId = uid("module")
  const module: ModuleInstance = {
    id: moduleId,
    type: "workspace",
    kind: "workspace",
    title: "Cleaning",
    description: "Gamified cleaning systems: pick a batch, beat the timer, watch room goals fill up.",
    templateId: "cleaning",
    config: {},
    views: [
      view("randomizer", "Pick up 20 things", { categoryId: tasks.id, framing: "Tidy", pickCount: 5, timerMinutes: 20 }, uid),
      view("timer", "Focus timer", { timerMinutes: 25 }, uid),
      view("checklist", "All tasks", { categoryId: tasks.id }, uid),
      view("summary", "Per room", { categoryId: tasks.id, groupAttrId: "room" }, uid),
      view("spreadsheet", "Rooms", { categoryId: rooms.id }, uid),
      view("spreadsheet", "Systems", { categoryId: systems.id }, uid),
      view("notes", "My cleaning systems", { notesKey: uid("notes") }, uid),
    ],
  }

  const workflows: WorkflowDefinition[] = [
    workflow(uid, moduleId, "Session complete → mark room progress", {
      scope: { listIds: [tasks.id] },
      trigger: { kind: "item", event: "complete" },
      actions: [{ kind: "addTag", tag: "cleaned" }],
    }),
  ]

  return { lists: [rooms, systems, tasks], seedTasks, module, workflows }
}

function buildBudget(uid: Uid): BuiltModuleTemplate {
  const accounts = makeCategory(uid, "Accounts", {
    color: "#22c55e",
    itemLabel: "account",
    description: "Where your money sits. Toggle each into the liquid / net-worth totals.",
    attributes: [
      attr("balance", "Balance", "number", { unit: "$", allowFloat: true }),
      attr("atype", "Type", "selection", { optionSource: "manual", options: ["Checking", "Savings", "Cash", "Investment"] }),
      attr("liquid", "Liquid?", "boolean", { booleanDisplay: "checkbox" }),
      attr("netWorth", "Count in net worth?", "boolean", { booleanDisplay: "checkbox" }),
    ],
    displayedAttributes: ["balance", "atype", "liquid", "netWorth"],
    defaultAttributeValues: { liquid: true, netWorth: true },
  })

  const payments = makeCategory(uid, "Monthly Payments", {
    color: "#f97316",
    itemLabel: "payment",
    description: "Recurring bills — check off as paid; toggle which count toward the monthly total.",
    attributes: [
      attr("amount", "Amount", "number", { unit: "$", allowFloat: true }),
      attr("dueDay", "Due day", "number"),
      attr("paid", "Paid", "boolean", { booleanDisplay: "checkbox" }),
      attr("include", "Count?", "boolean", { booleanDisplay: "checkbox" }),
    ],
    displayedAttributes: ["amount", "dueDay", "paid", "include"],
    defaultAttributeValues: { paid: false, include: true },
  })

  const debts = makeCategory(uid, "Debts", {
    color: "#ef4444",
    itemLabel: "debt",
    description: "What you owe — subtracted from net worth when counted.",
    attributes: [
      attr("balance", "Balance", "number", { unit: "$", allowFloat: true }),
      attr("apr", "APR", "number", { unit: "%", allowFloat: true }),
      attr("netWorth", "Count in net worth?", "boolean", { booleanDisplay: "checkbox" }),
    ],
    displayedAttributes: ["balance", "apr", "netWorth"],
    defaultAttributeValues: { netWorth: true },
  })

  const expected = makeCategory(uid, "Expected Spend", {
    color: "#a855f7",
    itemLabel: "line",
    description: "Upcoming discretionary spend — toggle items in/out of the forecast.",
    attributes: [
      attr("amount", "Amount", "number", { unit: "$", allowFloat: true }),
      attr("category", "Category", "selection", { optionSource: "manual", options: ["Travel", "Gifts", "Home", "Fun", "Other"] }),
      attr("include", "Count?", "boolean", { booleanDisplay: "checkbox" }),
    ],
    displayedAttributes: ["amount", "category", "include"],
    defaultAttributeValues: { include: true },
  })

  const seedTasks: Task[] = [
    seed(accounts, "Checking", { balance: 3200, atype: "Checking", liquid: true, netWorth: true }),
    seed(accounts, "Savings", { balance: 12500, atype: "Savings", liquid: true, netWorth: true }),
    seed(accounts, "Brokerage", { balance: 18400, atype: "Investment", liquid: false, netWorth: true }),
    seed(accounts, "Wallet cash", { balance: 140, atype: "Cash", liquid: true, netWorth: false }),
    seed(payments, "Rent", { amount: 1850, dueDay: 1, paid: true, include: true }),
    seed(payments, "Internet", { amount: 60, dueDay: 5, paid: false, include: true }),
    seed(payments, "Gym", { amount: 35, dueDay: 12, paid: false, include: false }),
    seed(payments, "Streaming bundle", { amount: 28, dueDay: 18, paid: false, include: true }),
    seed(debts, "Credit card", { balance: 1240, apr: 21.9, netWorth: true }),
    seed(debts, "Student loan", { balance: 8600, apr: 4.5, netWorth: true }),
    seed(expected, "Summer trip", { amount: 1500, category: "Travel", include: true }),
    seed(expected, "Birthday gifts", { amount: 220, category: "Gifts", include: true }),
    seed(expected, "New desk chair", { amount: 320, category: "Home", include: false }),
  ]

  const cards: DashboardCard[] = [
    { id: uid("card-liquid"), label: "Liquid total", categoryId: accounts.id, attrId: "balance", fn: "sum", includeAttrId: "liquid", unit: "$" },
    {
      id: uid("card-networth"),
      label: "Net worth",
      categoryId: accounts.id,
      attrId: "balance",
      fn: "sum",
      includeAttrId: "netWorth",
      unit: "$",
      subtract: { categoryId: debts.id, attrId: "balance", includeAttrId: "netWorth" },
    },
    { id: uid("card-expected"), label: "Expected spend", categoryId: expected.id, attrId: "amount", fn: "sum", includeAttrId: "include", unit: "$" },
    { id: uid("card-payments"), label: "Monthly payments", categoryId: payments.id, attrId: "amount", fn: "sum", includeAttrId: "include", unit: "$" },
    { id: uid("card-debts"), label: "Total debts", categoryId: debts.id, attrId: "balance", fn: "sum", unit: "$" },
  ]

  const module: ModuleInstance = {
    id: uid("module"),
    type: "workspace",
    kind: "workspace",
    title: "Budget",
    description: "Accounts, payments, debts, and expected spend — with optional-inclusion rollups.",
    templateId: "budget",
    config: {},
    views: [
      view("dashboard", "Overview", { cards }, uid),
      view("spreadsheet", "Accounts", { categoryId: accounts.id }, uid),
      view("spreadsheet", "Monthly Payments", { categoryId: payments.id }, uid),
      view("summary", "Payments by status", { categoryId: payments.id, groupAttrId: "paid", valueAttrId: "amount" }, uid),
      view("spreadsheet", "Debts", { categoryId: debts.id }, uid),
      view("spreadsheet", "Expected Spend", { categoryId: expected.id }, uid),
    ],
  }

  return { lists: [accounts, payments, debts, expected], seedTasks, module }
}

function buildBookTasting(uid: Uid): BuiltModuleTemplate {
  const books = makeCategory(uid, "Reading List", {
    color: "#b45309",
    itemLabel: "book",
    description: "Books you want to read; PDFs get matched and linked to these.",
    attributes: [
      attr("author", "Author", "string"),
      attr("status", "Status", "selection", { optionSource: "manual", options: ["to-read", "reading", "read", "abandoned"] }),
    ],
    displayedAttributes: ["author", "status"],
    defaultAttributeValues: { status: "to-read" },
  })

  const pdfs = makeCategory(uid, "PDF Shelf", {
    color: "#475569",
    itemLabel: "PDF",
    description: "Attached PDFs whose extracted text is matched to a book.",
    attributes: [
      attr("file", "File", "file"),
      attr("matchedBook", "Matched book", "string"),
    ],
    displayedAttributes: ["matchedBook"],
  })

  const seedTasks: Task[] = [
    seed(books, "The Left Hand of Darkness", { author: "Ursula K. Le Guin", status: "to-read" }),
    seed(books, "Dune", { author: "Frank Herbert", status: "reading" }),
    seed(books, "The Three-Body Problem", { author: "Liu Cixin", status: "to-read" }),
    seed(books, "Project Hail Mary", { author: "Andy Weir", status: "read" }),
    seed(books, "Kindred", { author: "Octavia E. Butler", status: "to-read" }),
    seed(books, "Annihilation", { author: "Jeff VanderMeer", status: "to-read" }),
    seed(pdfs, "left-hand-of-darkness.pdf", {
      file: fileSeed(
        uid,
        "left-hand-of-darkness.pdf",
        "The Left Hand of Darkness. I will make my report as if I told a story, for I was taught as a child on my homeworld that Truth is a matter of the imagination. Winter, the planet of Gethen.",
      ),
    }),
    seed(pdfs, "dune-excerpt.pdf", {
      file: fileSeed(
        uid,
        "dune-excerpt.pdf",
        "Dune, by Frank Herbert. A beginning is the time for taking the most delicate care that the balances are correct. Paul Atreides on the desert planet Arrakis, the spice melange, the Fremen.",
      ),
    }),
    seed(pdfs, "three-body.pdf", {
      file: fileSeed(
        uid,
        "three-body.pdf",
        "The Three-Body Problem. During the Cultural Revolution, an astrophysicist makes contact. The chaotic and stable eras of a world with three suns; the sophons and the dark forest.",
      ),
    }),
    seed(pdfs, "unknown-scan.pdf", {
      file: fileSeed(uid, "unknown-scan.pdf", "Quarterly tax worksheet — receipts, mileage log, and deductions for fiscal year. No literary content here."),
    }),
  ]

  const moduleId = uid("module")
  const module: ModuleInstance = {
    id: moduleId,
    type: "workspace",
    kind: "workspace",
    title: "Book Tasting",
    description: "Match PDFs to books, then taste them: guess the title from a random snippet.",
    templateId: "book-tasting",
    config: {},
    views: [
      view("spreadsheet", "Reading List", { categoryId: books.id }, uid),
      view(
        "matcher",
        "Match PDFs → books",
        { categoryId: pdfs.id, matchTargetCategoryId: books.id, matchTextAttrId: "file", linkRelation: "about" },
        uid,
      ),
      view(
        "quiz",
        "Taste a book",
        { categoryId: books.id, quizSourceCategoryId: pdfs.id, fileAttrId: "file", matchTextAttrId: "file", quizChoiceCount: 4 },
        uid,
      ),
    ],
  }

  const workflows: WorkflowDefinition[] = [
    workflow(uid, moduleId, "On PDF added → match to a book, else flag", {
      scope: { listIds: [pdfs.id] },
      trigger: { kind: "item", event: "create" },
      conditions: [{ field: "matchedBook", operator: "empty" }],
      actions: [{ kind: "throw", message: "No matching book found — link this PDF in the Matcher view." }],
    }),
  ]

  return { lists: [books, pdfs], seedTasks, module, workflows }
}

function buildFilmRecs(uid: Uid): BuiltModuleTemplate {
  const shelfOptions = [...FILMRECS_SHELVES]
  const films = makeCategory(uid, "Films", {
    color: "#ff8000",
    itemLabel: "film",
    description: "Letterboxd watchlist + likes catalog for Film DNA Lab.",
    icon: "clapperboard",
    attributes: [
      attr("year", "Year", "number"),
      attr("shelf", "Shelf", "selection", { optionSource: "manual", options: shelfOptions }),
      attr("source", "Source", "selection", {
        optionSource: "manual",
        options: ["watchlist", "likes", "both", "watched", "added"],
      }),
      attr("liked", "Liked", "boolean", { booleanDisplay: "checkbox" }),
      attr("favorited", "Favorited", "boolean", { booleanDisplay: "checkbox" }),
      attr("rating", "Rating", "number", { allowFloat: true }),
      attr("genres", "Genres", "multistring"),
      attr("poster", "Poster", "image"),
      attr("letterboxdUrl", "Letterboxd", "string"),
      attr("overview", "Overview", "string"),
      attr("watchedDate", "Watched", "string"),
    ],
    displayedAttributes: ["year", "shelf", "source", "liked", "rating", "poster"],
    defaultAttributeValues: { liked: false, favorited: false, source: "watchlist" },
  })

  const seedFilms = (filmrecsSeed.films as SeedFilm[]) || []
  const seedTasks: Task[] = seedFilms.map((f) => seedFilmToTask(films, f))

  const moduleId = uid("module")
  const module: ModuleInstance = {
    id: moduleId,
    type: "workspace",
    kind: "workspace",
    title: "Film DNA Lab",
    description: "Letterboxd taste map — DNA shelves, Watch ranking, Blend, and CSV import.",
    templateId: "filmrecs",
    icon: "clapperboard",
    config: { filmsCategoryId: films.id },
    views: [
      view("film-dna", "Film DNA", { categoryId: films.id }, uid),
      view("spreadsheet", "Films", { categoryId: films.id }, uid),
      view("gallery", "Posters", { categoryId: films.id }, uid),
      view("randomizer", "Pick something", { categoryId: films.id, pickCount: 1, framing: "Watch" }, uid),
      view("summary", "By shelf", { categoryId: films.id, groupAttrId: "shelf" }, uid),
    ],
  }

  return { lists: [films], seedTasks, module }
}

function buildBlank(uid: Uid): BuiltModuleTemplate {
  const list = makeCategory(uid, "New List", {
    color: "#64748b",
    itemLabel: "item",
    attributes: [attr("notes", "Notes", "string")],
    displayedAttributes: ["notes"],
  })
  const module: ModuleInstance = {
    id: uid("module"),
    type: "workspace",
    kind: "workspace",
    title: "New Workspace",
    description: "",
    templateId: "blank",
    config: {},
    views: [view("spreadsheet", "Sheet", { categoryId: list.id }, uid)],
  }
  return { lists: [list], seedTasks: [], module }
}

/** Pure: build all data for a template without touching any store. */
export function buildModuleTemplate(id: ModuleTemplateId, seedNum = Date.now()): BuiltModuleTemplate {
  const uid = makeUid(seedNum)
  switch (id) {
    case "itinerary":
      return buildItinerary(uid)
    case "cleaning":
      return buildCleaning(uid)
    case "budget":
      return buildBudget(uid)
    case "book-tasting":
      return buildBookTasting(uid)
    case "filmrecs":
      return buildFilmRecs(uid)
    case "blank":
    default:
      return buildBlank(uid)
  }
}

/** Commit a template to the stores and return the new workspace module id. */
export function instantiateModuleTemplate(id: ModuleTemplateId): string {
  const built = buildModuleTemplate(id)
  const taskStore = useTaskStore.getState()
  built.lists.forEach((c) => taskStore.addList(c))
  built.seedTasks.forEach((t) => taskStore.addTask(t))
  useModulesStore.getState().addModuleInstance(built.module)
  built.workflows?.forEach((w) => useWorkflowsStore.getState().addWorkflowDefinition(w))
  return built.module.id
}
