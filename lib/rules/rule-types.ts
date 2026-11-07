/**
 * lib/rules/rule-types.ts — The shape of a standing rule: event in, trigger test, sink out
 *
 * A rule is data, so BIM can list, pause, and delete it, and a model can only
 * propose one (code validates it). Add a trigger or sink by adding a kind here
 * and one entry in `rules-engine.ts`; nothing else changes.
 */

/** Something that happened in the app. `typed-text` is a field the person typed by hand. */
export type RuleEvent = {
  kind: "typed-text"
  text: string
  /** Where it was typed ("Item › Notes"). */
  source: string
  at: Date
}

export type RuleTrigger = { kind: "typed-text"; overWords: number }

/** Where a matched event goes. `docId` is re-found by `title` if the note was deleted. */
export type RuleSink = { kind: "doc-append"; docId: string; title: string }

export interface Rule {
  id: string
  /** Short label shown in lists and in BIM's replies. */
  name: string
  on: boolean
  trigger: RuleTrigger
  sink: RuleSink
  createdAt: string
  /** Hashes of events already delivered, so one event is not delivered twice. */
  seen: string[]
}

export type RuleDraft = Pick<Rule, "name" | "trigger" | "sink"> & { on?: boolean }
