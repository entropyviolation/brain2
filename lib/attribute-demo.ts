/**
 * lib/attribute-demo.ts — One item that shows every attribute type
 *
 * Seeds an **Attribute Demo** list whose schema holds one attribute of every
 * canonical type (text, text list, link, number, goal, formula, yes/no,
 * single and multiple selection, color, date, time, date & time, image,
 * gallery, file, file list, item reference, list reference), plus one item on
 * it — "Cybernetics (attribute demo)" — with every value filled, one
 * item-only attribute, dated notes, and attached resources.
 *
 * Pictures come from the house orb / gem PNGs when the app can fetch them
 * (`public/`), else small drawn SVGs. The PDF and text files are generated.
 * Bytes go to the attachments IndexedDB like any upload. Re-running the seed
 * rewrites the same list and item ids, so it is safe to run twice.
 */
import type { AttributeDefinition, AttributeValue, FileValue, ItemNoteEntry, ItemResource, List, Task } from "@/lib/types"
import { localDayIso } from "@/lib/item-notes"

export const ATTRIBUTE_DEMO_LIST_ID = "demo-attribute-list"
export const ATTRIBUTE_DEMO_ITEM_ID = "demo-attribute-item"

/** Schema on the demo list: one attribute per type, grouped like the creator's palette. */
export const ATTRIBUTE_DEMO_SCHEMA: AttributeDefinition[] = [
  { id: "author", name: "Author", type: "string" },
  { id: "genres", name: "Genres", type: "multistring" },
  { id: "source_link", name: "Source link", type: "link" },
  { id: "publisher_phone", name: "Publisher phone", type: "phone" },
  { id: "price", name: "Price", type: "number", unit: "$", allowFloat: true },
  { id: "quantity", name: "Copies", type: "number", allowFloat: false },
  { id: "total", name: "Total spent", type: "formula", formula: "=price * quantity", formatAs: "currency" },
  { id: "pages", name: "Pages", type: "goal", labels: { current: "Read", target: "Pages" } },
  { id: "owned", name: "Owned", type: "boolean", booleanDisplay: "switch" },
  { id: "lent", name: "Lent out", type: "boolean", booleanDisplay: "checkbox" },
  {
    id: "status",
    name: "Status",
    type: "selection",
    optionSource: "manual",
    options: ["to-read", "reading", "read", "abandoned"],
  },
  {
    id: "shelves",
    name: "Shelves",
    type: "selection",
    optionSource: "manual",
    allowMultiple: true,
    options: ["Theory", "Favorites", "Lend out", "Annotate", "Reread"],
  },
  { id: "spine", name: "Spine color", type: "color" },
  { id: "started", name: "Started", type: "datetime", datetimeMode: "date" },
  { id: "reading_time", name: "Usual reading time", type: "datetime", datetimeMode: "time" },
  { id: "next_session", name: "Next session", type: "datetime", datetimeMode: "datetime" },
  { id: "cover", name: "Cover", type: "image" },
  { id: "gallery", name: "Marginalia photos", type: "multiimage" },
  { id: "scan", name: "Scanned chapter", type: "file" },
  { id: "extras", name: "Study files", type: "multifile" },
  { id: "related_book", name: "Read next", type: "item" },
  { id: "shelf_list", name: "Filed with", type: "list" },
]

/** The one attribute kept on the item only (shows the remove key). */
export const ATTRIBUTE_DEMO_ITEM_ONLY: AttributeDefinition[] = [{ id: "found_at", name: "Where I found it", type: "string" }]

const ORB_PNGS = ["/orbs-removebackground/0073f9caf9df33a0b24268e75bb4fa08.png"]
const GALLERY_PNGS = [
  "/gems-removebackground/0a86dbc1946d359b3aa1b1860fa5d27b.png",
  "/gems-removebackground/107e7775782a6d9ce53f38b426d92eb0.png",
  "/gems-removebackground/130ffa07906f77eda2d6e4d21dfe7f26.png",
]

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + days)
  return next
}

/** A drawn picture for when the house PNGs cannot be fetched (tests, offline). */
export function demoSvg(label: string, hue: number): Blob {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240" viewBox="0 0 320 240">
<defs><radialGradient id="g" cx="35%" cy="30%"><stop offset="0" stop-color="hsl(${hue},90%,88%)"/><stop offset="1" stop-color="hsl(${hue},70%,22%)"/></radialGradient></defs>
<rect width="320" height="240" fill="#070c0a"/>
<circle cx="160" cy="112" r="78" fill="url(#g)"/>
<text x="160" y="222" fill="#7dffc4" font-family="monospace" font-size="16" text-anchor="middle">${label}</text>
</svg>`
  return new Blob([svg], { type: "image/svg+xml" })
}

/** A one-page PDF with a few lines of text (valid xref, opens in any viewer). */
export function demoPdf(lines: string[]): Blob {
  const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")
  const text = lines.map((l, i) => `BT /F1 ${i === 0 ? 20 : 12} Tf 56 ${740 - i * 26} Td (${esc(l)}) Tj ET`).join("\n")
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ]
  let body = "%PDF-1.4\n"
  const offsets: number[] = []
  objects.forEach((obj, i) => {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`
  })
  const xrefAt = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const off of offsets) body += `${String(off).padStart(10, "0")} 00000 n \n`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  return new Blob([body], { type: "application/pdf" })
}

type StoreBlob = (id: string, blob: Blob, meta: { name: string; mime: string }) => Promise<string>

async function fetchBlob(path: string): Promise<Blob | null> {
  if (typeof fetch !== "function" || typeof window === "undefined") return null
  try {
    const res = await fetch(path)
    if (!res.ok) return null
    const blob = await res.blob()
    return blob.type.startsWith("image/") ? blob : null
  } catch {
    return null
  }
}

async function storeFile(put: StoreBlob, id: string, name: string, blob: Blob): Promise<FileValue> {
  const mime = blob.type || "application/octet-stream"
  const uri = await put(id, blob, { name, mime })
  return { id, name, mime, uri, size: blob.size }
}

export interface AttributeDemoAssets {
  cover: string
  gallery: string[]
  scan: FileValue
  extras: FileValue[]
  resources: ItemResource[]
}

/** Write the demo pictures and files to attachment storage. */
export async function storeAttributeDemoAssets(put: StoreBlob, now: Date = new Date()): Promise<AttributeDemoAssets> {
  const pic = async (id: string, path: string | undefined, label: string, hue: number) => {
    const fetched = path ? await fetchBlob(path) : null
    const blob = fetched ?? demoSvg(label, hue)
    const ext = blob.type === "image/svg+xml" ? "svg" : "png"
    return put(id, blob, { name: `${label}.${ext}`, mime: blob.type })
  }
  const cover = await pic("demo_attr_cover", ORB_PNGS[0], "cover", 160)
  const gallery = await Promise.all(
    GALLERY_PNGS.map((path, i) => pic(`demo_attr_gallery_${i}`, path, `margin-${i + 1}`, 40 + i * 90)),
  )
  const scan = await storeFile(
    put,
    "demo_attr_scan",
    "chapter-1-newtonian-and-bergsonian-time.pdf",
    demoPdf([
      "Attribute demo: Scanned chapter",
      "A generated one-page PDF so the File attribute has something to open.",
      "Replace it with a real scan from the File field.",
    ]),
  )
  const notes = await storeFile(
    put,
    "demo_attr_extras_notes",
    "reading-questions.txt",
    new Blob(
      ["Reading questions\n\n1. What is feedback, in my own words?\n2. Where does information differ from energy?\n3. Which loops in my week correct themselves?\n"],
      { type: "text/plain" },
    ),
  )
  const sheet = await storeFile(
    put,
    "demo_attr_extras_sheet",
    "chapter-pages.csv",
    new Blob(["chapter,pages\nIntroduction,39\nI,16\nII,17\nIII,16\n"], { type: "text/csv" }),
  )
  const ticket = await storeFile(
    put,
    "demo_attr_res_pdf",
    "library-receipt.pdf",
    demoPdf(["Library sale receipt", "Cybernetics, 2nd ed.   2 copies   $37.90", "Generated for the Resources demo."]),
  )
  const photoUri = await pic("demo_attr_res_photo", GALLERY_PNGS[1], "desk-photo", 280)
  const photo: FileValue = { id: "demo_attr_res_photo", name: "desk-photo.png", mime: "image/png", uri: photoUri }
  const at = (daysAgo: number) => addDays(now, -daysAgo).toISOString()
  return {
    cover,
    gallery,
    scan,
    extras: [notes, sheet],
    resources: [
      { ...ticket, addedAt: at(19), caption: "Receipt from the library sale" },
      { ...photo, addedAt: at(6), caption: "Where the book lives" },
      { ...notes, id: "demo_attr_res_txt", addedAt: at(2), caption: "Questions to answer before chapter III" },
    ],
  }
}

export function attributeDemoNotes(now: Date = new Date()): ItemNoteEntry[] {
  const day = (daysAgo: number) => localDayIso(addDays(now, -daysAgo))
  return [
    { id: "demo_note_1", date: day(19), time: "14:10", text: "Found two copies at the library sale. Took both: one to mark up, one to lend." },
    { id: "demo_note_2", date: day(6), time: "21:42", text: "Chapter I: Newtonian vs Bergsonian time. Reversible machines vs weather." },
    { id: "demo_note_3", date: day(0), time: "08:05", text: "Feedback = the output reports back to the input. Try mapping one habit loop this way." },
  ]
}

export function attributeDemoList(now: Date = new Date()): List {
  return {
    id: ATTRIBUTE_DEMO_LIST_ID,
    name: "Attribute Demo",
    color: "#7dffc4",
    description: "One attribute of every type. Open the demo item to see each editor.",
    createdAt: now,
    itemAttributes: ATTRIBUTE_DEMO_SCHEMA,
  }
}

export function attributeDemoItem(
  assets: AttributeDemoAssets,
  refs: { relatedItemId?: string; shelfListId?: string } = {},
  now: Date = new Date(),
): Task {
  const next = addDays(now, 2)
  const values: Record<string, AttributeValue> = {
    author: "Norbert Wiener",
    genres: ["cybernetics", "systems", "control theory"],
    publisher_phone: ["+16175551234"],
    source_link: "https://en.wikipedia.org/wiki/Cybernetics:_Or_Control_and_Communication_in_the_Animal_and_the_Machine",
    price: 18.95,
    quantity: 2,
    pages: { current: 112, target: 212 },
    owned: true,
    lent: false,
    status: "reading",
    shelves: ["Theory", "Annotate"],
    spine: "#000080",
    started: localDayIso(addDays(now, -19)),
    reading_time: "21:30",
    next_session: `${localDayIso(next)}T21:30`,
    cover: assets.cover,
    gallery: assets.gallery,
    scan: assets.scan,
    extras: assets.extras,
    found_at: "Library sale, back table",
  }
  if (refs.relatedItemId) values.related_book = refs.relatedItemId
  if (refs.shelfListId) values.shelf_list = refs.shelfListId
  return {
    id: ATTRIBUTE_DEMO_ITEM_ID,
    description: "Cybernetics (attribute demo)",
    title: "Cybernetics (attribute demo)",
    taskDescription:
      "A demo item that fills one attribute of every type. Change anything; re-running the seed puts it back.",
    stage: "list",
    type: "item",
    createdAt: addDays(now, -19),
    completed: false,
    lists: [ATTRIBUTE_DEMO_LIST_ID],
    tags: ["demo"],
    attributes: values,
    itemAttributeDefinitions: ATTRIBUTE_DEMO_ITEM_ONLY,
    notes: "Second copy is for lending. Keep the marked-up one at the desk.",
    noteLog: attributeDemoNotes(now),
    resources: assets.resources,
  }
}

/**
 * Seed (or reseed) the demo list and item into the live stores.
 * Returns the item id. Browser only: needs IndexedDB for the files.
 */
export async function seedAttributeDemo(now: Date = new Date()): Promise<string> {
  const [{ putAttachment }, { useTaskStore }] = await Promise.all([
    import("@/lib/attachments"),
    import("@/lib/task-store"),
  ])
  const store = useTaskStore.getState()
  const assets = await storeAttributeDemoAssets(putAttachment, now)

  const list = attributeDemoList(now)
  if (store.lists.some((l) => l.id === list.id)) store.updateList(list)
  else store.addList(list)

  const fresh = useTaskStore.getState()
  const reading = fresh.lists.find((l) => /reading list/i.test(l.name)) ?? fresh.lists.find((l) => l.id !== list.id)
  const related = fresh.tasks.find((t) => t.id !== ATTRIBUTE_DEMO_ITEM_ID && reading && t.lists?.includes(reading.id))
  const item = attributeDemoItem(assets, { relatedItemId: related?.id, shelfListId: reading?.id }, now)
  if (fresh.tasks.some((t) => t.id === item.id)) fresh.updateTask(item)
  else fresh.addTask(item)
  return item.id
}

/** Open-or-create: seeds only when the demo item is missing, so edits to it survive. */
export async function ensureAttributeDemo(now: Date = new Date()): Promise<string> {
  const { useTaskStore } = await import("@/lib/task-store")
  if (useTaskStore.getState().tasks.some((t) => t.id === ATTRIBUTE_DEMO_ITEM_ID)) return ATTRIBUTE_DEMO_ITEM_ID
  return seedAttributeDemo(now)
}
