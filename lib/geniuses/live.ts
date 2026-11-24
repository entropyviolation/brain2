/**
 * lib/geniuses/live.ts — The geniuses against the live stores (client)
 *
 * The header friend and the mission sheet use these; the lab has its own model bar. Reads items, habits, goals and the
 * friend's personalities; finds the model the way BIM chat does (`chatCrew`, read-only import).
 */
"use client"

import { chatCrew } from "@/lib/bim-flow/chat-models"
import { ollamaCall } from "@/lib/bim-flow/ollama"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import type { AreaVault } from "./read"
import { geniusContext, type GeniusContext, type ModelRun } from "./run"
import { useGeniusesStore } from "./store"
import type { Genius } from "./types"

export function liveVault(now = new Date()): AreaVault {
  const items = useTaskStore.getState()
  const habits = useHabitsStore.getState()
  const goals = useGoalsStore.getState()
  return {
    tasks: items.tasks,
    lists: items.lists,
    habits: habits.tasks,
    weeklyData: habits.weeklyData,
    habitExemptions: habits.habitExemptions,
    goals: goals.goals,
    objectives: goals.objectives,
    now,
  }
}

/** The face card's name for a genius: the gallery card it wears, else "". */
export function faceNameFor(g: Genius): string {
  const photo = useBabyAnimalsStore.getState().photos.find((p) => p.animalId === g.animalId)
  return photo?.displayName.trim() ?? ""
}

export function liveContext(g: Genius, exceptTalkId?: string): GeniusContext {
  const s = useGeniusesStore.getState()
  return geniusContext({
    genius: g,
    vault: liveVault(),
    personalities: useBabyAnimalsStore.getState().personalities,
    talks: s.talks,
    meetings: s.meetings,
    names: Object.fromEntries(s.geniuses.map((x) => [x.id, x.name])),
    exceptTalkId,
    faceName: faceNameFor(g),
  })
}

/** The main local model, or a script-only run when none answers. */
export async function liveRun(): Promise<ModelRun> {
  const crew = await chatCrew().catch(() => null)
  return crew ? { call: ollamaCall(crew.main), ladder: [crew.main], temperature: 0.4 } : { call: null, ladder: [] }
}
