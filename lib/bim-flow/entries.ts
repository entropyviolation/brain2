/**
 * lib/bim-flow/entries.ts — The doors into BIM: one start node per place in the app
 *
 * Each door has its own screen in the lab (one start node per flow), so a routing
 * can be run on its own with different inputs. A message does not always arrive as a line of BIM text. A reason typed in the
 * Why-blocked control, a night ritual's look-back, a question typed in a search
 * bar, and a note on the time grid are different inputs with different
 * contents, and they want different first steps. Each door has an id, a sample
 * input, and the flow it opens. The engine still lets a flow hold several start
 * nodes (`config.entry`, matched against `FlowMessage.entry`), but the flows
 * shipped here keep one per screen.
 *
 * `built` marks doors that have a start node in a flow today. The rest are the
 * planned doors, kept here so the catalogue is in one place.
 */

export type InputShape = "text" | "question" | "reason" | "ritual" | "grid-note" | "table" | "day" | "item"

export interface EntryDef {
  id: string
  name: string
  /** Where in the app this input comes from. */
  surface: string
  shape: InputShape
  /** What arrives, in one line. */
  about: string
  /** The flow that has a start node for it. */
  flowId: string
  sample: string
  built: boolean
}

const HABIT_BUILD = "Make a new daily habit 'be home for more than 5 hours' and have it autodetect from location or be manually input"

export const ENTRIES: EntryDef[] = [
  { id: "bim-text", name: "BIM text", surface: "Telegram / BIM console", shape: "text", about: "A stream-of-consciousness line, sent any time.", flowId: "log-routed", sample: "making garlic confit now", built: true },
  { id: "phone-capture", name: "Phone capture", surface: "iPhone quick capture", shape: "text", about: "A short fragment; often a command or a question, not a note.", flowId: "log-phone", sample: "remind me to call mom tomorrow", built: true },
  { id: "time-grid", name: "Time-grid note", surface: "Time grid entry", shape: "grid-note", about: "A note typed on an entry whose pen (the activity) is already known.", flowId: "log-grid", sample: "with elijah, he made tea", built: true },
  { id: "ask-bar", name: "Ask bar", surface: "Search / ask box", shape: "question", about: "A question about the person's own life, in plain words.", flowId: "ask", sample: "when was the last time i showered?", built: true },
  { id: "item-why", name: "Item: why is this stuck?", surface: "Item detail", shape: "item", about: "An open item and its push history; the question is implied.", flowId: "ask", sample: "why does 'process inbox information' keep getting pushed?", built: true },
  { id: "miss-reason", name: "Why-blocked reason", surface: "Why-blocked control (push, miss, habit)", shape: "reason", about: "A task title and the reason just typed beside it.", flowId: "reason", sample: "Process inbox information — no time, too much going on", built: true },
  { id: "ritual-night", name: "Night ritual", surface: "Rituals → Night / end", shape: "ritual", about: "The look-back, reflection, and plan the person just wrote.", flowId: "ritual-night", sample: "Didn't finish the foxtide stuff again. I keep saying tomorrow. Grateful elijah cooked.", built: true },
  { id: "ritual-morning", name: "Morning ritual", surface: "Rituals → Morning", shape: "ritual", about: "Intentions and best-day reasons written on waking.", flowId: "ritual-morning", sample: "Today: finish bim flow, go outside, eat real food", built: true },
  { id: "data-reviews", name: "Data → Reviews", surface: "Data tab", shape: "table", about: "A whole table of reasons or ritual answers; an analysis is run over it.", flowId: "analysis", sample: "", built: true },
  { id: "home-day", name: "Home day", surface: "Home → day view", shape: "day", about: "One day's messages, entries, and notes.", flowId: "day", sample: "", built: true },
  { id: "build-request", name: "Build request", surface: "Phone capture / ask bar", shape: "text", about: "A request to make something in the app, not a note or a question: a new habit, list, or rule, wired to what already exists.", flowId: "log-phone", sample: HABIT_BUILD, built: false },
  { id: "build-list", name: "Build request: list or folder", surface: "Phone capture / ask bar", shape: "text", about: "A request to make a new list or folder from a description, placed among the lists that already exist.", flowId: "log-phone", sample: "Make a list called 'gift ideas' in a new folder 'people stuff', and put 'candle for mom' in it", built: false },
  { id: "list-item", name: "New list item", surface: "Lists / quick add", shape: "text", about: "A line added to a list; needs placing, deduping, and tagging.", flowId: "log-routed", sample: "need more macbook bricks", built: false },
  { id: "habit-cell", name: "Habit cell", surface: "Home → Habits", shape: "reason", about: "A missed or exempted habit cell and its note.", flowId: "reason", sample: "", built: false },
  { id: "person-card", name: "Person card", surface: "People", shape: "item", about: "A person's profile; ask what the notes say about them.", flowId: "topic", sample: "", built: false },
  { id: "photo-day", name: "Day photo", surface: "Day photos", shape: "item", about: "A photo with a date; what was happening then.", flowId: "day", sample: "", built: false },
  { id: "screentime", name: "Screen time", surface: "Time grid → Screen Time", shape: "table", about: "App-level rows; separate from the person's own words.", flowId: "analysis", sample: "", built: false },
]

export const entryDef = (id: string) => ENTRIES.find((e) => e.id === id)
