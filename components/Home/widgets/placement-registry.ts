/**
 * components/Home/widgets/placement-registry.ts — Where the placement quiz plugs in
 *
 * Language study offers an optional placement quiz in the format of each
 * language's real exam. The quiz lives in `components/Home/language-study/`
 * and registers here, so the gear and the install setup can mount it. With
 * no quiz registered, they say it is not available yet and the level is set
 * by hand.
 */
"use client"

import type { ComponentType } from "react"
import type { CefrLevel } from "@/lib/widgets/language-levels"
import type { VocabLang } from "@/lib/vocab/types"

export type PlacementResult = {
  correct: number
  total: number
  byLevel: Record<CefrLevel, [number, number]>
}

export type PlacementQuizProps = {
  lang: VocabLang
  onResult: (level: CefrLevel, detail: PlacementResult) => void
  onCancel: () => void
}

let quiz: ComponentType<PlacementQuizProps> | null = null

export function registerPlacementQuiz(component: ComponentType<PlacementQuizProps>): void {
  quiz = component
}

export function placementQuiz(): ComponentType<PlacementQuizProps> | null {
  return quiz
}
