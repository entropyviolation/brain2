/**
 * lib/module-templates.ts — Pre-built "mini-app" module templates
 *
 * Turns a one-click choice ("Itinerary Creator", "House Cleaning", "Budget") into a
 * full workspace module: the supporting **lists** (lists) with their
 * **attribute schemas + defaults** (spec §5), a few seed items, and a
 * **workspace `ModuleInstance`** wiring those lists into bound views (editable
 * spreadsheet, agenda, rollup summary, gamified randomizer, focus timer,
 * checklist, notes).
 *
 * `buildModuleTemplate` is pure (data only, unit-testable). `instantiateModuleTemplate`
 * commits the result to the task + modules stores and returns the new module id.
 *
 * Budget and Book Tasting read lists, attributes, views, and workflows from
 * `lib/packages/golden/budget.json` and `book-tasting.json`. Sample rows
 * (including Book Tasting PDF text) and `templateId` stay in the builders.
 * Itinerary, Tidy, Film DNA, GradSearch, and Blank stay written here.
 */
import type { AttributeDefinition, AttributeValue, FileValue, Task, List, WorkflowDefinition } from "@/lib/types"
import type { DashboardCard, ModuleInstance, ModuleView, ModuleViewConfig, ModuleViewKind } from "@/lib/modules-store"
import { createListItem, withCategoryDefaults } from "@/lib/item-utils"
import { useTaskStore } from "@/lib/task-store"
import { useModulesStore } from "@/lib/modules-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import { addModuleCreatedLists, taskStoreModuleListsMutators } from "@/lib/module-lists"
import { syncModuleListContents } from "@/lib/module-list-import"
import { FILMRECS_SHELVES } from "@/lib/filmrecs-types"
import { FILM_TYPE_ID } from "@/lib/film-types"
import { seedFilmToTask, type SeedFilm } from "@/lib/filmrecs-catalog"
import filmrecsSeed from "@/lib/filmrecs-seed.json"
import budgetGoldenJson from "@/lib/packages/golden/budget.json"
import bookTastingGoldenJson from "@/lib/packages/golden/book-tasting.json"
import { seedHouseCleaning } from "@/lib/house-cleaning"

export type ModuleTemplateId =
  | "itinerary"
  | "house-cleaning"
  | "budget"
  | "book-tasting"
  | "filmrecs"
  | "gradsearch"
  | "blank"

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
    id: "house-cleaning",
    name: "House Cleaning App",
    description:
      "Tidy: areas with hierarchical chores, importance + estimates, a per-task timer, today’s goal, bulk paste, a Needed list, Stuck mode, and Bare-minimum / Goal / Exceptional plans.",
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
    id: "gradsearch",
    name: "GradSearch",
    description:
      "Graduate program explorer: search, filter, re-score, compare, favorite, hide, and verify every tracked program — the same explorer as the standalone GradSearch app, with its full catalog.",
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
    itemTypeId?: string
    itemTypeIds?: string[]
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
    itemTypeId: opts.itemTypeId,
    itemTypeIds: opts.itemTypeIds,
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

function buildHouseCleaning(uid: Uid): BuiltModuleTemplate {
  const moduleId = uid("module")
  const module: ModuleInstance = {
    id: moduleId,
    type: "workspace",
    kind: "workspace",
    title: "Tidy",
    description: "House cleaning tracker — pick an area, or start with one small task.",
    templateId: "house-cleaning",
    icon: "home",
    config: { houseCleaning: seedHouseCleaning() },
    views: [view("house-cleaning", "Tidy", {}, uid)],
  }
  return { lists: [], seedTasks: [], module }
}

/**
 * Shape of `lib/packages/golden/*.json` that Budget and Book Tasting read.
 * Slot roles stand in for list ids. The package schema has no seed items and
 * no `templateId`; those stay in the builders below.
 */
interface GoldenSlot {
  role: string
  name: string
  description?: string
  color?: string
  itemLabel?: string
  attributes?: AttributeDefinition[]
  displayedAttributes?: string[]
  defaultAttributeValues?: Record<string, AttributeValue>
}

interface GoldenView {
  title: string
  kind: ModuleViewKind
  slot?: string
  config?: ModuleViewConfig
}

interface GoldenWorkflow {
  name: string
  scope?: WorkflowDefinition["scope"]
  trigger: WorkflowDefinition["trigger"]
  conditions?: WorkflowDefinition["conditions"]
  actions: WorkflowDefinition["actions"]
  enabled?: boolean
}

interface GoldenPackage {
  id: string
  name: string
  description?: string
  slots: GoldenSlot[]
  views: GoldenView[]
  workflows?: GoldenWorkflow[]
}

/** List-id fields on a view config. Same set the package installer resolves. */
const GOLDEN_LIST_ROLE_FIELDS = [
  "categoryId",
  "matchTargetCategoryId",
  "quizSourceCategoryId",
  "daysCategoryId",
  "flightsCategoryId",
  "entriesCategoryId",
  "placesCategoryId",
] as const satisfies readonly (keyof ModuleViewConfig)[]

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function asGolden(value: unknown, id: ModuleTemplateId): GoldenPackage {
  if (!value || typeof value !== "object") throw new Error(`golden manifest "${id}" is not an object`)
  const pkg = value as GoldenPackage
  if (pkg.id !== id) throw new Error(`golden manifest id "${String(pkg.id)}" is not "${id}"`)
  if (!Array.isArray(pkg.slots) || pkg.slots.length === 0) throw new Error(`golden manifest "${id}" has no slots`)
  if (!Array.isArray(pkg.views) || pkg.views.length === 0) throw new Error(`golden manifest "${id}" has no views`)
  return pkg
}

function roleId(role: string, roles: Map<string, string>): string {
  const id = roles.get(role)
  if (!id) throw new Error(`golden manifest names unknown slot "${role}"`)
  return id
}

function listByRole(byRole: Map<string, List>, role: string): List {
  const list = byRole.get(role)
  if (!list) throw new Error(`golden manifest has no slot "${role}"`)
  return list
}

/** One fresh copy of the manifest's lists. Roles stay off the list records. */
function listsFromGolden(pkg: GoldenPackage, uid: Uid): { lists: List[]; byRole: Map<string, List> } {
  const byRole = new Map<string, List>()
  const lists = pkg.slots.map((slot) => {
    if (byRole.has(slot.role)) throw new Error(`golden manifest repeats slot "${slot.role}"`)
    const list: List = {
      id: uid(slug(slot.name)),
      name: slot.name,
      color: slot.color ?? "#64748b",
      description: slot.description,
      createdAt: new Date(),
      scheduleable: false,
      itemLabel: slot.itemLabel,
      itemAttributes: slot.attributes ? cloneJson(slot.attributes) : undefined,
      displayedAttributes: slot.displayedAttributes ? [...slot.displayedAttributes] : undefined,
      defaultAttributeValues: slot.defaultAttributeValues ? cloneJson(slot.defaultAttributeValues) : undefined,
    }
    byRole.set(slot.role, list)
    return list
  })
  return { lists, byRole }
}

function viewConfigFromGolden(entry: GoldenView, roles: Map<string, string>, uid: Uid): ModuleViewConfig {
  const config: ModuleViewConfig = entry.config ? cloneJson(entry.config) : {}
  if (entry.slot) config.categoryId = entry.slot
  for (const key of GOLDEN_LIST_ROLE_FIELDS) {
    const value = config[key]
    if (typeof value === "string" && value) config[key] = roleId(value, roles)
  }
  if (config.htmlListIds) {
    config.htmlListIds = config.htmlListIds.map((role) => roleId(role, roles))
  }
  if (config.cards) {
    config.cards = config.cards.map((card) => {
      const next: DashboardCard = {
        ...card,
        id: uid(`card-${card.id}`),
        categoryId: roleId(card.categoryId, roles),
      }
      if (card.subtract) {
        next.subtract = { ...card.subtract, categoryId: roleId(card.subtract.categoryId, roles) }
      }
      return next
    })
  }
  return config
}

function workflowFromGolden(
  wf: GoldenWorkflow,
  roles: Map<string, string>,
  moduleId: string,
  uid: Uid,
): WorkflowDefinition {
  const actions = wf.actions.map((action) => {
    const next = { ...action } as WorkflowDefinition["actions"][number] & {
      categoryId?: string
      fromCategoryId?: string
    }
    if (typeof next.categoryId === "string") next.categoryId = roleId(next.categoryId, roles)
    if (typeof next.fromCategoryId === "string") next.fromCategoryId = roleId(next.fromCategoryId, roles)
    return next
  })
  const def: Omit<WorkflowDefinition, "id" | "name" | "moduleId"> = {
    trigger: wf.trigger,
    conditions: wf.conditions ? cloneJson(wf.conditions) : undefined,
    actions,
    scope: wf.scope
      ? {
          ...wf.scope,
          listIds: wf.scope.listIds?.map((role) => roleId(role, roles)),
        }
      : undefined,
  }
  if (wf.enabled != null) def.enabled = wf.enabled
  return workflow(uid, moduleId, wf.name, def)
}

/**
 * Lists and views from the manifest. `templateId` is stamped here because the
 * package schema does not carry it. No `config.package` and no `moduleSlotId`:
 * this is a template build, and stored modules are not rewritten.
 */
function moduleFromGolden(
  pkg: GoldenPackage,
  templateId: ModuleTemplateId,
  uid: Uid,
  byRole: Map<string, List>,
): { module: ModuleInstance; workflows?: WorkflowDefinition[] } {
  if (pkg.id !== templateId) throw new Error(`golden manifest "${pkg.id}" cannot build "${templateId}"`)
  const roles = new Map([...byRole].map(([role, list]) => [role, list.id]))
  const moduleId = uid("module")
  const module: ModuleInstance = {
    id: moduleId,
    type: "workspace",
    kind: "workspace",
    title: pkg.name,
    description: pkg.description,
    templateId,
    config: {},
    views: pkg.views.map((entry) => view(entry.kind, entry.title, viewConfigFromGolden(entry, roles, uid), uid)),
  }
  const workflows = pkg.workflows?.map((wf) => workflowFromGolden(wf, roles, moduleId, uid))
  return workflows?.length ? { module, workflows } : { module }
}

const budgetGolden = asGolden(budgetGoldenJson, "budget")
const bookTastingGolden = asGolden(bookTastingGoldenJson, "book-tasting")

function buildBudget(uid: Uid): BuiltModuleTemplate {
  const { lists, byRole } = listsFromGolden(budgetGolden, uid)
  const accounts = listByRole(byRole, "accounts")
  const payments = listByRole(byRole, "payments")
  const debts = listByRole(byRole, "debts")
  const expected = listByRole(byRole, "expected")

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

  const { module } = moduleFromGolden(budgetGolden, "budget", uid, byRole)
  return { lists, seedTasks, module }
}

function buildBookTasting(uid: Uid): BuiltModuleTemplate {
  const { lists, byRole } = listsFromGolden(bookTastingGolden, uid)
  const books = listByRole(byRole, "books")
  const pdfs = listByRole(byRole, "pdfs")

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

  const { module, workflows } = moduleFromGolden(bookTastingGolden, "book-tasting", uid, byRole)
  return { lists, seedTasks, module, workflows }
}

function buildFilmRecs(uid: Uid): BuiltModuleTemplate {
  const shelfOptions = [...FILMRECS_SHELVES]
  const films = makeCategory(uid, "Films", {
    color: "#ff8000",
    itemLabel: "film",
    description: "Letterboxd watchlist + likes catalog for Film DNA Lab.",
    icon: "clapperboard",
    itemTypeId: FILM_TYPE_ID,
    itemTypeIds: [FILM_TYPE_ID],
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

function buildGradSearch(uid: Uid): BuiltModuleTemplate {
  const module: ModuleInstance = {
    id: uid("module"),
    type: "workspace",
    kind: "workspace",
    title: "GradSearch",
    description: "Graduate Program Explorer — search, score, compare, and verify.",
    templateId: "gradsearch",
    icon: "graduation-cap",
    config: {},
    views: [view("grad-search", "Explorer", {}, uid)],
  }
  return { lists: [], seedTasks: [], module }
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
    case "house-cleaning":
      return buildHouseCleaning(uid)
    case "budget":
      return buildBudget(uid)
    case "book-tasting":
      return buildBookTasting(uid)
    case "filmrecs":
      return buildFilmRecs(uid)
    case "gradsearch":
      return buildGradSearch(uid)
    case "blank":
    default:
      return buildBlank(uid)
  }
}

/** Commit a template to the stores and return the new workspace module id. */
export function instantiateModuleTemplate(id: ModuleTemplateId): string {
  const built = buildModuleTemplate(id)
  const taskStore = useTaskStore.getState()
  addModuleCreatedLists(taskStoreModuleListsMutators(), built.module, built.lists)
  built.seedTasks.forEach((t) => taskStore.addTask(t))
  useModulesStore.getState().addModuleInstance(built.module)
  built.workflows?.forEach((w) => useWorkflowsStore.getState().addWorkflowDefinition(w))
  const mut = taskStoreModuleListsMutators()
  syncModuleListContents(mut, useModulesStore.getState().modules)
  return built.module.id
}
