/**
 * lib/language-study/placement/types.ts — Shape of a placement question bank
 *
 * Each studied language has one bank. Every question is original. It copies
 * only the format of a task from that language's real exam (DELF reading,
 * DELE grammar gap, JLPT 文法, and so on), never its wording. `task` names
 * the exam task the item is modeled on, so the quiz can say so.
 *
 * Listening items have no recording. The device reads `passage` aloud with
 * speech synthesis, and the transcript can be revealed when speech is off.
 */

import type { VocabLang } from "@/lib/vocab/types"
import type { CefrLevel } from "@/lib/widgets/language-levels"

export type PlacementSkill = "reading" | "listening" | "grammar" | "vocabulary"

export type PlacementQuestion = {
  /** Stable across releases: `fr-b1-03`. */
  id: string
  level: CefrLevel
  skill: PlacementSkill
  /** The exam task this item copies the format of, in that exam's words. */
  task: string
  /** The instruction, in English. */
  ask: string
  /** A text to read, or (listening) the text the device says aloud. */
  passage?: string
  /** The question line in the target language. `___` marks a gap. */
  stem: string
  /** Four options. The right one is always first; a run shuffles them. */
  choices: string[]
  /** One English line on why the answer is right. */
  why: string
}

export type PlacementBank = {
  lang: VocabLang
  questions: PlacementQuestion[]
}
