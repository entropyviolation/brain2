/**
 * lib/module-output-registry.ts — What each module can report
 *
 * One row per module that emits `ModuleOutput`s (`lib/module-output.ts`): its id, the words a
 * person calls it, and what it reports. The Wire BIMBY (`lib/wire-bimby`) reads this to turn
 * "connect the speed reader to my reading habit" into a feed row, and to refuse a pairing the
 * module cannot satisfy (a module that reports pages cannot feed a minutes habit).
 * A new module adds a row here and emits through `applyModuleOutput`; nothing else changes.
 */
export interface ModuleEmits {
  measure: string
  /** Item type the amount is about, when it is about one thing. The door finds or creates it. */
  subjectType?: string
  /** One output per this much: "page". */
  per: string
}

export interface ModuleOutputSpec {
  id: string
  name: string
  /** Lowercase phrases a person might use. */
  aliases: string[]
  emits: ModuleEmits[]
  /** Each output carries the clock time it happened. */
  reportsTime: boolean
  /** The module also reports whole active sessions (start, end, what was done), for Tracking pens. */
  sessions?: boolean
}

export const MODULE_OUTPUTS: ModuleOutputSpec[] = [
  {
    id: "speed-read",
    name: "Speed Read",
    aliases: ["speed reading", "speedreading", "speed read", "speed reader", "speedread", "speedreader", "speed-read", "rsvp reader"],
    emits: [{ measure: "pages", subjectType: "book", per: "page finished" }],
    reportsTime: true,
    sessions: true,
  },
  {
    id: "habit-entry",
    name: "Habit entry form",
    aliases: ["habit entry", "entry form"],
    emits: [
      { measure: "pages", subjectType: "book", per: "entry" },
      { measure: "minutes", per: "entry" },
      { measure: "count", per: "entry" },
    ],
    reportsTime: true,
  },
]

export function moduleSpec(id: string): ModuleOutputSpec | undefined {
  return MODULE_OUTPUTS.find((m) => m.id === id)
}

/** The module a sentence names, if any. Longest alias wins ("speed reader" over "speed"). */
export function moduleNamedIn(text: string): ModuleOutputSpec | undefined {
  const lower = text.toLowerCase().replace(/['"“”‘’]/g, " ")
  let best: { spec: ModuleOutputSpec; len: number } | undefined
  for (const spec of MODULE_OUTPUTS) {
    for (const alias of spec.aliases) {
      if (lower.includes(alias) && (!best || alias.length > best.len)) best = { spec, len: alias.length }
    }
  }
  return best?.spec
}
