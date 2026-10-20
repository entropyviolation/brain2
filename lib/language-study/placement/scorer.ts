/**
 * lib/language-study/placement/scorer.ts — The placement ladder
 *
 * A run climbs the CEFR ladder one stage at a time, like the level papers of
 * DELF or the JLPT. Each stage is `perLevel` questions drawn from that level.
 * Passing a stage (`pass` right) moves up. Failing ends the climb. A stage
 * also ends early once a pass is out of reach, so a learner does not grind
 * through questions above them.
 *
 * A run may start above A1. If its first stage fails, it steps down until a
 * stage passes or A1 is tried. The placed level is the highest stage passed.
 * Nothing passed places at A1 with `belowA1` set.
 *
 * Everything here is pure: state in, state out. The quiz component owns the
 * state; nothing is saved until the person accepts the result.
 */

import { CEFR_LEVELS, type CefrLevel } from "@/lib/widgets/language-levels"
import type { PlacementBank, PlacementQuestion } from "@/lib/language-study/placement/types"

export const PLACEMENT_PER_LEVEL = 4
export const PLACEMENT_PASS = 3

/** A question as one run shows it: options shuffled, `answer` remapped. */
export type PlacementItem = PlacementQuestion & { answer: number }

export type PlacementAnswer = { id: string; level: CefrLevel; choice: number; correct: boolean }

export type PlacementState = {
  /** The stages this run has drawn, by level. */
  stages: Partial<Record<CefrLevel, PlacementItem[]>>
  level: CefrLevel
  /** Index into the current stage. */
  pos: number
  answers: PlacementAnswer[]
  /** Levels whose stage passed, and failed. */
  passed: CefrLevel[]
  failed: CefrLevel[]
  /** Climbing up from a pass, or stepping down from a first failure. */
  direction: "up" | "down"
  done: boolean
  perLevel: number
  pass: number
}

export type PlacementResult = {
  level: CefrLevel
  /** True when not even the A1 stage passed. */
  belowA1: boolean
  correct: number
  total: number
  byLevel: Record<CefrLevel, [number, number]>
}

export type PlacementOptions = {
  start?: CefrLevel
  perLevel?: number
  pass?: number
  /** Returns [0, 1). Defaults to `Math.random`; tests pass a seeded one. */
  random?: () => number
}

/** A small seeded generator (mulberry32) for repeatable runs in tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = next[i]!
    next[i] = next[j]!
    next[j] = swap
  }
  return next
}

/** The same question with its options in a fresh order. */
export function shuffleChoices(question: PlacementQuestion, random: () => number): PlacementItem {
  const order = shuffle(
    question.choices.map((_, i) => i),
    random,
  )
  return {
    ...question,
    choices: order.map((i) => question.choices[i]!),
    answer: order.indexOf(0),
  }
}

/** Levels the bank can test, lowest first. English has no A1 Cambridge paper, but the bank may still fill it. */
export function placementLevels(bank: PlacementBank): CefrLevel[] {
  return CEFR_LEVELS.filter((level) => bank.questions.some((q) => q.level === level))
}

function drawStages(bank: PlacementBank, perLevel: number, random: () => number): PlacementState["stages"] {
  const stages: PlacementState["stages"] = {}
  for (const level of placementLevels(bank)) {
    const pool = bank.questions.filter((q) => q.level === level)
    // Reading and listening first in a stage, as the exams order their papers.
    const picked = shuffle(pool, random).slice(0, perLevel)
    const rank = { listening: 0, reading: 1, vocabulary: 2, grammar: 3 } as const
    picked.sort((a, b) => rank[a.skill] - rank[b.skill])
    stages[level] = picked.map((q) => shuffleChoices(q, random))
  }
  return stages
}

export function startPlacement(bank: PlacementBank, options: PlacementOptions = {}): PlacementState {
  const random = options.random ?? Math.random
  const levels = placementLevels(bank)
  const perLevel = options.perLevel ?? PLACEMENT_PER_LEVEL
  const stages = drawStages(bank, perLevel, random)
  const start = options.start && levels.includes(options.start) ? options.start : (levels[0] ?? "A1")
  return {
    stages,
    level: start,
    pos: 0,
    answers: [],
    passed: [],
    failed: [],
    direction: "up",
    done: levels.length === 0,
    perLevel,
    pass: Math.min(options.pass ?? PLACEMENT_PASS, perLevel),
  }
}

export function currentItem(state: PlacementState): PlacementItem | undefined {
  if (state.done) return undefined
  return state.stages[state.level]?.[state.pos]
}

/** Right answers and questions asked so far in one stage. */
export function stageScore(state: PlacementState, level: CefrLevel): [number, number] {
  const mine = state.answers.filter((a) => a.level === level)
  return [mine.filter((a) => a.correct).length, mine.length]
}

function neighbor(state: PlacementState, step: 1 | -1): CefrLevel | undefined {
  const levels = CEFR_LEVELS.filter((level) => (state.stages[level]?.length ?? 0) > 0)
  return levels[levels.indexOf(state.level) + step]
}

function closeStage(state: PlacementState, passedStage: boolean): PlacementState {
  const passed = passedStage ? [...state.passed, state.level] : state.passed
  const failed = passedStage ? state.failed : [...state.failed, state.level]
  const base = { ...state, passed, failed, pos: 0 }
  if (passedStage) {
    // A pass while stepping down finds the floor: the climb above already failed.
    const up = state.direction === "up" ? neighbor(state, 1) : undefined
    return up ? { ...base, level: up } : { ...base, done: true }
  }
  // A failure on the very first stage, above A1, steps down to find a floor.
  const firstStage = state.passed.length === 0
  const down = firstStage ? neighbor(state, -1) : undefined
  return down ? { ...base, level: down, direction: "down" } : { ...base, done: true }
}

/** Record one answer and advance. Returns the state unchanged when the run is over. */
export function answerPlacement(state: PlacementState, choice: number): PlacementState {
  const item = currentItem(state)
  if (!item) return state
  const answers = [...state.answers, { id: item.id, level: state.level, choice, correct: choice === item.answer }]
  const next = { ...state, answers }
  const stage = state.stages[state.level] ?? []
  const [right, asked] = stageScore(next, state.level)
  const left = stage.length - asked
  if (right + left < state.pass) return closeStage(next, false)
  if (left === 0) return closeStage(next, right >= state.pass)
  return { ...next, pos: state.pos + 1 }
}

/** The result so far. Valid mid-run: an unfinished stage counts as not passed. */
export function placementResult(state: PlacementState): PlacementResult {
  const byLevel = Object.fromEntries(CEFR_LEVELS.map((level) => [level, stageScore(state, level)])) as Record<
    CefrLevel,
    [number, number]
  >
  const top = [...state.passed].sort((a, b) => CEFR_LEVELS.indexOf(b) - CEFR_LEVELS.indexOf(a))[0]
  return {
    level: top ?? "A1",
    belowA1: !top,
    correct: state.answers.filter((a) => a.correct).length,
    total: state.answers.length,
    byLevel,
  }
}

/** The most questions a run could ask from this start. */
export function placementMaxQuestions(state: PlacementState): number {
  return CEFR_LEVELS.reduce((sum, level) => sum + (state.stages[level]?.length ?? 0), 0)
}
