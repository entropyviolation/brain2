/**
 * lib/pixel-icon-match.ts — Pick the closest pixel icon for a task title
 *
 * Meaning-by-vocabulary: each icon owns a small set of words and synonyms.
 * Title words are trimmed to a rough stem (plural, -ing, -ed) and scored
 * against every set. Strong words count 2, loose words 1. The best score
 * wins; ties go to the icon listed first (specific things before generic
 * ones). No match falls back to the mission source. Pure and instant, so it
 * runs per row with no model call. **Planned:** an embedding pass through the
 * local model for titles this vocabulary misses.
 */

import type { FriendSuggestionSource } from "@/lib/baby-animal-personality"

export const TASK_ICON_NAMES = [
  "toothbrush",
  "droplet",
  "pill",
  "dumbbell",
  "bowl",
  "pillow",
  "paw",
  "robot",
  "chart",
  "money",
  "calendar",
  "bag",
  "broom",
  "trash",
  "shirt",
  "phone",
  "letter",
  "computer",
  "music",
  "book",
  "camera",
  "gift",
  "rocket",
  "can",
  "sprout",
  "clipboard",
  "signpost",
  "flower",
  "heart",
  "chat",
] as const

export type TaskIconName = (typeof TASK_ICON_NAMES)[number]

type Vocab = { strong: string[]; loose?: string[] }

const VOCAB: Partial<Record<TaskIconName, Vocab>> = {
  toothbrush: { strong: ["brush", "teeth", "tooth", "floss", "dentist", "mouthwash", "retainer"], loose: ["skincare", "face", "hair"] },
  droplet: { strong: ["shower", "bath", "hydrate", "water", "swim"], loose: ["drink", "wash"] },
  pill: { strong: ["pill", "med", "meds", "medicine", "medication", "vitamin", "doctor", "pharmacy", "prescription", "therapy", "therapist"], loose: ["health", "sick"] },
  dumbbell: { strong: ["exercise", "workout", "gym", "run", "jog", "stretch", "yoga", "lift", "cardio", "pushup", "bike", "hike"], loose: ["walk", "sport", "move"] },
  bowl: { strong: ["cook", "eat", "meal", "lunch", "dinner", "breakfast", "snack", "recipe", "bake", "food"], loose: ["kitchen", "prep"] },
  pillow: { strong: ["sleep", "nap", "bed", "bedtime", "rest"], loose: ["wind", "relax", "tired"] },
  paw: { strong: ["pet", "cat", "dog", "vet", "litter", "kitten", "puppy"], loose: ["feed"] },
  robot: { strong: ["robot", "robotic", "bot", "ai", "llm", "automate", "automation", "arduino", "servo"], loose: ["build", "tech", "model"] },
  chart: { strong: ["spreadsheet", "sheet", "excel", "chart", "graph", "data", "analytics", "dashboard"], loose: ["track", "report", "analyze", "log"] },
  money: { strong: ["pay", "bill", "bank", "money", "budget", "rent", "tax", "invoice", "benefit", "insurance", "refund", "cash", "salary"], loose: ["price", "cost", "save"] },
  calendar: { strong: ["schedule", "appointment", "meeting", "calendar", "deadline", "reschedule", "date", "rsvp"], loose: ["plan", "week", "today", "tomorrow"] },
  bag: { strong: ["buy", "order", "shop", "shopping", "grocery", "groceries", "purchase", "amazon", "store"], loose: ["return", "pick"] },
  broom: { strong: ["clean", "tidy", "sweep", "vacuum", "mop", "dust", "declutter", "dishes", "chore"], loose: ["organize", "room"] },
  trash: { strong: ["trash", "garbage", "recycle", "recycling", "bin", "compost"], loose: ["throw", "delete"] },
  shirt: { strong: ["laundry", "clothes", "shirt", "outfit", "dress", "iron", "wardrobe"], loose: ["fold", "wear"] },
  phone: { strong: ["call", "phone", "text", "voicemail", "facetime"], loose: ["ring", "contact"] },
  letter: { strong: ["email", "mail", "letter", "reply", "inbox", "postcard", "envelope"], loose: ["send", "message"] },
  computer: { strong: ["code", "coding", "computer", "laptop", "program", "website", "app", "deploy", "debug", "bug", "server", "git", "install"], loose: ["update", "fix", "work"] },
  music: { strong: ["music", "piano", "guitar", "sing", "song", "drum", "violin", "practice"], loose: ["play", "listen"] },
  book: { strong: ["read", "book", "study", "learn", "homework", "notes", "research", "essay", "journal"], loose: ["write", "class", "course"] },
  camera: { strong: ["photo", "picture", "camera", "film", "video", "record", "selfie"], loose: ["edit", "shoot"] },
  gift: { strong: ["gift", "birthday", "present", "party", "card", "wrap"], loose: ["celebrate", "surprise"] },
  rocket: { strong: ["launch", "ship", "kickoff", "project"], loose: ["start", "begin", "new"] },
  can: { strong: ["water", "garden", "plant", "plants"], loose: ["habit", "daily"] },
  sprout: { strong: ["seed", "seeds", "grow", "sprout", "farm", "repot"], loose: ["routine"] },
  clipboard: { strong: ["checklist", "todo", "errand", "errands"], loose: ["list"] },
  heart: { strong: ["love", "hug", "partner", "kiss", "mom", "dad", "family", "friend"], loose: ["thank", "care"] },
  chat: { strong: ["talk", "chat", "ask", "discuss", "meet"], loose: ["say", "tell"] },
}

const SOURCE_ICON: Partial<Record<FriendSuggestionSource, TaskIconName>> = {
  habit: "can",
  todo: "clipboard",
  nextAction: "signpost",
  whim: "flower",
  affection: "heart",
}

/** Rough stem: plural, -ing, -ed. Enough to land "dates" on "date", "cleaning" on "clean". */
export function stemWord(word: string): string {
  let w = word.toLowerCase()
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3)
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2)
  else if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`
  else if (w.length > 3 && w.endsWith("es") && /(sh|ch|x|ss)es$/.test(w)) w = w.slice(0, -2)
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1)
  return w
}

function words(title: string): string[] {
  return (title.toLowerCase().match(/[a-z]+/g) ?? []).map(stemWord)
}

function hits(tokens: string[], list: string[] | undefined): number {
  if (!list) return 0
  const stems = new Set(list.map(stemWord))
  return tokens.filter((token) => stems.has(token)).length
}

/** Score every icon for a title. Exposed for tests and tuning. */
export function scoreTaskIcons(title: string): Array<{ icon: TaskIconName; score: number }> {
  const tokens = words(title)
  return TASK_ICON_NAMES.map((icon) => {
    const vocab = VOCAB[icon]
    const score = vocab ? hits(tokens, vocab.strong) * 2 + hits(tokens, vocab.loose) : 0
    return { icon, score }
  })
}

/** The closest pixel icon for a task title; the source icon when nothing matches. */
export function matchTaskIcon(title: string, source?: FriendSuggestionSource | null): TaskIconName {
  let best: { icon: TaskIconName; score: number } | null = null
  for (const row of scoreTaskIcons(title)) {
    if (row.score > 0 && (!best || row.score > best.score)) best = row
  }
  if (best) return best.icon
  return (source && SOURCE_ICON[source]) || "chat"
}
