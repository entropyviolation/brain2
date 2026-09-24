/**
 * components/friend-details/FriendDetailsPanel.tsx — One friend’s instrument
 *
 * Portrait, four readouts, voice keys, equalizer, keepsakes, journal.
 * The draft stays local until Save personality. Close asks when it is dirty.
 * Chat previews a line and does not log a mission.
 */
"use client"

import { useEffect, useState, type MutableRefObject } from "react"
import type { BabyAnimalPhoto } from "@/lib/baby-animal-photos"
import { pickFriendTodoNudge } from "@/lib/baby-animal-nudge"
import type { FriendSuggestion } from "@/lib/friend-suggestion"
import { missionsForAnimal } from "@/lib/friend-mission"
import { bondProgress, finishedMissionCount, friendPointsTotal, todayLamp } from "@/lib/friend-stats"
import { itemTitle } from "@/lib/item-utils"
import { isClearedFromWork } from "@/lib/completion-status"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { useAttachmentSrc } from "@/components/use-attachment-src"
import { FriendDetailsEqualizer } from "@/components/friend-details/FriendDetailsEqualizer"
import { FriendMissionDetail } from "@/components/friend-details/FriendMissionDetail"
import { FriendDetailsJournal } from "@/components/friend-details/FriendDetailsJournal"
import { FriendDetailsKeepsakes } from "@/components/friend-details/FriendDetailsKeepsakes"
import { FriendDetailsPortrait } from "@/components/friend-details/FriendDetailsPortrait"
import { FriendDetailsVoice } from "@/components/friend-details/FriendDetailsVoice"
import { confirmDiscard, useFriendDraft } from "@/components/friend-details/useFriendDraft"
import "@/components/friend-details/friend-details.css"

const POWER_MS = 560
const TAB_KEY = "brain2-friend-details-tab"
const TONE_KEY = "brain2-friend-tones"
type FriendTab = "today" | "personality" | "keepsakes" | "journal"

function readTab(animalId: string): FriendTab {
  if (typeof window === "undefined") return "today"
  const stored = window.localStorage.getItem(`${TAB_KEY}:${animalId}`)
  if (stored === "personality" || stored === "keepsakes" || stored === "journal" || stored === "today") return stored
  return "today"
}

function tonesTried(animalId: string): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = JSON.parse(window.localStorage.getItem(`${TONE_KEY}:${animalId}`) || "[]")
    return Array.isArray(raw) ? raw.length : 0
  } catch {
    return 0
  }
}

export function FriendDetailsPanel({
  photo,
  onClose,
  closeBridge,
  onCoverChange,
}: {
  photo: BabyAnimalPhoto | null
  onClose: () => void
  /** Dialog overlay and Escape call this after the panel installs it. */
  closeBridge?: MutableRefObject<() => void>
  /** True while item detail covers this page, so the parent dialog can drop its lock. */
  onCoverChange?: (open: boolean) => void
}) {
  const friendHistory = useBabyAnimalsStore((s) => s.friendHistory)
  const friendMissions = useBabyAnimalsStore((s) => s.friendMissions)
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const animalId = photo?.animalId ?? ""
  const displayName = photo?.displayName ?? ""
  const { draft, dirty, savedLamp, patch, applyPreset, revert, save } = useFriendDraft(animalId, displayName)
  const src = useAttachmentSrc(photo?.uri, photo?.sourceUrl)
  const [now, setNow] = useState(() => new Date())
  const [powering, setPowering] = useState(false)
  const [sample, setSample] = useState<FriendSuggestion | null>(null)
  const [hoverLine, setHoverLine] = useState("")
  const [tab, setTab] = useState<FriendTab>("today")
  const [missionId, setMissionId] = useState<string | null>(null)
  const [seenLevel, setSeenLevel] = useState<number | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    setSample(null)
    setHoverLine("")
    setTab(readTab(animalId))
    setSeenLevel(null)
    if (!photo) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPowering(false)
      return
    }
    setPowering(true)
    const timer = window.setTimeout(() => setPowering(false), POWER_MS)
    return () => window.clearTimeout(timer)
  }, [photo, animalId])

  const dismissPage = () => {
    if (!confirmDiscard(dirty)) return
    onClose()
  }

  const requestClose = () => {
    if (missionId) {
      setMissionId(null)
      return
    }
    dismissPage()
  }

  useEffect(() => {
    if (!closeBridge) return
    closeBridge.current = requestClose
  })

  const levelNow = bondProgress(
    friendPointsTotal(missionsForAnimal(friendMissions, animalId)),
    friendHistory.find((row) => row.animalId === animalId)?.wearCount ?? 0,
  ).level

  useEffect(() => {
    if (!animalId) return
    if (seenLevel == null) {
      setSeenLevel(levelNow)
      return
    }
    if (levelNow <= seenLevel) return
    const timer = window.setTimeout(() => setSeenLevel(levelNow), 1600)
    return () => window.clearTimeout(timer)
  }, [animalId, levelNow, seenLevel])

  if (!photo || !animalId) return null

  const who = displayName.trim() || "unnamed friend"
  const history = friendHistory.find((row) => row.animalId === animalId)
  const missions = missionsForAnimal(friendMissions, animalId)
  const titles = tasks.filter((task) => !isClearedFromWork(task)).map((task) => itemTitle(task)).filter(Boolean)
  const openMission = missions.find((row) => row.id === missionId) ?? null
  const bond = bondProgress(friendPointsTotal(missions), history?.wearCount ?? 0)
  const levelPulse = seenLevel != null && bond.level > seenLevel

  const chooseTab = (next: FriendTab) => {
    setTab(next)
    window.localStorage.setItem(`${TAB_KEY}:${animalId}`, next)
  }

  const patchTone = (partial: Parameters<typeof patch>[0]) => {
    if (partial.tone) {
      const key = `${TONE_KEY}:${animalId}`
      const current = (() => {
        try {
          const raw = JSON.parse(window.localStorage.getItem(key) || "[]")
          return Array.isArray(raw) ? raw.filter((row) => typeof row === "string") : []
        } catch {
          return []
        }
      })()
      if (!current.includes(partial.tone)) window.localStorage.setItem(key, JSON.stringify([...current, partial.tone]))
    }
    patch(partial)
  }

  const sayIt = () => {
    const items = useTaskStore.getState()
    const habits = useHabitsStore.getState()
    const next = pickFriendTodoNudge(items.tasks, items.folders, null, Math.random, {
      personality: draft,
      habits: habits.tasks,
      weeklyData: habits.weeklyData,
      habitExemptions: habits.habitExemptions,
      flavor: true,
    })
    setSample(next)
  }

  return (
    <div
      className="friend-instrument fm98-dialog"
      data-ui-name="Friend details"
      data-ui-docs="docs/FRIEND_COMPANION.md"
    >
      <button type="button" className="friend-dismiss" aria-label="Dismiss friend details" onClick={dismissPage}>
        ×
      </button>
      <FriendDetailsPortrait
        name={who}
        src={src}
        draft={draft}
        wearCount={history?.wearCount ?? 0}
        points={friendPointsTotal(missions)}
        missions={missions}
        now={now}
        powering={powering}
        sample={sample}
        hoverLine={hoverLine}
        onSay={sayIt}
        onOpenMission={setMissionId}
        firstSeenAt={history?.firstSeenAt}
        lastAssignedAt={history?.lastAssignedAt}
        finished={finishedMissionCount(missions)}
        lamp={todayLamp(missions, now)}
        levelPulse={levelPulse}
      />
      <div className="friend-tabs" role="tablist" aria-label="Friend pages">
        {(
          [
            ["today", "Today"],
            ["personality", "Personality"],
            ["keepsakes", "Keepsakes"],
            ["journal", "Journal"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`friend-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`friend-panel-${id}`}
            className={tab === id ? "is-on" : ""}
            onClick={() => chooseTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="friend-scroll" role="tabpanel" id={`friend-panel-${tab}`} aria-labelledby={`friend-tab-${tab}`}>
        {tab === "today" ? (
          <FriendDetailsJournal rows={missions.slice(-2).reverse()} now={now} onOpen={setMissionId} compact />
        ) : null}
        {tab === "personality" ? (
          <div id="friend-personality-body">
            <FriendDetailsVoice
              draft={draft}
              onChange={patchTone}
              onPreview={setHoverLine}
            />
            <FriendDetailsEqualizer draft={draft} titles={titles} lists={lists} onChange={patch} onPreset={applyPreset} />
          </div>
        ) : null}
        {tab === "keepsakes" ? (
          <FriendDetailsKeepsakes
            missions={missions}
            wearCount={history?.wearCount ?? 0}
            points={friendPointsTotal(missions)}
            tonesTried={tonesTried(animalId)}
            now={now}
          />
        ) : null}
        {tab === "journal" ? <FriendDetailsJournal rows={missions} now={now} onOpen={setMissionId} /> : null}
      </div>
      {openMission ? (
        <FriendMissionDetail
          mission={openMission}
          friendName={who}
          now={now}
          onClose={() => setMissionId(null)}
          onCoverChange={onCoverChange}
        />
      ) : null}
      <footer className="friend-footer">
        {dirty ? (
          <span className="friend-commit-lamp is-unsaved">Unsaved changes</span>
        ) : savedLamp ? (
          <span className="friend-commit-lamp is-saved">Saved</span>
        ) : (
          <span className="friend-commit-lamp" />
        )}
        <button type="button" className="friend-key" onClick={revert} disabled={!dirty}>
          Revert
        </button>
        <button type="button" className="friend-key" onClick={dismissPage}>
          Close
        </button>
        <button type="button" className="friend-key is-on" onClick={save} disabled={!dirty}>
          Save personality
        </button>
      </footer>
    </div>
  )
}
