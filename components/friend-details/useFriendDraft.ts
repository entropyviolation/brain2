/**
 * components/friend-details/useFriendDraft.ts — Local personality draft
 *
 * Save writes the overlay and leaves the page open. Close discards.
 * Presets fill voice and weights and leave title loves and list marks alone.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import {
  personalityFor,
  sanitizeFriendPersonality,
  type FriendPersonality,
} from "@/lib/baby-animal-personality"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"

export const FRIEND_PRESETS: { id: string; label: string; patch: Partial<FriendPersonality> }[] = [
  {
    id: "cuddly",
    label: "Cuddly",
    patch: {
      tone: "gentle",
      dialogEffect: "heart",
      cadence: "chatty",
      pushiness: "nudge",
      habitWeight: 24,
      todoWeight: 58,
      nextActionsWeight: 22,
      urgencyBias: 18,
      loveYouRate: 72,
      whimRate: 36,
      rewardScale: 48,
      suggestionRate: 28,
      whimId: "curl",
    },
  },
  {
    id: "coach",
    label: "Coach",
    patch: {
      tone: "coach",
      dialogEffect: "stamp",
      cadence: "occasional",
      pushiness: "celebrate",
      habitWeight: 22,
      todoWeight: 28,
      nextActionsWeight: 80,
      urgencyBias: 64,
      loveYouRate: 8,
      whimRate: 10,
      rewardScale: 60,
      suggestionRate: 44,
      whimId: "read",
    },
  },
  {
    id: "wanderer",
    label: "Wanderer",
    patch: {
      tone: "playful",
      dialogEffect: "sparkle",
      cadence: "quiet",
      pushiness: "never",
      habitWeight: 34,
      todoWeight: 33,
      nextActionsWeight: 33,
      urgencyBias: 12,
      loveYouRate: 18,
      whimRate: 55,
      rewardScale: 32,
      suggestionRate: 16,
      whimId: "walk",
    },
  },
  {
    id: "drill",
    label: "Drill sergeant",
    patch: {
      tone: "direct",
      dialogEffect: "bounce",
      cadence: "eager",
      pushiness: "insist",
      habitWeight: 40,
      todoWeight: 70,
      nextActionsWeight: 48,
      urgencyBias: 96,
      loveYouRate: 0,
      whimRate: 0,
      rewardScale: 84,
      suggestionRate: 70,
      whimId: "stretch",
    },
  },
]

export function personalitySignature(personality: FriendPersonality): string {
  return JSON.stringify(sanitizeFriendPersonality(personality))
}

export function confirmDiscard(dirty: boolean): boolean {
  if (!dirty) return true
  return window.confirm("Discard unsaved personality changes?")
}

export function useFriendDraft(animalId: string, displayName: string) {
  const personalities = useBabyAnimalsStore((s) => s.personalities)
  const setPersonality = useBabyAnimalsStore((s) => s.setPersonality)
  const baseline = useMemo(
    () => personalityFor(personalities, animalId, displayName),
    [personalities, animalId, displayName],
  )
  const [draft, setDraft] = useState(baseline)
  const [savedLamp, setSavedLamp] = useState(false)

  useEffect(() => {
    setDraft(personalityFor(useBabyAnimalsStore.getState().personalities, animalId, displayName))
    setSavedLamp(false)
  }, [animalId, displayName])

  const dirty = personalitySignature(draft) !== personalitySignature(baseline)

  const patch = (partial: Partial<FriendPersonality>) => setDraft((prev) => ({ ...prev, ...partial }))

  const applyPreset = (partial: Partial<FriendPersonality>) => {
    setDraft((prev) => ({ ...prev, ...partial, titleLoves: prev.titleLoves, listBias: prev.listBias }))
  }

  const revert = () => {
    setDraft(baseline)
    setSavedLamp(false)
  }

  const save = () => {
    const next = sanitizeFriendPersonality(draft)
    setPersonality(animalId, next)
    setDraft(next)
    setSavedLamp(true)
  }

  useEffect(() => {
    if (!savedLamp) return
    const timer = window.setTimeout(() => setSavedLamp(false), 1600)
    return () => window.clearTimeout(timer)
  }, [savedLamp])

  return { draft, dirty, savedLamp, patch, applyPreset, revert, save }
}
