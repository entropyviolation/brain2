/**
 * lib/widgets/kinds.ts — The widget kind registry
 *
 * One plain manifest per kind: name, install rule, the sizes its Dash face can
 * draw, its gear settings, its gallery page, and an optional first-run guide.
 * Twenty-one kinds ship. Countdown replaced Days Until (`daysuntil`) and Language
 * study replaced Vocab (`vocab`); the old ids stay as the kind ids, so a saved
 * layout keeps its widgets. A future user-made kind registers through the
 * same `registerWidgetKind` call under a `user:<slug>` id. Plan:
 * `docs/WIDGETS_REDESIGN.md`.
 */

import type { WidgetKind, WidgetKindId, WidgetSettingField, WidgetSettings, WidgetSize } from "@/lib/widgets/types"

const BUILT_IN_KINDS: WidgetKind[] = [
  {
    id: "progress",
    name: "Today's Progress",
    group: "Day",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1", "2x2", "3x1"],
    defaultSize: "2x1",
    milledSize: "3x2",
    startsShowing: true,
    settings: [
      {
        key: "periods",
        label: "Columns",
        type: "choice",
        default: "all",
        options: [
          { value: "today", label: "Today only" },
          { value: "week", label: "Today and this week" },
          { value: "all", label: "Today, week, and month" },
        ],
        help: "Which period columns the face draws.",
      },
    ],
    gallery: {
      what: "Habits for the day the dashboard reads, split into done, miss, and blank, and the to-do fraction. Columns can add this week and this month. Click lists what is still open, and each row opens that item.",
      how: [
        "Habits come from Daily Habits for that day. A miss is not a blank, and a mixed day is not finished.",
        "To-dos are the ones due that day in To Do.",
        "Week and month add up the same piles over those spans.",
      ],
      useful: "Done, miss, and blank for the day the dashboard is reading.",
      preview: { caption: "Today's Progress", crt: "2 done · 1 miss", footer: "1 blank · to do 1/4" },
    },
  },
  {
    id: "review",
    name: "Rituals",
    group: "Capture",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1"],
    defaultSize: "1x1",
    milledSize: "1x2",
    startsShowing: true,
    settings: [
      {
        key: "keys",
        label: "Keys on the face",
        type: "toggle",
        default: true,
        help: "Off leaves only the count; Open, Not now, and Dismiss move to the detail.",
      },
    ],
    gallery: {
      what: "Counts the rites due for this day: today's morning and today's night, not the older backlog. The footer names the next one and its state. Open resumes it.",
      how: [
        "Reads the Reviews room for rites due today, plus any Star Lord report that is due.",
        "Not now hides it until tomorrow. Dismiss hides it for this session only.",
        "A clear day hides the face, so an empty reading never pretends to be a rite.",
      ],
      useful: "Keep it showing when today's due rite should meet you on every Home tab.",
      preview: { caption: "Rituals", crt: "2", footer: "Morning · in progress" },
    },
  },
  {
    id: "points",
    name: "Points",
    group: "Score",
    version: 1,
    installs: "many",
    sizes: ["1x1", "2x1", "2x2", "3x1"],
    defaultSize: "2x1",
    milledSize: "2x2",
    startsShowing: true,
    settings: [
      {
        key: "period",
        label: "Period",
        type: "choice",
        default: "day",
        options: [
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
          { value: "all", label: "All time" },
        ],
        help: "The total the readout shows, against the period before it.",
      },
      { key: "chart", label: "Chart", type: "toggle", default: true, help: "The small market chart under the number." },
      { key: "keys", label: "Period keys on the face", type: "toggle", default: true, help: "D / W / M / ALL on the face. Off locks this copy to its period." },
    ],
    gallery: {
      what: "A market ticker for your points. One period at a time: its total, the change against the previous period (▲ / ▼, points and percent), and a chart with the previous value dashed. Click opens all four wells and the trends.",
      how: [
        "Totals come from the points ledger: habit pay, bonuses, and everything else.",
        "The today meter is habit points paid over the habit ceiling, the same reading as Harvest and Progress.",
        "Install more than one copy to watch two periods side by side.",
      ],
      useful: "The day's score, split, so a mixed habit day does not look finished.",
      preview: { caption: "Points", crt: "42", footer: "30 habits · 12 bonuses" },
    },
    guide: [
      { title: "One period at a time", body: "D, W, M, and ALL choose what the readout counts. The arrow compares it with the period before." },
      { title: "The split", body: "Today's footer splits the sum into habit pay, bonuses, and the rest, so a big bonus cannot hide an unpaid habit sheet." },
      { title: "More than one", body: "The gear can pin this copy to one period. Add another Points copy from the gallery to watch a second period." },
    ],
  },
  {
    id: "award",
    name: "Latest award",
    group: "Score",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1"],
    defaultSize: "1x1",
    milledSize: "1x2",
    startsShowing: true,
    settings: [],
    gallery: {
      what: "A habit completion or a bonus on this day: the larger one in the readout and why in the footer. Click lists recent awards.",
      how: [
        "Reads the points ledger for the day the dashboard is on.",
        "A later inbox +1 does not take the face when a +50 is already on that day.",
      ],
      useful: "The last real payment on this day, not the latest inbox handle.",
      preview: { caption: "Latest award", crt: "+50", footer: "Higher habit grades" },
    },
  },
  {
    id: "pet",
    name: "Screen pet",
    group: "Day",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1", "1x2"],
    defaultSize: "1x1",
    milledSize: "1x2",
    startsShowing: true,
    settings: [
      {
        key: "caption",
        label: "Caption",
        type: "choice",
        default: "clock",
        options: [
          { value: "clock", label: "Clock" },
          { value: "name", label: "Pet name" },
          { value: "mood", label: "Mood" },
        ],
        help: "What sits above the pet.",
      },
      { key: "name", label: "Pet name", type: "text", default: "", maxLength: 16, placeholder: "Pixel", help: "Shown when the caption is Pet name, and in the detail." },
    ],
    gallery: {
      what: "A pixel creature, a clock, and the day's habit progress. It wakes, settles, and sleeps with the habit sheet.",
      how: [
        "Pose reads today's daily habits and the clock.",
        "Night (10pm to 6am) settles it to sleep unless every habit is done. Under a fifth done is also asleep; all done is pleased.",
      ],
      useful: "The day's habit progress at a glance, including at night.",
      preview: { caption: "11:14p", crt: "7/28", footer: "1 miss · 20 blank" },
    },
  },
  {
    id: "affirmation",
    name: "Affirmation",
    group: "Capture",
    version: 1,
    installs: "once",
    sizes: ["2x1", "2x2", "3x1"],
    defaultSize: "2x1",
    milledSize: "2x2",
    startsShowing: false,
    settings: [
      { key: "keys", label: "Quick keys", type: "toggle", default: true, help: "⇄ (flip the lens) and ✓ (said it) on the face." },
      { key: "pips", label: "Said pips", type: "toggle", default: true, help: "The five dots that light as you say each line." },
    ],
    gallery: {
      what: "Today's five affirmations, one at a time. ⇄ flips a line between Original, E-Prime, French, Italian, Spanish, Vivid, and Higher Self; ✓ logs that you said it. The detail walks the five, counts your streak, and opens the whole bank.",
      how: [
        "The five are the morning ritual's five, else five drawn from your Affirmations list.",
        "Recitations are saved in the affirmation log, not in the widget, so they survive a reinstall.",
      ],
      useful: "A sentence already on the list, and which one it is.",
      preview: { caption: "Affirmation", crt: "I follow through.", footer: "9 of 57" },
    },
  },
  {
    id: "weather",
    name: "Weather",
    group: "Sky",
    version: 1,
    installs: "perKey",
    keyLabel: "Place",
    sizes: ["1x1", "2x1", "2x2"],
    defaultSize: "2x1",
    milledSize: "2x2",
    startsShowing: false,
    hasSetup: true,
    settings: [
      { key: "place", label: "Place", type: "text", default: "", maxLength: 60, placeholder: "Pinned city", help: "Empty follows the city pinned in the detail, else Settings home city." },
      {
        key: "units",
        label: "Units",
        type: "choice",
        default: "f",
        options: [
          { value: "f", label: "°F" },
          { value: "c", label: "°C" },
        ],
        help: "The readout's temperature unit.",
      },
      {
        key: "foot",
        label: "Footer",
        type: "choice",
        default: "glance",
        options: [
          { value: "glance", label: "What changes later" },
          { value: "range", label: "Today's high and low" },
          { value: "rain", label: "Chance of rain" },
        ],
      },
    ],
    gallery: {
      what: "City in the caption, temperature and a sun, cloud, or rain glyph in the readout, and a glance at the next change still ahead. Click opens the city, beach, week, and tide instrument.",
      how: [
        "Forecasts come from Open-Meteo; tides from NOAA when a beach is picked.",
        "Install one copy per place to keep two cities side by side.",
      ],
      useful: "When the sky still ahead should sit next to the day you planned.",
      preview: { caption: "San Diego", crt: "72°", footer: "Clear · rain Saturday" },
    },
  },
  {
    id: "next",
    name: "Next",
    group: "Day",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1", "3x1"],
    defaultSize: "2x1",
    milledSize: "1x2",
    startsShowing: false,
    settings: [
      {
        key: "sources",
        label: "Sources",
        type: "choice",
        default: "both",
        options: [
          { value: "both", label: "Plan events, then to-dos" },
          { value: "events", label: "Plan events only" },
          { value: "todos", label: "To-dos only" },
        ],
      },
    ],
    gallery: {
      what: "The next thing still ahead on this day: a Plan event, else the first open to-do. Click opens it and can jump to Plan or To Do.",
      how: ["Events that already ended today are skipped. An all-day event says All day."],
      useful: "When you want the next timed thing without opening Plan.",
      preview: { caption: "Next", crt: "Evening", footer: "18:00" },
    },
  },
  {
    id: "daylamp",
    name: "Day lamp",
    group: "Day",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1"],
    defaultSize: "1x1",
    milledSize: "1x2",
    startsShowing: false,
    settings: [
      {
        key: "bars",
        label: "Reads",
        type: "choice",
        default: "both",
        options: [
          { value: "both", label: "Habits and to-dos" },
          { value: "habits", label: "Habits only" },
          { value: "todos", label: "To-dos only" },
        ],
        help: "Which completion bars light the lamp.",
      },
    ],
    gallery: {
      what: "One word — Quiet, Dim, Warm, Bright, or Full — from today's habit and to-do bars.",
      how: ["Full means every present bar is finished. Quiet means nothing was scheduled.", "The other words average the bars it reads."],
      useful: "A single brightness for the day.",
      preview: { caption: "Day lamp", crt: "Warm", footer: "habits 1/4 · to do 3/3" },
    },
  },
  {
    id: "harvest",
    name: "Harvest leftover",
    group: "Score",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1"],
    defaultSize: "1x1",
    milledSize: "1x2",
    startsShowing: false,
    settings: [
      {
        key: "readout",
        label: "Readout",
        type: "choice",
        default: "points",
        options: [
          { value: "points", label: "Points left" },
          { value: "percent", label: "Percent harvested" },
        ],
      },
    ],
    gallery: {
      what: "Habit points still unpaid today, from the same reading as Points.",
      how: ["The readout is the remainder of the habit ceiling. A to-do reward is not this number."],
      useful: "Habit points still unpaid, not the score you already have.",
      preview: { caption: "Harvest leftover", crt: "18", footer: "18 left of 40" },
    },
  },
  {
    id: "inbox",
    name: "Inbox mill",
    group: "Capture",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1"],
    defaultSize: "1x1",
    milledSize: "1x2",
    startsShowing: false,
    settings: [
      {
        key: "foot",
        label: "Footer",
        type: "choice",
        default: "newest",
        options: [
          { value: "newest", label: "Newest title and oldest age" },
          { value: "oldest", label: "Oldest age only" },
        ],
      },
    ],
    gallery: {
      what: "How many revisit-Inbox ideas are waiting, the newest title, and the age of the oldest. Click can open Inbox.",
      how: ["Counts the revisit pile only. Monkey brain is not in this count."],
      useful: "The pile's size, its newest capture, and how old the oldest one is.",
      preview: { caption: "Inbox mill", crt: "4", footer: "Call the dentist · 6d" },
    },
  },
  {
    id: "flow",
    name: "Already flowing",
    group: "Day",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1", "2x2"],
    defaultSize: "2x1",
    milledSize: "2x2",
    startsShowing: false,
    settings: [
      {
        key: "readout",
        label: "Readout",
        type: "choice",
        default: "word",
        options: [
          { value: "word", label: "One word" },
          { value: "counts", label: "Already / new counts" },
        ],
      },
    ],
    gallery: {
      what: "One word for finished work today: Flowing, Pushed, Mixed, or Quiet.",
      how: [
        "Daily habits you completed, and to-dos that were already on the books, count as already in motion.",
        "A to-do created and finished the same day counts as new. Generated Done rows do not count.",
      ],
      useful: "Whether finished work was already on the books.",
      preview: { caption: "Already flowing", crt: "Flowing", footer: "3 already · 1 new" },
    },
  },
  {
    id: "paint",
    name: "Plan and lived",
    group: "Day",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1", "2x2"],
    defaultSize: "2x1",
    milledSize: "2x2",
    startsShowing: false,
    settings: [
      {
        key: "readout",
        label: "Readout",
        type: "choice",
        default: "word",
        options: [
          { value: "word", label: "Verdict word" },
          { value: "plan", label: "Planned time" },
          { value: "lived", label: "Lived time" },
        ],
      },
    ],
    gallery: {
      what: "Scheduled minutes still ahead against painted waking minutes, as Short, Close, Over, Planned, Tracked, or Open.",
      how: ["Plan is scheduled time: work, events, and planned actions.", "Lived is painted Tracking minutes, each minute once, with sleep left out."],
      useful: "The plan and the lived day in one square.",
      preview: { caption: "Plan and lived", crt: "Short", footer: "plan 5h · lived 3h" },
    },
  },
  {
    id: "tracking",
    name: "Tracking now",
    group: "Capture",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1"],
    defaultSize: "2x1",
    milledSize: "1x2",
    startsShowing: false,
    settings: [
      {
        key: "lane",
        label: "Lead lane",
        type: "choice",
        default: "activity",
        options: [
          { value: "activity", label: "Activity" },
          { value: "location", label: "Location" },
          { value: "mood", label: "Mood" },
          { value: "company", label: "Company" },
        ],
        help: "The lane the big line shows.",
      },
      { key: "update", label: "Update key on the face", type: "toggle", default: true },
    ],
    gallery: {
      what: "The current Activity, Location, Mood, and Company, or the last ones you painted. Update stamps up to now.",
      how: ["Reads the Tracking grid, a live Working-on-now session, or a Telegram currently span.", "Update never paints through midnight."],
      useful: "The grid's last stamp, and how old it is.",
      preview: { caption: "Tracking now", crt: "Work", footer: "9:55p · 1h open" },
    },
  },
  {
    id: "night",
    name: "Night well",
    group: "Clock",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1"],
    defaultSize: "1x1",
    milledSize: "1x2",
    startsShowing: false,
    settings: [
      {
        key: "format",
        label: "Format",
        type: "choice",
        default: "hm",
        options: [
          { value: "hm", label: "Hours and minutes" },
          { value: "decimal", label: "Decimal hours" },
        ],
      },
    ],
    gallery: {
      what: "The hours of this morning's night, else the last real night and the morning it ended.",
      how: ["Reads Sleep. An all-nighter or a logged duration counts as a real night."],
      useful: "The last real night, including when tonight is still blank.",
      preview: { caption: "Night well", crt: "5h 59m", footer: "Oct 4 · last real night" },
    },
  },
  {
    id: "solar",
    name: "Solar remainder",
    group: "Sky",
    version: 1,
    installs: "perKey",
    keyLabel: "Place",
    sizes: ["1x1", "2x1"],
    defaultSize: "1x1",
    milledSize: "1x2",
    startsShowing: false,
    hasSetup: true,
    settings: [
      { key: "place", label: "Place", type: "text", default: "", maxLength: 60, placeholder: "Weather pin", help: "Empty reads the Weather pin, else Settings home city." },
      {
        key: "target",
        label: "Counts to",
        type: "choice",
        default: "auto",
        options: [
          { value: "auto", label: "Sunset, then sunrise" },
          { value: "sunset", label: "Always the next sunset" },
          { value: "sunrise", label: "Always the next sunrise" },
        ],
      },
    ],
    gallery: {
      what: "Time left in the sun's day. Before sunset it counts down to sunset; after sunset it counts to the next sunrise.",
      how: ["Sun times are computed on the device for the pinned place. No network call."],
      useful: "The sun's remainder at a glance.",
      preview: { caption: "Solar remainder", crt: "7h 40m", footer: "6:50 AM" },
    },
  },
  {
    id: "moon",
    name: "Moon",
    group: "Sky",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1", "1x2", "1x3"],
    defaultSize: "1x2",
    milledSize: "1x3",
    startsShowing: true,
    settings: [
      {
        key: "readout",
        label: "Readout",
        type: "choice",
        default: "phase",
        options: [
          { value: "phase", label: "Phase name" },
          { value: "countdown", label: "Days to the next full or new moon" },
          { value: "light", label: "Percent lit" },
        ],
      },
      { key: "sprite", label: "Pixel moon", type: "toggle", default: true },
    ],
    gallery: {
      what: "An 8-bit moon for the dashboard day and one phase voice. The detail adds illumination and a solar-system chart you can zoom, scale, and run through time.",
      how: ["Phase math runs on the device (`lib/lunar.ts`). The name and the countdown use the same local day."],
      useful: "When the month's light should be one voice.",
      preview: { caption: "Moon", crt: "Waning crescent", footer: "1 day until new moon" },
    },
    guide: [
      { title: "The face", body: "The pixel moon and the phase name for the day the dashboard reads." },
      { title: "The chart", body: "The detail's sky chart can zoom, switch to true sizes, and run time forward or back." },
    ],
  },
  {
    id: "daysuntil",
    name: "Countdown",
    group: "Clock",
    version: 1,
    installs: "many",
    sizes: ["1x1", "2x1"],
    defaultSize: "1x1",
    milledSize: "1x2",
    startsShowing: true,
    hasSetup: true,
    settings: [],
    gallery: {
      what: "One date you do not want to do math for: a live count to it, or since it. Each Countdown is its own copy, so install one per mark.",
      how: [
        "Counts to a date and optional time, in days, weeks, sleeps, or working days, or as a decimal.",
        "Repeats yearly or monthly for birthdays and anniversaries; the face rolls to the next one.",
        "An optional start date draws how far along the span is. Count-ups can light a lamp at round numbers.",
        "Attach a Plan event, or keep the mark as an all-day day on the scheduler.",
      ],
      useful: "Dates ahead or behind, each on its own face. It replaces Days Until and Days Since.",
      preview: { caption: "Countdown", crt: "12", footer: "days until Launch" },
    },
    guide: [
      { title: "One mark per copy", body: "Each Countdown counts one date. Add another from the gallery for the next mark." },
      { title: "Count up too", body: "The gear switches between counting down to a date and counting up from one, and picks what happens once it passes." },
    ],
  },
  {
    id: "vocab",
    name: "Language study",
    group: "Study",
    version: 1,
    installs: "perKey",
    keyLabel: "Language",
    sizes: ["1x1", "2x1", "2x2"],
    defaultSize: "2x1",
    milledSize: "2x2",
    startsShowing: true,
    hasSetup: true,
    settings: [],
    gallery: {
      what: "One copy per language. A studied language has a CEFR level (A1 to C2), an optional placement quiz in the format of that language's real exam, and Vocab mode: word of the day, 1000 words, flashcards, and look-up. A native language builds vocabulary: word of the day from Everyday to Extremely advanced, favorites, and flashcards.",
      how: [
        "The level picks the word pool: A1 and A2 are common words, B1 everyday words, and B2 and up the harder banks where that language has them.",
        "The placement quiz follows the real exam's format (DELF for French, DELE for Spanish, CELI for Italian, Goethe for German, JLPT for Japanese, HSK for Mandarin, Cambridge for English). The questions are written for Brain2, not copied from the exam.",
        "Favorites, shuffles, and known words stay in the Vocab data and the Languages lists, so a reinstall keeps them.",
      ],
      useful: "A daily word to grow your own vocabulary, or a real path through a new language.",
      preview: { caption: "Français · A2", crt: "🍎 la pomme", footer: "noun · Un fruit rond, rouge ou vert." },
    },
    guide: [
      { title: "One per language", body: "Each Language study copy holds one language. Install another from the gallery for the next one." },
      { title: "Levels", body: "A studied language sits on the CEFR ladder, A1 to C2. The level picks which words you see." },
      { title: "Placement quiz", body: "Not sure of your level? The gear has a short quiz in the format of that language's real exam. You can always set the level yourself." },
      { title: "Vocab mode", body: "Word of the day, 1000 words, flashcards of your favorites, and look-up. More modes will join here." },
    ],
  },
  {
    id: "budget",
    name: "Budget",
    group: "Money",
    version: 1,
    installs: "once",
    sizes: ["1x1", "2x1", "2x2"],
    defaultSize: "2x1",
    milledSize: "2x2",
    startsShowing: false,
    settings: [],
    gallery: {
      what: "This month's money in one square: net after what came in and what went out, with expected money kept apart.",
      how: [
        "Earned and Spent count received money only. Spending comes from the Tracking log; earnings come from the budget.",
        "Expected (🔮) money shows on its own line, sure and with maybes, and never changes the net.",
        "Click the square for the month's breakdown. Add and edit lines in Tracking log → Spent → Budget.",
      ],
      useful: "A glance at the month's money without opening the budget.",
      preview: { caption: "Budget", crt: "+$1.2M", footer: "earned $1.9M · spent $0.7M" },
    },
  },
]

const REGISTRY = new Map<WidgetKindId, WidgetKind>(BUILT_IN_KINDS.map((kind) => [kind.id, kind]))

/** Built-in kind ids, in the order a fresh dashboard reads them. */
export const BUILT_IN_KIND_IDS: WidgetKindId[] = BUILT_IN_KINDS.map((kind) => kind.id)

/**
 * Add a kind to the registry. Built-ins are bare ids; anything else must be
 * `user:<slug>` so it can never take a built-in's place.
 */
export function registerWidgetKind(kind: WidgetKind): void {
  if (REGISTRY.has(kind.id)) throw new Error(`Widget kind already registered: ${kind.id}`)
  if (!kind.id.startsWith("user:")) throw new Error(`User widget kinds need a user: id, got ${kind.id}`)
  REGISTRY.set(kind.id, kind)
}

export function widgetKind(id: WidgetKindId): WidgetKind | undefined {
  return REGISTRY.get(id)
}

export function isKnownWidgetKind(id: unknown): id is WidgetKindId {
  return typeof id === "string" && REGISTRY.has(id)
}

export function allWidgetKinds(): WidgetKind[] {
  return [...REGISTRY.values()]
}

function sanitizeField(field: WidgetSettingField, raw: unknown): string | boolean {
  if (field.type === "toggle") return typeof raw === "boolean" ? raw : field.default
  if (field.type === "text") {
    if (typeof raw !== "string") return field.default
    return raw.replace(/[\r\n\t]/g, " ").slice(0, field.maxLength)
  }
  return typeof raw === "string" && field.options.some((option) => option.value === raw) ? raw : field.default
}

/**
 * Keep a copy's settings the kind's own shape: known fields are cleaned and
 * defaulted. Unknown fields are kept as they are, so a setting written by a
 * newer build survives this one.
 */
export function sanitizeWidgetSettings(kindId: WidgetKindId, raw: unknown): WidgetSettings {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const next: WidgetSettings = {}
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") next[key] = value
  }
  const kind = widgetKind(kindId)
  if (!kind) return next
  for (const field of kind.settings) next[field.key] = sanitizeField(field, source[field.key])
  return next
}

export function defaultWidgetSettings(kindId: WidgetKindId): WidgetSettings {
  return sanitizeWidgetSettings(kindId, {})
}

/** One kind's sizes, with the given size snapped to the nearest one it draws. */
export function snapWidgetSize(kindId: WidgetKindId, size: string | undefined): WidgetSize {
  const kind = widgetKind(kindId)
  const sizes = kind?.sizes ?? (["1x1", "2x1", "2x2"] as WidgetSize[])
  if (size && (sizes as string[]).includes(size)) return size as WidgetSize
  const [cols, rows] = parseSize(size ?? kind?.defaultSize ?? "1x1")
  let best = sizes[0]!
  let bestD = Infinity
  for (const option of sizes) {
    const [c, r] = parseSize(option)
    const d = Math.abs(c - cols) * 1.1 + Math.abs(r - rows)
    if (d < bestD) {
      best = option
      bestD = d
    }
  }
  return best
}

export function parseSize(size: string): [number, number] {
  const match = /^(\d)x(\d)$/.exec(size)
  if (!match) return [1, 1]
  return [Number(match[1]), Number(match[2])]
}

export function sizeLabel(size: string): string {
  const [cols, rows] = parseSize(size)
  if (cols === 1 && rows === 1) return "Small"
  if (cols === 2 && rows === 1) return "Wide"
  if (cols === 1) return "Tall"
  if (cols === 2 && rows === 2) return "Large"
  if (rows === 1) return "Strip"
  return "Panel"
}
