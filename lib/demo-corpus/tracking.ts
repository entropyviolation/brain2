/**
 * lib/demo-corpus/tracking.ts — Demo pens and painted time
 *
 * Extends the stock Activity / Location / Company / Screen Time wells with a
 * nested craft tree, variants, a standing cross-scope link, and an action
 * template. Entries then exercise the block shapes the grid actually stores:
 * titles, notes, projects, books and pages, variants, secondary pens, instants
 * bound to an interval, a scissors split, a midnight span, estimated strokes,
 * generated screen-time, and a call/text ping.
 *
 * Every name is invented for River Hale's library-and-kiln week.
 */

import { addDays } from "date-fns"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { untrackedNoteKey, type TimeEntry } from "@/lib/time-entries"
import type { TrackPen, TrackScope, TrackTag } from "@/lib/time-tracking-store"
import { serializeAppendLog } from "@/lib/append-log"

const ACTIVITY_PENS: TrackPen[] = [
  {
    id: "act-library",
    name: "Library desk",
    color: "#0ea5e9",
    parentId: "act-work",
    tags: ["tag-work"],
    variantLabel: "Which desk?",
    variants: [
      { id: "var-returns", name: "Returns", color: "#38bdf8" },
      { id: "var-reference", name: "Reference", color: "#0369a1" },
    ],
  },
  {
    id: "act-catalog",
    name: "Cataloging",
    color: "#0284c7",
    parentId: "act-library",
    tags: ["tag-work"],
  },
  {
    id: "act-studio",
    name: "Studio",
    color: "#f97316",
    parentId: "act-work",
    tags: ["tag-work", "tag-craft"],
  },
  {
    id: "act-wheel",
    name: "Wheel",
    color: "#ea580c",
    parentId: "act-studio",
    tags: ["tag-craft"],
    variantLabel: "Which pass?",
    variants: [
      { id: "var-center", name: "Centering" },
      { id: "var-pull", name: "Pulling walls" },
      { id: "var-trim", name: "Trimming" },
    ],
  },
  {
    id: "act-glaze",
    name: "Glaze tests",
    color: "#c2410c",
    parentId: "act-studio",
    tags: ["tag-craft"],
  },
  {
    id: "act-press",
    name: "Letterpress",
    color: "#9a3412",
    parentId: "act-studio",
    tags: ["tag-craft"],
  },
  {
    id: "act-reading",
    name: "Reading",
    color: "#a855f7",
    tags: ["tag-reading"],
    actionFormats: [{ id: "fmt-read", template: "Read {pages} pages of {books}" }],
  },
  {
    id: "act-walk",
    name: "Walk",
    color: "#d97706",
    parentId: "act-exercise",
    tags: ["tag-exercise"],
    variantLabel: "Which loop?",
    variants: [
      { id: "var-river", name: "River path" },
      { id: "var-stacks", name: "Around the stacks" },
    ],
    actionFormats: [{ id: "fmt-walk", template: "Walked {minutes} minutes along {location}" }],
  },
  { id: "act-bread", name: "Bread", color: "#eab308", parentId: "act-chores", tags: ["tag-cleaning"] },
  { id: "act-mend", name: "Mending", color: "#8b5cf6", parentId: "act-chores", tags: ["tag-cleaning"] },
]

const LOCATION_PENS: TrackPen[] = [
  { id: "loc-stacks", name: "Cedar Stacks", color: "#0369a1", parentId: "loc-work", tags: ["tag-work"] },
  {
    id: "loc-kiln-room",
    name: "Kiln room",
    color: "#c2410c",
    parentId: "loc-home",
    tags: ["tag-craft"],
    links: [
      { scopeId: "activity", penId: "act-glaze" },
      { scopeId: "company", penId: "co-alone" },
    ],
  },
  { id: "loc-wheel-room", name: "Wheel room", color: "#ea580c", parentId: "loc-home" },
  { id: "loc-ferry", name: "Elkhorn ferry", color: "#0f766e", parentId: "loc-transit" },
  { id: "loc-coop", name: "Clay co-op", color: "#ca8a04", parentId: "loc-out" },
]

const SCREEN_PENS: TrackPen[] = [
  { id: "st-cedar-cat", name: "CedarCat", color: "#2563eb", parentId: "st-cat-work" },
  { id: "st-tide", name: "Tide charts", color: "#0ea5e9", parentId: "st-cat-browsing" },
  { id: "st-wheel-cam", name: "Wheel cam", color: "#8b5cf6", parentId: "st-cat-media" },
]

const CALL_PENS: TrackPen[] = [{ id: "iphone-call-desk", name: "Circulation desk", color: "#0ea5e9" }]
const TEXT_PENS: TrackPen[] = [{ id: "iphone-text-juniper", name: "Juniper Moss", color: "#ec4899" }]

function ymd(date: Date): string {
  return formatLocalDateKey(date)
}

function appendPens(scope: TrackScope, pens: TrackPen[]): TrackScope {
  const known = new Set(scope.pens.map((pen) => pen.id))
  return { ...scope, pens: [...scope.pens, ...pens.filter((pen) => !known.has(pen.id))] }
}

/** Stock scopes plus the demo craft tree. Unknown scopes pass through. */
export function withDemoPens(scopes: TrackScope[]): TrackScope[] {
  return scopes.map((scope) => {
    if (scope.id === "activity") return appendPens(scope, ACTIVITY_PENS)
    if (scope.id === "location") return appendPens(scope, LOCATION_PENS)
    if (scope.id === "screentime") return appendPens(scope, SCREEN_PENS)
    if (scope.id === "iphone-calls") return appendPens(scope, CALL_PENS)
    if (scope.id === "iphone-texts") return appendPens(scope, TEXT_PENS)
    if (scope.id === "company") {
      return {
        ...scope,
        pens: scope.pens.map((pen) =>
          pen.id === "co-talking"
            ? {
                ...pen,
                variants: pen.variants?.length
                  ? pen.variants
                  : [
                      { id: "var-mara", name: "Mara Quill" },
                      { id: "var-juniper", name: "Juniper Moss" },
                      { id: "var-theo", name: "Theo Lang" },
                      { id: "var-sam", name: "Sam Okonkwo" },
                    ],
              }
            : pen,
        ),
      }
    }
    return scope
  })
}

export function demoTags(tags: TrackTag[]): TrackTag[] {
  const extra: TrackTag[] = [
    { id: "tag-craft", name: "Craft", color: "#f97316" },
    { id: "tag-reading", name: "Reading", color: "#a855f7" },
  ]
  const known = new Set(tags.map((tag) => tag.id))
  return [...tags, ...extra.filter((tag) => !known.has(tag.id))]
}

export interface DemoTracking {
  entries: TimeEntry[]
  dayNotes: Record<string, string>
  untrackedNotes: Record<string, string>
}

/**
 * Rich blocks in the gaps the uniform seed leaves open (morning, lunch, evening),
 * plus one textured pair on every day of the current week.
 */
export function demoTracking(now: Date): DemoTracking {
  const entries: TimeEntry[] = []
  const day = (n: number) => ymd(addDays(now, n))
  const spanFrom = day(-4)
  const spanTo = day(-3)

  for (let i = 14; i >= 0; i--) {
    const date = day(-i)
    const weekend = addDays(now, -i).getDay() % 6 === 0
    entries.push({
      id: `demo-te-eve-${date}`,
      date,
      scopeId: "activity",
      penId: weekend ? "act-bread" : "act-reading",
      startMin: 19 * 60,
      endMin: 20 * 60 + 10,
      title: weekend ? "Loaf for the firing party" : "Circulation manual, holds chapter",
      notes: weekend ? "Started the poolish before dark." : "Stopped at the paragraph on recalls.",
      books: weekend ? undefined : "Cedar Stacks Circulation Manual",
      pages: weekend ? undefined : 8 + (i % 5),
      project: weekend ? "Firing party" : "Desk exam",
      precision: i % 4 === 0 ? "estimated" : "definite",
      tagIds: weekend ? ["tag-craft"] : ["tag-reading"],
    })
  }

  for (const date of getWeekDates(getWeekStartDate(now))) {
    const key = ymd(date)
    const future = key > ymd(now)
    entries.push(
      {
        id: `demo-te-week-a-${key}`,
        date: key,
        scopeId: "activity",
        penId: "act-wheel",
        startMin: 860,
        endMin: 940,
        variantIds: ["var-center", "var-pull"],
        title: future ? "Sketch: centering drill" : "Centering drill",
        notes: "Less water. Slow the wheel.",
        precision: future ? "estimated" : "definite",
        project: "October class",
      },
      {
        id: `demo-te-week-b-${key}`,
        date: key,
        scopeId: "location",
        penId: key.endsWith("6") || key.endsWith("1") ? "loc-ferry" : "loc-stacks",
        startMin: 1140,
        endMin: 1260,
        title: "After-desk stretch of the day",
        notes: "Companion to the activity block, not a copy of it.",
        precision: future ? "estimated" : "definite",
      },
    )
  }

  entries.push(
    {
      id: "demo-te-kettle",
      date: day(-1),
      scopeId: "activity",
      penId: "act-rest",
      kind: "instant",
      startMin: 7 * 60 + 5,
      endMin: 7 * 60 + 5,
      title: "Kettle click",
      notes: "The morning interval starts at this click.",
      precision: "definite",
    },
    {
      id: "demo-te-morning",
      date: day(-1),
      scopeId: "activity",
      penId: "act-catalog",
      startMin: 7 * 60 + 5,
      endMin: 8 * 60,
      startEventId: "demo-te-kettle",
      title: "Morning setup",
      notes: "Opened CedarCat, then the returns cart.",
      variantIds: ["var-returns"],
      precision: "definite",
    },
    {
      id: "demo-te-split-a",
      date: day(-6),
      scopeId: "activity",
      penId: "act-catalog",
      startMin: 960,
      endMin: 1020,
      splitAfter: true,
      title: "Catalog, first sitting",
      notes: "Scissors cut — this block must not merge into the next one.",
      precision: "definite",
    },
    {
      id: "demo-te-split-b",
      date: day(-6),
      scopeId: "activity",
      penId: "act-catalog",
      startMin: 1020,
      endMin: 1080,
      title: "Catalog, after the question at the desk",
      notes: "Same pen, next minute, kept apart on purpose.",
      precision: "definite",
    },
    {
      id: "demo-te-combo",
      date: day(-2),
      scopeId: "activity",
      penId: "act-wheel",
      secondaryPenIds: ["act-press"],
      startMin: 1240,
      endMin: 1320,
      variantIds: ["var-trim"],
      title: "Trim bowls while the press dries",
      notes: "One span, two pens: wheel is the color, letterpress still counts.",
      project: "Fall hours poster",
      precision: "definite",
    },
    {
      id: "demo-te-talk",
      date: day(-2),
      scopeId: "company",
      penId: "co-talking",
      startMin: 1240,
      endMin: 1320,
      variantIds: ["var-mara", "var-sam"],
      title: "Mara and Sam in the wheel room",
      notes: "Two people on one conversation. The parent span stays whole.",
      precision: "definite",
    },
    {
      id: `demo-te-span-a`,
      date: spanFrom,
      scopeId: "location",
      penId: "loc-ferry",
      startMin: 23 * 60 + 10,
      endMin: 24 * 60,
      spanId: "demo-span-ferry",
      title: "Last ferry",
      notes: "Continues after midnight as the same span.",
      precision: "estimated",
    },
    {
      id: `demo-te-span-b`,
      date: spanTo,
      scopeId: "location",
      penId: "loc-ferry",
      startMin: 0,
      endMin: 40,
      spanId: "demo-span-ferry",
      title: "Last ferry",
      notes: "Tail of the night before.",
      precision: "estimated",
    },
    {
      id: `demo-te-screen-${day(-1)}`,
      date: day(-1),
      scopeId: "screentime",
      penId: "st-cedar-cat",
      startMin: 10 * 60,
      endMin: 11 * 60 + 20,
      generatedBy: { kind: "screentime", id: day(-1) },
      title: "CedarCat",
      precision: "definite",
    },
    {
      id: `demo-te-tide-${ymd(now)}`,
      date: ymd(now),
      scopeId: "screentime",
      penId: "st-tide",
      startMin: 21 * 60,
      endMin: 21 * 60 + 15,
      generatedBy: { kind: "screentime", id: ymd(now) },
      title: "Tide charts",
      precision: "definite",
    },
    {
      id: "demo-te-call",
      date: ymd(now),
      scopeId: "iphone-calls",
      penId: "iphone-call-desk",
      kind: "instant",
      startMin: 15 * 60 + 10,
      endMin: 15 * 60 + 10,
      title: "Circulation desk",
      notes: "Asked whether the kiln manuals had landed.",
      precision: "definite",
    },
    {
      id: "demo-te-text",
      date: ymd(now),
      scopeId: "iphone-texts",
      penId: "iphone-text-juniper",
      kind: "instant",
      startMin: 18 * 60 + 5,
      endMin: 18 * 60 + 5,
      title: "Juniper Moss",
      notes: "“Bring the extra bats Thursday.”",
      precision: "definite",
    },
  )

  const yesterday = day(-1)
  const dayNotes: Record<string, string> = {
    [ymd(now)]: serializeAppendLog(
      [
        { id: "dn-1", createdAt: now.toISOString(), text: "Desk was loud until 11; deep work after lunch." },
        {
          id: "dn-2",
          createdAt: addDays(now, 0).toISOString(),
          text: "Kiln-room photos are in the note, not in the cart.",
        },
      ],
      "Still owe the insurance packet.",
    ),
    [yesterday]: serializeAppendLog(
      [
        {
          id: "dn-y",
          createdAt: addDays(now, -1).toISOString(),
          text: "Ferry ran late. The span on the location grid is that ride.",
        },
      ],
      "",
    ),
  }

  const gapDay = day(-6)
  const untrackedNotes = {
    [untrackedNoteKey(gapDay, "activity", 940, 960)]:
      "Stood at the desk window. Not sure it counts as a break or as waiting.",
  }

  return { entries, dayNotes, untrackedNotes }
}
