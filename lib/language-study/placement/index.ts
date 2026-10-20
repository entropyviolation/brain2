/**
 * lib/language-study/placement/index.ts — The placement door
 *
 * `loadPlacementBank` imports one language's bank on demand, so the quiz text
 * stays out of the Home bundle until someone opens a placement quiz.
 */

import type { VocabLang } from "@/lib/vocab/types"
import type { PlacementBank } from "@/lib/language-study/placement/types"

export type { PlacementBank, PlacementQuestion, PlacementSkill } from "@/lib/language-study/placement/types"
export * from "@/lib/language-study/placement/scorer"

export async function loadPlacementBank(lang: VocabLang): Promise<PlacementBank> {
  switch (lang) {
    case "fr":
      return (await import("@/lib/language-study/placement/fr")).FR_PLACEMENT
    case "es":
      return (await import("@/lib/language-study/placement/es")).ES_PLACEMENT
    case "it":
      return (await import("@/lib/language-study/placement/it")).IT_PLACEMENT
    case "de":
      return (await import("@/lib/language-study/placement/de")).DE_PLACEMENT
    case "ja":
      return (await import("@/lib/language-study/placement/ja")).JA_PLACEMENT
    case "zh":
      return (await import("@/lib/language-study/placement/zh")).ZH_PLACEMENT
    case "en":
      return (await import("@/lib/language-study/placement/en")).EN_PLACEMENT
  }
}

export const PLACEMENT_SKILL_LABEL = {
  listening: "Listening",
  reading: "Reading",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
} as const
