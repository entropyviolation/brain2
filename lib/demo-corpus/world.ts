/**
 * lib/demo-corpus/world.ts — Invented items, lists, and the link graph
 *
 * Cedar Stacks library, a kiln, a letterpress, a short trip. The shapes match
 * what a lived-in vault holds — nested folders, linked lists, operations with
 * parts, books, flights, films, places, furniture, shopping, sources and
 * beliefs, logged actions, To Do marks, schedule history, subtasks, estimates —
 * and every proper name is fiction.
 */

import { addDays } from "date-fns"
import { BOOK_ATTR, BOOK_TYPE_ID } from "@/lib/book-types"
import { FURNITURE_ATTR, FURNITURE_TYPE_ID, RESOURCE_ATTR, RESOURCE_TYPE_ID, SHOPPING_ATTR, SHOPPING_TYPE_ID } from "@/lib/catalog-types"
import { formatLocalDateKey, getWeekDates, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import { FILM_ATTR } from "@/lib/filmrecs-types"
import { FLIGHT_ATTR, FLIGHT_TYPE_ID } from "@/lib/flight-types"
import { NOTE_ATTR, NOTE_TYPE_ID } from "@/lib/note-types"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { partFormulasAttribute, partInstancesAttribute } from "@/lib/operation-parts"
import { BELIEF_ATTR, BELIEF_TYPE_ID, SOURCE_ATTR, SOURCE_TYPE_ID } from "@/lib/second-brain-types"
import type { AttributeDefinition, Folder, List, Task } from "@/lib/types"

function ymd(date: Date): string {
  return formatLocalDateKey(date)
}

function row(partial: Partial<Task> & Pick<Task, "id" | "description">, now: Date): Task {
  const createdAt = partial.createdAt instanceof Date ? partial.createdAt : now
  const task: Task = {
    stage: "clarified",
    estimatedDuration: 45,
    cognitiveLoad: 2,
    urgency: 3,
    importance: 3,
    dependencies: [],
    context: "@anywhere",
    entropy: 0.2,
    rewardValue: 20,
    completed: false,
    lists: [],
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    type: "task",
    ...partial,
    createdAt,
  }
  task.title = task.title ?? task.description
  return task
}

const FILM_ATTRS: AttributeDefinition[] = [
  { id: FILM_ATTR.year, name: "Year", type: "number", allowFloat: false },
  { id: FILM_ATTR.shelf, name: "Shelf", type: "string" },
  { id: FILM_ATTR.liked, name: "Liked", type: "boolean", booleanDisplay: "checkbox" },
  { id: FILM_ATTR.favorited, name: "Favorite", type: "boolean", booleanDisplay: "checkbox" },
  { id: FILM_ATTR.rating, name: "Rating", type: "number", allowFloat: true },
  { id: FILM_ATTR.genres, name: "Genres", type: "multistring" },
  { id: FILM_ATTR.overview, name: "Overview", type: "string" },
  { id: FILM_ATTR.watchedDate, name: "Watched", type: "string" },
]

const PLACE_ATTRS: AttributeDefinition[] = [
  { id: "placeKind", name: "Kind", type: "selection", optionSource: "manual", options: ["studio", "desk", "dock", "garden", "shop"] },
  { id: "city", name: "City", type: "string" },
  { id: "address", name: "Address", type: "string" },
  { id: "lat", name: "Latitude", type: "number", allowFloat: true },
  { id: "lng", name: "Longitude", type: "number", allowFloat: true },
  { id: "notes", name: "Notes", type: "string" },
]

const TRIP_ATTRS: AttributeDefinition[] = [
  { id: "tripKind", name: "Kind", type: "selection", optionSource: "manual", options: ["hop", "day-stop", "stay"] },
  { id: "day", name: "Day", type: "string" },
  { id: "destination", name: "Destination", type: "string" },
  { id: "weather", name: "Weather", type: "string" },
]

export function extraLists(now: Date): List[] {
  const createdAt = now
  return [
    {
      id: "list-letterpress",
      name: "Letterpress",
      color: "#9a3412",
      description: "Fall hours poster and the Saturday broadside",
      createdAt,
      order: 20,
      parentListId: "list-studio",
      scheduleable: true,
      itemLabel: "pass",
      createdByModuleId: "demo-mod-studio",
    },
    {
      id: "list-films",
      name: "Friday pictures",
      color: "#be185d",
      description: "Fictional shelf. Attribute schema lives on the list.",
      createdAt,
      order: 21,
      scheduleable: false,
      itemLabel: "picture",
      itemAttributes: FILM_ATTRS,
      displayedAttributes: [FILM_ATTR.year, FILM_ATTR.shelf, FILM_ATTR.rating],
      enabledDisplays: ["default", "table", "spreadsheet"],
      detailsColumns: ["__field_name__", FILM_ATTR.year, FILM_ATTR.rating, FILM_ATTR.watchedDate],
      defaultView: {
        custom: true,
        density: "compact",
        extraAttributeIds: [FILM_ATTR.year, FILM_ATTR.shelf],
        show: { pip: true, type: true, attributeChips: true, date: false },
      },
    },
    {
      id: "list-places",
      name: "Places",
      color: "#0f766e",
      description: "Studios, docks, and desks River actually uses in this fiction",
      createdAt,
      order: 22,
      scheduleable: false,
      itemLabel: "place",
      itemAttributes: PLACE_ATTRS,
      displayedAttributes: ["placeKind", "city"],
    },
    {
      id: "list-shopping",
      name: "Clay & ink order",
      color: "#ca8a04",
      createdAt,
      order: 23,
      parentListId: "list-errands",
      scheduleable: true,
      itemTypeId: SHOPPING_TYPE_ID,
      itemLabel: "line",
      linkedTargetListIds: ["list-errands"],
    },
    {
      id: "list-furniture",
      name: "Studio furniture",
      color: "#78716c",
      createdAt,
      order: 24,
      parentListId: "list-house",
      itemTypeId: FURNITURE_TYPE_ID,
      itemLabel: "piece",
      scheduleable: false,
    },
    {
      id: "list-resources",
      name: "Manuals & links",
      color: "#4f46e5",
      createdAt,
      order: 25,
      parentListId: "list-research",
      itemTypeId: RESOURCE_TYPE_ID,
      itemLabel: "resource",
      scheduleable: false,
    },
  ]
}

export function extraFolders(now: Date): Folder[] {
  const createdAt = now
  return [
    {
      id: "folder-craft",
      name: "Craft",
      createdAt,
      parentFolderId: "folder-areas",
      listIds: ["list-letterpress", "list-furniture"],
      color: "#c2410c",
      description: "Things with dust on them",
    },
    {
      id: "folder-out",
      name: "Out",
      createdAt,
      parentFolderId: "folder-areas",
      listIds: ["list-places", "list-trips"],
      color: "#0f766e",
    },
    {
      id: "folder-shelf",
      name: "Shelf",
      createdAt,
      parentFolderId: "folder-craft",
      listIds: ["list-films", "list-resources"],
      color: "#7c3aed",
      description: "Nested under Craft on purpose, so the tree is three deep",
    },
  ]
}

const WEEK_OPEN = [
  "Confirm the Thursday bats are in the studio",
  "Pull the hold list before the desk opens",
  "Mix a test cup of the iron-black ink",
  "Call Northwind about the controller tracking number",
  "Set the fall-hours type and lock the chase",
  "Pack the glaze notebook for the Seattle hop",
  "Leave a basil start on the garden gate",
]

const WEEK_DONE = [
  "Stamped yesterday's returns",
  "Covered the clay and wiped the wheel",
  "Printed one proof of the broadside",
  "Walked the river path and logged the birds",
  "Filed the interlibrary slip",
  "Read the holds chapter aloud once",
  "Swept grog out of the splash pan",
]

/** A scheduled row for every day of this week, and a completion for today and earlier. */
export function weekCommitments(now: Date): Task[] {
  const today = ymd(now)
  const week = getWeekString(now)
  return getWeekDates(getWeekStartDate(now)).flatMap((day, index) => {
    const key = ymd(day)
    const future = key > today
    const open = row(
      {
        id: `demo-week-open-${key}`,
        description: WEEK_OPEN[index % WEEK_OPEN.length],
        lists: [index % 2 === 0 ? "list-work" : "list-studio", "list-letterpress"],
        scheduledDate: day,
        scheduledTime: index % 2 === 0 ? "11:15" : "16:00",
        scheduledWeek: week,
        estimatedDuration: 35 + index * 5,
        context: index % 2 === 0 ? "@work" : "@studio",
        todoMarks: index === 0 ? [{ period: "week", periodKey: week, required: true }] : [{ period: "day", periodKey: key, prioritized: true }],
        contributesToObjectiveIds: index % 2 === 0 ? ["demo-obj-7"] : ["demo-obj-1"],
      },
      now,
    )
    if (future) return [open]
    const finished = new Date(day)
    finished.setHours(16, 20 + index, 0, 0)
    const done = row(
      {
        id: `demo-week-done-${key}`,
        description: WEEK_DONE[index % WEEK_DONE.length],
        lists: ["list-work"],
        stage: "completed",
        status: "done",
        completed: true,
        completedDate: finished,
        startedAt: new Date(finished.getTime() - 40 * 60 * 1000),
        actualDuration: 40,
        scheduledDate: day,
        scheduledTime: "09:40",
        rewardValue: 15,
        context: "@work",
      },
      now,
    )
    return [open, done]
  })
}

export function extraTasks(now: Date): Task[] {
  const d = (n: number) => addDays(now, n)
  const week = getWeekString(now)
  const lastWeek = getWeekString(d(-7))
  return [
    row(
      {
        id: "demo-op-press",
        description: "Print the fall hours poster",
        type: OPERATION_TYPE_ID,
        lists: ["list-letterpress", "list-studio"],
        isSummary: true,
        importance: 4,
        urgency: 3,
        estimatedDuration: 240,
        parallelGroup: "fall-print",
        attributes: {
          [OPERATION_ATTR.mission]: "One poster on the door before the October class, and a broadside for the firing party.",
          [OPERATION_ATTR.stage]: "active",
          [OPERATION_ATTR.categories]: ["studio", "print"],
          [OPERATION_ATTR.homeNotes]: "Iron black first. The red is a second pass and can slip.",
          [OPERATION_ATTR.trackingTagIds]: ["tag-craft"],
          [OPERATION_ATTR.trackingPenId]: "act-press",
          [OPERATION_ATTR.taskListId]: "list-letterpress",
          ...partFormulasAttribute([
            {
              id: "f-broadside",
              name: "Broadside",
              parentFormulaId: null,
              stages: ["Set type", "Lock up", "Proof"],
              finishSteps: ["Hang a copy", "File the lockup notes"],
            },
            {
              id: "f-pass",
              name: "Color pass",
              parentFormulaId: "f-broadside",
              stages: ["Mix ink", "Print"],
              finishSteps: ["Wash the rollers"],
            },
          ]),
          ...partInstancesAttribute([
            {
              id: "p-hours",
              formulaId: "f-broadside",
              title: "Fall hours poster",
              parentInstanceId: null,
              ideas: [{ id: "idea-hours", text: "Leave a finger of margin for the door handle.", createdAt: now.toISOString() }],
            },
            {
              id: "p-black",
              formulaId: "f-pass",
              title: "Iron black pass",
              parentInstanceId: "p-hours",
              ideas: [{ id: "idea-black", text: "Too much varnish and it shines under the stacks lights.", createdAt: now.toISOString() }],
            },
          ]),
        },
        links: [
          { id: "lnk-press-phase-lock", relation: "has-phase", targetId: "demo-op-press-lock" },
          { id: "lnk-press-phase-ink", relation: "has-phase", targetId: "demo-op-press-ink" },
          { id: "lnk-press-part", relation: "has-part", targetId: "demo-op-press-black" },
          { id: "lnk-press-note", relation: "described-by", targetId: "demo-note-lockup" },
        ],
      },
      now,
    ),
    row(
      {
        id: "demo-op-press-lock",
        description: "Lock up the fall-hours chase",
        lists: ["list-letterpress"],
        parentTaskId: "demo-op-press",
        completed: true,
        completedDate: d(-2),
        status: "done",
        stage: "completed",
        actualDuration: 50,
        estimatedDuration: 60,
      },
      now,
    ),
    row(
      {
        id: "demo-op-press-ink",
        description: "Mix the iron-black and pull a proof",
        lists: ["list-letterpress"],
        parentTaskId: "demo-op-press",
        scheduledDate: d(1),
        scheduledTime: "13:00",
        estimatedDuration: 90,
        dependencies: ["demo-op-press-lock"],
        riskFlag: true,
        pertEstimate: { optimistic: 40, likely: 90, pessimistic: 150 },
        definitionOfDone: "One proof is dry, readable at arm's length, and photographed.",
        subtasks: [
          {
            id: "sub-ink-mix",
            description: "Weigh the iron oxide",
            completed: false,
            isMolecular: true,
            context: "Stay under 2% or the black goes brown.",
            estimatedDuration: 15,
          },
          {
            id: "sub-ink-pull",
            description: "Pull three proofs",
            completed: false,
            estimatedDuration: 40,
            subtasks: [
              { id: "sub-ink-pull-1", description: "First pull on scrap", completed: false, isMolecular: true, estimatedDuration: 10 },
              { id: "sub-ink-pull-2", description: "Second pull on the good sheet", completed: false, isMolecular: true, estimatedDuration: 10 },
            ],
          },
        ],
      },
      now,
    ),
    row(
      {
        id: "demo-op-press-black",
        description: "Iron black pass — print the edition",
        lists: ["list-letterpress"],
        parentTaskId: "demo-op-press",
        parallelGroup: "fall-print",
        dependencies: ["demo-op-press-ink"],
        estimatedDuration: 120,
        scheduledDate: d(2),
        scheduledTime: "10:00",
      },
      now,
    ),
    row(
      {
        id: "demo-book-manual",
        description: "Cedar Stacks Circulation Manual",
        type: BOOK_TYPE_ID,
        lists: ["list-reading"],
        stage: "list",
        attributes: {
          [BOOK_ATTR.author]: "Cedar Stacks staff (fiction)",
          [BOOK_ATTR.status]: "reading",
          [BOOK_ATTR.pageCount]: 180,
          [BOOK_ATTR.pagesRead]: 64,
        },
        links: [
          { id: "lnk-manual-note", relation: "mentioned-in", targetId: "demo-note-holds" },
          { id: "lnk-manual-belief", relation: "supports", targetId: "demo-belief-cadence", stance: "weak-support", weight: 0.4 },
        ],
        contributesToGoalIds: ["demo-goal-books"],
        contributesToObjectiveIds: ["demo-obj-4"],
      },
      now,
    ),
    row(
      {
        id: "demo-book-tide",
        description: "Glass Tide",
        type: BOOK_TYPE_ID,
        lists: ["list-reading"],
        stage: "list",
        attributes: {
          [BOOK_ATTR.author]: "N. Pell",
          [BOOK_ATTR.status]: "to-read",
          [BOOK_ATTR.pageCount]: 96,
          [BOOK_ATTR.pagesRead]: 0,
        },
        links: [{ id: "lnk-tide-film", relation: "adapted-as", targetId: "demo-film-tide" }],
      },
      now,
    ),
    row(
      {
        id: "demo-logged-pages",
        description: "Read 12 pages of Cedar Stacks Circulation Manual",
        type: "action",
        loggedAction: true,
        lists: ["list-reading"],
        stage: "completed",
        status: "done",
        completed: true,
        completedDate: d(-1),
        startedAt: new Date(d(-1).getTime() - 35 * 60 * 1000),
        actualDuration: 35,
        estimates: [
          {
            field: "actualDuration",
            kind: "rate",
            basis: "12 pages × about 3 minutes, from the reading pen",
            generatedAt: d(-1).toISOString(),
          },
        ],
        links: [{ id: "lnk-logged-book", relation: "logged-for", targetId: "demo-book-manual" }],
        contributesToGoalIds: ["demo-goal-books"],
      },
      now,
    ),
    row(
      {
        id: "demo-film-tide",
        description: "Glass Tide",
        type: "item",
        lists: ["list-films"],
        stage: "list",
        attributes: {
          [FILM_ATTR.year]: 1974,
          [FILM_ATTR.shelf]: "Ferry lights",
          [FILM_ATTR.liked]: true,
          [FILM_ATTR.favorited]: false,
          [FILM_ATTR.rating]: 4,
          [FILM_ATTR.genres]: ["drama"],
          [FILM_ATTR.overview]: "A night clerk and a ferry that only runs when the fog is thick. Invented for the demo shelf.",
          [FILM_ATTR.watchedDate]: ymd(d(-5)),
        },
        links: [{ id: "lnk-film-book", relation: "adapted-from", targetId: "demo-book-tide" }],
      },
      now,
    ),
    row(
      {
        id: "demo-film-catalog",
        description: "The Last Catalog Card",
        type: "item",
        lists: ["list-films"],
        stage: "list",
        attributes: {
          [FILM_ATTR.year]: 1982,
          [FILM_ATTR.shelf]: "Desk stories",
          [FILM_ATTR.liked]: true,
          [FILM_ATTR.favorited]: true,
          [FILM_ATTR.rating]: 5,
          [FILM_ATTR.genres]: ["comedy", "work"],
          [FILM_ATTR.overview]: "A cataloger refuses to retire the wooden drawer. Also invented.",
          [FILM_ATTR.watchedDate]: ymd(d(-1)),
        },
      },
      now,
    ),
    row(
      {
        id: "demo-place-stacks",
        description: "Cedar Stacks reading room",
        type: "item",
        lists: ["list-places"],
        stage: "list",
        attributes: {
          placeKind: "desk",
          city: "Portland",
          address: "1 Catalog Lane",
          lat: 45.515,
          lng: -122.678,
          notes: "North light until two. The oversize atlas shelf squeaks.",
        },
        links: [{ id: "lnk-place-work", relation: "where", targetId: "demo-na-catalog" }],
      },
      now,
    ),
    row(
      {
        id: "demo-place-kiln",
        description: "Kiln room",
        type: "item",
        lists: ["list-places"],
        stage: "list",
        attributes: {
          placeKind: "studio",
          city: "Portland",
          address: "8 Kiln Alley",
          lat: 45.523,
          lng: -122.641,
          notes: "Controller is still the old one. Photos live on the kiln note.",
        },
        links: [{ id: "lnk-place-op", relation: "site-of", targetId: "demo-op-kiln" }],
      },
      now,
    ),
    row(
      {
        id: "demo-place-ferry",
        description: "Elkhorn ferry dock",
        type: "item",
        lists: ["list-places"],
        stage: "list",
        attributes: {
          placeKind: "dock",
          city: "Portland",
          address: "Ferry Slip 2",
          lat: 45.548,
          lng: -122.699,
          notes: "Last boat is the midnight span on the location grid.",
        },
      },
      now,
    ),
    row(
      {
        id: "demo-flight-return",
        description: "SEA → PDX — hop home, with a Boise sit",
        type: FLIGHT_TYPE_ID,
        lists: ["list-trips"],
        scheduledDate: d(14),
        attributes: {
          [FLIGHT_ATTR.airline]: "Horizon",
          [FLIGHT_ATTR.flightNumber]: "QX 2208",
          [FLIGHT_ATTR.departureAirport]: "SEA",
          [FLIGHT_ATTR.arrivalAirport]: "PDX",
          [FLIGHT_ATTR.layovers]: ["BOI 0h55m"],
          [FLIGHT_ATTR.booked]: true,
          [FLIGHT_ATTR.cost]: 146,
          [FLIGHT_ATTR.bookingNumber]: "DEMO7H",
          [FLIGHT_ATTR.departureTime]: `${ymd(d(14))}T18:10`,
          [FLIGHT_ATTR.arrivalTime]: `${ymd(d(14))}T22:40`,
        },
        links: [
          { id: "lnk-flight-out", relation: "return-of", targetId: "demo-flight-pdx-sea" },
          { id: "lnk-flight-stop", relation: "visits", targetId: "demo-trip-stop" },
        ],
      },
      now,
    ),
    row(
      {
        id: "demo-trip-stop",
        description: "Boise sit — reread the glaze notes",
        type: "item",
        lists: ["list-trips"],
        stage: "list",
        attributes: {
          tripKind: "day-stop",
          day: "14",
          destination: "Boise gate",
          weather: "dry cold",
        },
        links: [{ id: "lnk-stop-note", relation: "pack", targetId: "demo-note-glaze" }],
      },
      now,
    ),
    row(
      {
        id: "demo-shop-ink",
        description: "Iron-black letterpress ink",
        type: SHOPPING_TYPE_ID,
        lists: ["list-shopping"],
        stage: "list",
        attributes: {
          [SHOPPING_ATTR.quantity]: 1,
          [SHOPPING_ATTR.purchased]: false,
          [SHOPPING_ATTR.store]: "Northwind",
          [SHOPPING_ATTR.price]: 18,
        },
        links: [{ id: "lnk-ink-press", relation: "needed-for", targetId: "demo-op-press" }],
      },
      now,
    ),
    row(
      {
        id: "demo-shop-grog",
        description: "Bag of grog",
        type: SHOPPING_TYPE_ID,
        lists: ["list-shopping"],
        stage: "list",
        completed: true,
        status: "done",
        completedDate: d(-4),
        attributes: {
          [SHOPPING_ATTR.quantity]: 1,
          [SHOPPING_ATTR.purchased]: true,
          [SHOPPING_ATTR.store]: "Clay co-op",
          [SHOPPING_ATTR.price]: 22.5,
        },
      },
      now,
    ),
    row(
      {
        id: "demo-furn-wheel",
        description: "Second-hand wheel",
        type: FURNITURE_TYPE_ID,
        lists: ["list-furniture"],
        stage: "list",
        attributes: {
          [FURNITURE_ATTR.room]: "Wheel room",
          [FURNITURE_ATTR.width]: 28,
          [FURNITURE_ATTR.depth]: 28,
          [FURNITURE_ATTR.height]: 20,
          [FURNITURE_ATTR.notes]: "Splash pan still leaks on the left.",
        },
        links: [{ id: "lnk-wheel-place", relation: "stands-in", targetId: "demo-place-kiln" }],
      },
      now,
    ),
    row(
      {
        id: "demo-res-manual",
        description: "Kiln controller wiring sheet",
        type: RESOURCE_TYPE_ID,
        lists: ["list-resources"],
        stage: "list",
        attributes: {
          [RESOURCE_ATTR.url]: "https://cedarstacks.example/kiln-controller",
          [RESOURCE_ATTR.kind]: "article",
          [RESOURCE_ATTR.notes]: "Demo URL only. Photograph the old harness before trusting it.",
        },
        links: [{ id: "lnk-res-op", relation: "documents", targetId: "demo-op-kiln" }],
      },
      now,
    ),
    row(
      {
        id: "demo-note-lockup",
        description: "Lockup notes — fall hours",
        type: NOTE_TYPE_ID,
        lists: ["list-letterpress"],
        stage: "list",
        body: "<p>Furniture was short one 6-pt lead. The door poster needs a finger of margin on the handle side.</p><p>Proofs live in the studio drawer, not in the catalog cart.</p>",
        attributes: {
          [NOTE_ATTR.folder]: "Studio",
          [NOTE_ATTR.status]: "evergreen",
          [NOTE_ATTR.summary]: "Margin, leads, where the proofs live.",
          [NOTE_ATTR.fontFamily]: "Source Serif 4",
          [NOTE_ATTR.updatedAt]: now.toISOString(),
          cone: 6,
        },
        itemAttributeDefinitions: [
          { id: "cone", name: "Cone", type: "number", allowFloat: false },
        ],
        links: [
          { id: "lnk-lock-press", relation: "about", targetId: "demo-op-press" },
          { id: "lnk-lock-glaze", relation: "see-also", targetId: "demo-note-glaze" },
        ],
      },
      now,
    ),
    row(
      {
        id: "demo-note-holds",
        description: "Holds, recalls, and the squeaky atlas shelf",
        type: NOTE_TYPE_ID,
        lists: ["list-research"],
        stage: "list",
        body: "<p>Recalls go out before noon or they slip a day. The oversize atlas shelf squeaks; that is not a metaphor, it is a work order.</p>",
        attributes: {
          [NOTE_ATTR.folder]: "Desk",
          [NOTE_ATTR.status]: "draft",
          [NOTE_ATTR.summary]: "Noon cutoff for recalls.",
          [NOTE_ATTR.fontFamily]: "Merriweather",
        },
        links: [
          { id: "lnk-holds-manual", relation: "cites", targetId: "demo-book-manual" },
          { id: "lnk-holds-place", relation: "set-at", targetId: "demo-place-stacks" },
        ],
      },
      now,
    ),
    row(
      {
        id: "demo-source-marathon",
        description: "A weekend marathon that did not stick",
        type: SOURCE_TYPE_ID,
        lists: ["list-research"],
        stage: "list",
        attributes: {
          [SOURCE_ATTR.content]: "One fourteen-hour throwing day produced bowls and a week of avoiding the wheel.",
          [SOURCE_ATTR.sourceType]: "report",
          [SOURCE_ATTR.origin]: "River's own class notebook (fiction)",
          [SOURCE_ATTR.trust]: 0.55,
          [SOURCE_ATTR.summaryShort]: "Intensity did not become a habit.",
          [SOURCE_ATTR.summaryLong]: "The bowls were fine. The following week the wheel sat covered. Cadence still looks stronger than the marathon.",
          [SOURCE_ATTR.usageHint]: "Use against the cadence belief, gently.",
          [SOURCE_ATTR.factCheckLevel]: 1,
          [SOURCE_ATTR.tags]: ["studio", "cadence"],
        },
        links: [{ id: "lnk-marathon-belief", relation: "refutes", targetId: "demo-belief-cadence", stance: "weak-refute", weight: 0.35 }],
      },
      now,
    ),
    row(
      {
        id: "demo-source-ferry",
        description: "Ferry timetable, winter card",
        type: SOURCE_TYPE_ID,
        lists: ["list-research"],
        stage: "list",
        attributes: {
          [SOURCE_ATTR.content]: "Last boat leaves Elkhorn at 23:10 and docks about forty minutes later.",
          [SOURCE_ATTR.sourceType]: "snippet",
          [SOURCE_ATTR.origin]: "Elkhorn winter card (fiction)",
          [SOURCE_ATTR.trust]: 0.9,
          [SOURCE_ATTR.summaryShort]: "23:10, about forty minutes.",
          [SOURCE_ATTR.factCheckLevel]: 2,
        },
        links: [{ id: "lnk-ferry-place", relation: "about", targetId: "demo-place-ferry" }],
      },
      now,
    ),
    row(
      {
        id: "demo-belief-margin",
        description: "A poster fails if the handle covers the hours",
        type: BELIEF_TYPE_ID,
        lists: ["list-research"],
        stage: "list",
        attributes: {
          [BELIEF_ATTR.statement]: "Leave a finger of margin or the door handle eats the closing time.",
          [BELIEF_ATTR.certainty]: 0.86,
          [BELIEF_ATTR.strength]: 0.5,
          [BELIEF_ATTR.presuppositions]: ["The poster hangs on the studio door", "The handle is on the right"],
          [BELIEF_ATTR.subjectTags]: ["print", "studio"],
          [BELIEF_ATTR.justification]: "Last October the handle covered 8pm. The lockup note says so.",
          [BELIEF_ATTR.locked]: false,
        },
        links: [
          { id: "lnk-margin-note", relation: "supported-by", targetId: "demo-note-lockup", stance: "strong-support", weight: 0.9 },
          { id: "lnk-margin-press", relation: "guides", targetId: "demo-op-press" },
        ],
      },
      now,
    ),
    row(
      {
        id: "demo-missed-bird",
        description: "Dawn bird count on the river path",
        lists: ["list-errands"],
        status: "missed",
        completed: false,
        missedAt: d(-3),
        stage: "clarified",
        deadline: d(-3),
        urgency: 2,
        importance: 2,
        notes: "Slept through it. The path is still there tomorrow.",
      },
      now,
    ),
    row(
      {
        id: "demo-partial-pages",
        description: "Write the firing-party invitation",
        lists: ["list-studio"],
        allowPartialCompletion: true,
        minimumChunkSize: 10,
        status: "partial",
        completed: false,
        estimatedDuration: 60,
        completedChunks: [
          { date: d(-2), duration: 15, notes: "Names only." },
          { date: d(-1), duration: 20, notes: "The sentence about extra bats." },
        ],
        timeLogs: [
          {
            id: "tl-invite-1",
            date: ymd(d(-1)),
            startTime: "21:00",
            endTime: "21:20",
            durationMinutes: 20,
            notes: "Stopped when the kettle went.",
            location: "Kitchen table",
            activityLabel: "Writing",
          },
        ],
        links: [{ id: "lnk-invite-class", relation: "announces", targetId: "demo-scheduled-class" }],
      },
      now,
    ),
    row(
      {
        id: "demo-deferred-tax",
        description: "Scan the insurance packet before mailing",
        lists: ["list-house"],
        status: "deferred",
        completed: false,
        deadline: d(2),
        dependencies: ["demo-overdue-tax"],
        schedulingConstraints: {
          canOnlyBeDoneAt: ["09:00", "16:00"],
          canOnlyBeDoneOnDays: ["tuesday", "thursday"],
          timeOfDayPreference: "morning",
          dayConstraints: "Needs the scanner, which lives at the desk.",
        },
        why: "The renewal is already late.",
        consequences: "The studio policy lapses if the scan never becomes a stamp.",
        dayRatings: {
          [ymd(now)]: { importance: 8, excitement: 2 },
          [ymd(d(-1))]: { importance: 7, excitement: 3 },
        },
        resistanceReadings: [
          { at: d(-1).toISOString(), value: 8, source: "morning-desktop" },
          { at: now.toISOString(), value: 6, source: "morning-desktop" },
        ],
      },
      now,
    ),
    row(
      {
        id: "demo-cancelled-fair",
        description: "Staff the cancelled craft-fair table",
        lists: ["list-someday"],
        status: "cancelled",
        completed: false,
        stage: "list",
        notes: "The fair moved to spring. Kept so the cancelled shape is in the vault.",
      },
      now,
    ),
    row(
      {
        id: "demo-repeat-rollers",
        description: "Oil the letterpress rollers",
        lists: ["list-letterpress"],
        isRepeated: true,
        repeatSettings: { type: "frequency", frequency: { times: 1, period: "week" }, completedCount: 1 },
        scheduledWeek: week,
        context: "@studio",
        estimatedDuration: 15,
      },
      now,
    ),
    row(
      {
        id: "demo-pushed-bird",
        description: "Reprint the bird-count card",
        lists: ["list-errands"],
        schedulePlacements: [
          { period: "week", value: lastWeek, resolved: "pushed" },
          { period: "day", value: ymd(d(-2)), resolved: "discarded" },
          { period: "week", value: week },
        ],
        daysPushed: 1,
        weeksPushed: 1,
        scheduledWeek: week,
        autoPush: true,
        notes: "Last week it was pushed. Tuesday it was discarded from that day and kept on the week.",
      },
      now,
    ),
    row(
      {
        id: "demo-monkey-glaze",
        description: "Buy every celadon variant the co-op has",
        stage: "inbox",
        monkeyBrain: true,
        lists: [],
        urgency: 1,
        importance: 1,
        notes: "Monkey-brain capture. Not a plan.",
      },
      now,
    ),
    row(
      {
        id: "demo-people-mara",
        description: "Mara Quill — reference desk, trades tide charts for clay",
        lists: ["list-people"],
        stage: "list",
        type: "item",
        context: "@people",
        links: [
          { id: "lnk-mara-sam", relation: "knows", targetId: "demo-people-sam" },
          { id: "lnk-mara-ferry", relation: "showed", targetId: "demo-place-ferry" },
        ],
      },
      now,
    ),
    row(
      {
        id: "demo-people-juniper",
        description: "Juniper Moss — Thursday class, always short a bat",
        lists: ["list-people"],
        stage: "list",
        type: "item",
        links: [{ id: "lnk-juniper-class", relation: "attends", targetId: "demo-scheduled-class" }],
      },
      now,
    ),
  ]
}

/** Attach graph edges and week marks onto rows the base seed already created. */
export function deepenBaseTasks(tasks: Task[], now: Date): Task[] {
  const week = getWeekString(now)
  const today = ymd(now)
  return tasks.map((task) => {
    if (task.id === "demo-belief-cadence") {
      return {
        ...task,
        links: [
          { id: "lnk-cadence-leach", relation: "supported-by", targetId: "demo-source-leach", stance: "strong-support" as const, weight: 0.8 },
          { id: "lnk-cadence-marathon", relation: "refuted-by", targetId: "demo-source-marathon", stance: "weak-refute" as const, weight: 0.35 },
          { id: "lnk-cadence-manual", relation: "supported-by", targetId: "demo-book-manual", stance: "weak-support" as const, weight: 0.4 },
        ],
      }
    }
    if (task.id === "demo-note-glaze") {
      return {
        ...task,
        links: [
          { id: "lnk-glaze-op", relation: "about", targetId: "demo-op-kiln" },
          { id: "lnk-glaze-lock", relation: "see-also", targetId: "demo-note-lockup" },
        ],
        itemAttributeDefinitions: [
          { id: "iron", name: "Iron oxide %", type: "number", allowFloat: true },
        ],
        attributes: { ...task.attributes, iron: 1.8 },
      }
    }
    if (task.id === "demo-op-kiln") {
      return {
        ...task,
        isSummary: true,
        links: [
          { id: "lnk-kiln-photo", relation: "has-phase", targetId: "demo-op-phase-photos" },
          { id: "lnk-kiln-order", relation: "has-phase", targetId: "demo-op-phase-order" },
          { id: "lnk-kiln-install", relation: "has-phase", targetId: "demo-op-phase-install" },
          { id: "lnk-kiln-place", relation: "sited-at", targetId: "demo-place-kiln" },
          { id: "lnk-kiln-res", relation: "uses", targetId: "demo-res-manual" },
        ],
      }
    }
    if (task.id === "demo-na-catalog") {
      return {
        ...task,
        todoMarks: [{ period: "day", periodKey: today, required: true }, { period: "week", periodKey: week, prioritized: true }],
        contributesToObjectiveIds: ["demo-obj-7"],
        dayRatings: { [today]: { importance: 9, excitement: 5 } },
        links: [{ id: "lnk-catalog-place", relation: "done-at", targetId: "demo-place-stacks" }],
      }
    }
    if (task.id === "demo-op-phase-install") {
      return {
        ...task,
        dependencies: ["demo-op-phase-order", "demo-waiting-parts"],
        riskFlag: true,
        pertEstimate: { optimistic: 90, likely: 180, pessimistic: 300 },
        definitionOfDone: "Controller powers, a dry fire holds cone 06, photos filed on the kiln note.",
      }
    }
    if (task.id === "demo-done-newsletter") {
      return {
        ...task,
        stage: "completed" as const,
        status: "done" as const,
        completionReview: {
          taskId: "demo-done-newsletter",
          completedAt: task.completedDate instanceof Date ? task.completedDate : now,
          actualDuration: 70,
          satisfaction: 7,
          resistance: 4,
          focus: 6,
          distraction: 5,
          notes: "Caption took longer than the send.",
        },
      }
    }
    if (task.id === "demo-book-leach") {
      return {
        ...task,
        links: [{ id: "lnk-leach-source", relation: "excerpted-as", targetId: "demo-source-leach" }],
        contributesToGoalIds: ["demo-goal-books"],
      }
    }
    if (task.id === "demo-scheduled-class") {
      return {
        ...task,
        schedulingConstraints: {
          canOnlyBeDoneOnDays: ["thursday"],
          timeOfDayPreference: "evening",
          canOnlyBeDoneAt: ["18:30"],
        },
        links: [{ id: "lnk-class-juniper", relation: "expects", targetId: "demo-people-juniper" }],
      }
    }
    return task
  })
}

export function deepenLists(lists: List[]): List[] {
  return lists.map((list) => {
    if (list.id === "list-studio") {
      return { ...list, checklistCheckboxVars: ["completed", "missed"] }
    }
    if (list.id === "list-reading") {
      return { ...list, linkedTargetListIds: ["list-research"] }
    }
    if (list.id === "list-trips") {
      return { ...list, itemAttributes: TRIP_ATTRS, itemLabel: "leg" }
    }
    return list
  })
}
