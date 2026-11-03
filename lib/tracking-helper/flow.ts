/**
 * lib/tracking-helper/flow.ts — The Tracking Helper's flow: five stages, the editable parts of each
 *
 *   ROUTE (code) → TOKENIZE (code) → WIRE (one model call) → PLACE (code) → WHERE (code)
 *
 * The lab (`/lab/tracking-helper`) edits this object and keeps the copy per device. Only ROUTE's
 * patterns, WIRE's prompt, examples and model ladder, and PLACE's defaults are meant to be tuned.
 * `TRACKING_HELPER_REV` is bumped when the shipped flow changes shape; a browser holding an older
 * saved copy gets the new one, and its own copy is kept under a `:backup:<rev>` key.
 */

export const TRACKING_HELPER_REV = "2026-11-01-orphans-examples"

export interface WireExample {
  /** Tagged text, as the model sees it. */
  text: string
  /** The answer, as JSON. */
  json: string
}

export interface HelperFlow {
  rev: string
  route: {
    /** A message that starts like this changes the proposals already on screen instead of adding new ones. */
    revise: string
    /** A message that matches this and has no time in it is a question about the Helper, not an account of a day. */
    question: string
  }
  wire: {
    system: string
    /** Appended to `system`; the lab's place for one-off fixes that survive a reset of `system`. */
    extra: string
    examples: WireExample[]
    /** Models tried smallest first. Empty = the crew's extract ladder. */
    ladder: string[]
    maxTokens: number
  }
  place: {
    /** Minutes given to a block whose end was never said. */
    openMin: number
    /** Learn a missing place from the person's own history. */
    learnPlaces: boolean
  }
}

export const WIRE_SYSTEM =
  "You read a person's account of what they did, and list each thing in the order told. " +
  "You never write a time. Times in the text are tagged like 4:30[T1], days like Friday[D1], lengths like 20 minutes[U1]. Point at the tag. " +
  "One entry per distinct thing they did. " +
  "start: the tag where it began. end: the tag where it ended. Leave a field empty when the text does not give it; code fills in from the neighbours. " +
  "'until X', 'by X it was done', 'finished at X' give an end. 'at X started', 'from X' give a start. If a time is said twice for the same moment, use the first tag. " +
  "maybeEnd: a later tag the text says it might have lasted until. " +
  "startVague and endVague: true when the words call that edge a guess, a minimum ('at least'), or 'maybe', 'potentially', 'around', 'sometime'. false when they say it is sure. " +
  "place: only a place the person names, as written. Empty otherwise; never guess. " +
  "day: the D tag it happened on, empty when it continues the previous entry's day. " +
  "length: the U tag when the text gives a length instead of an end. " +
  "activity: a short lowercase phrase ('walking', 'dishes', 'taking out trash', 'scrolling'). " +
  "notes: at most 12 words of what the words imply beyond the activity, such as a feeling about it, a good deed, who was there. Empty when there is nothing. " +
  "'at least from A - B but potentially longer, maybe until C' is start A, end B, maybeEnd C: end is the plain time, never the 'maybe' one. " +
  "A later sentence like 'by 6:22 the trash stuff was done' is the end of that earlier thing: use its tag as end. " +
  "Skip anything with no time near it. Do not pad the list."

export const WIRE_EXAMPLES: WireExample[] = [
  {
    text: "yesterday[D1] I was cooking from 5[T1] until like 6:15[T2] and I ate right after, then showered by 7[T3]. Really proud I finally cooked instead of ordering.",
    json: JSON.stringify({
      segments: [
        { activity: "cooking", place: "", day: "D1", start: "T1", end: "T2", maybeEnd: "", length: "", startVague: false, endVague: true, notes: "proud to cook instead of ordering" },
        { activity: "eating", place: "", day: "", start: "", end: "", maybeEnd: "", length: "", startVague: false, endVague: false, notes: "" },
        { activity: "showering", place: "", day: "", start: "", end: "T3", maybeEnd: "", length: "", startVague: false, endVague: false, notes: "" },
      ],
    }),
  },
  {
    text: "Tuesday[D1] I was reading at least from 2[T1] - 3 pm[T2] but maybe longer, maybe until 3:30[T3]. Then I made tea, a ritual I love. By 3:40[T4] the tea was done.",
    json: JSON.stringify({
      segments: [
        { activity: "reading", place: "", day: "D1", start: "T1", end: "T2", maybeEnd: "T3", length: "", startVague: false, endVague: true, notes: "" },
        { activity: "making tea", place: "", day: "", start: "", end: "T4", maybeEnd: "", length: "", startVague: false, endVague: false, notes: "a ritual they love" },
      ],
    }),
  },
]

export function starterFlow(): HelperFlow {
  return {
    rev: TRACKING_HELPER_REV,
    route: {
      revise: "^\\s*(actually|wait|no[, ]|oops|correction|sorry|i meant|make (it|that)|change|that was|it was|not )",
      question: "^\\s*(what|how|why|can you|could you|help|who|where do)\\b|\\?\\s*$",
    },
    wire: { system: WIRE_SYSTEM, extra: "", examples: WIRE_EXAMPLES, ladder: [], maxTokens: 900 },
    place: { openMin: 30, learnPlaces: true },
  }
}

const KEY = "trackinghelper-flow-v1"

/** The saved flow, or the starter. A copy from an older shipped flow is replaced and kept as a backup. */
export function loadFlow(): HelperFlow {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return starterFlow()
    const saved = JSON.parse(raw) as HelperFlow
    if (saved.rev === TRACKING_HELPER_REV) return saved
    localStorage.setItem(`${KEY}:backup:${saved.rev}`, raw)
    localStorage.removeItem(KEY)
  } catch {}
  return starterFlow()
}

export function saveFlow(flow: HelperFlow): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(flow))
  } catch {}
}
