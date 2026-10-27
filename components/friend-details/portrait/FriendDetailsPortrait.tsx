/**
 * components/friend-details/FriendDetailsPortrait.tsx — Photograph, bond, today’s mission
 *
 * Lace frames every friend. The dialog effect chooses the window.
 * Chat is the round key under the portrait and does not write a mission.
 */
"use client"

import { useState } from "react"
import type { FriendDialogEffect, FriendPersonality } from "@/lib/baby-animal-personality"
import type { FriendSuggestion } from "@/lib/friend-suggestion"
import { isActionableFriendKind, type FriendMission } from "@/lib/friend-mission"
import { friendSourceLabel } from "@/lib/friend-copy"
import {
  bondProgress,
  formatCountdownClock,
  friendStreak,
  pinnedMission,
  type BondProgress,
  type TodayLamp,
} from "@/lib/friend-stats"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { FriendSpeechBubble } from "@/components/friend-details/FriendSpeechBubble"
import { FriendDetailsReadouts } from "@/components/friend-details/FriendDetailsReadouts"

const FRAME: Record<FriendDialogEffect, string> = {
  plain: "arch",
  bounce: "arch",
  heart: "heart",
  stamp: "cameo",
  whisper: "medallion",
  sparkle: "tribal",
}

const UNLOCKS = [
  { level: 2, label: "oval cameo" },
  { level: 3, label: "round medallion" },
  { level: 4, label: "heart window" },
  { level: 5, label: "tribal frame" },
]

function nextUnlock(bond: BondProgress): string {
  const next = UNLOCKS.find((row) => bond.level < row.level)
  if (!next) return ""
  const left = (next.level - 1) * bond.need - bond.score
  if (left <= 0) return ""
  return `${left} more → ${next.label}`
}

function shortWhen(iso: string | undefined): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function FriendDetailsPortrait({
  name,
  src,
  draft,
  wearCount,
  points,
  missions,
  now,
  powering,
  sample,
  hoverLine,
  onSay,
  onOpenMission,
  firstSeenAt,
  lastAssignedAt,
  lamp,
  levelPulse,
}: {
  name: string
  src: string
  draft: FriendPersonality
  wearCount: number
  points: number
  missions: FriendMission[]
  now: Date
  powering: boolean
  sample: FriendSuggestion | null
  hoverLine: string
  onSay: () => void
  onOpenMission?: (id: string) => void
  firstSeenAt?: string
  lastAssignedAt?: string
  finished: number
  lamp: TodayLamp
  levelPulse: boolean
}) {
  const bond = bondProgress(points, wearCount)
  const streak = friendStreak(missions, now)
  const glow = Math.min(1, 0.3 + (bond.level - 1) * 0.14)
  const pinned = pinnedMission(missions, now)
  const frame = FRAME[draft.dialogEffect]
  const [bloom, setBloom] = useState(false)
  const [flying, setFlying] = useState(false)
  const line = sample?.line || hoverLine

  const chat = () => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onSay()
      return
    }
    setBloom(true)
    window.setTimeout(() => {
      setBloom(false)
      onSay()
    }, 420)
  }

  return (
    <div className="friend-stage">
      <div className="friend-face">
        <figure
          className={`friend-portrait is-${draft.dialogEffect} is-lace is-frame-${frame}${powering ? " is-powering" : ""}${bloom ? " is-bloom" : ""}${levelPulse ? " is-level" : ""}`}
          style={{ ["--bond-glow" as string]: String(glow) }}
        >
          <div className="friend-portrait-glass">
            <span className="friend-portrait-glow" aria-hidden="true" />
            {src ? <img className="friend-portrait-photo" src={src} alt="" /> : <span className="friend-portrait-photo is-empty" />}
            <span className="friend-lace" aria-hidden="true" />
            <span className="friend-nub is-nw" aria-hidden="true" />
            <span className="friend-nub is-ne" aria-hidden="true" />
            <span className="friend-nub is-sw" aria-hidden="true" />
            <span className="friend-nub is-se" aria-hidden="true" />
          </div>
          <span className="friend-hud is-met">met {shortWhen(firstSeenAt)}</span>
          <span className="friend-hud is-worn">worn ×{wearCount}</span>
          <figcaption className="friend-portrait-caption">
            <h2 className="friend-name">
              {name}
              {levelPulse ? <span className="friend-level-flash"> LV {bond.level} ✦</span> : null}
            </h2>
          </figcaption>
          {line ? (
            <FriendSpeechBubble className="friend-say-bubble" effect={draft.dialogEffect} line={line} />
          ) : (
            <p className="friend-idle">tap me ✦</p>
          )}
        </figure>
        <button
          type="button"
          className={`friend-say${bloom ? " is-down" : ""}`}
          onClick={chat}
          title="Preview a line with these settings. Nothing is logged."
        >
          Chat
        </button>
        <FriendDetailsReadouts bond={bond} points={points} streak={streak} teaser={nextUnlock(bond)} />
      </div>
      <FriendMissionStrip
        mission={pinned}
        now={now}
        effect={draft.dialogEffect}
        lamp={lamp}
        flying={flying}
        onOpen={onOpenMission}
        onFinish={() => {
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            setFlying(true)
            window.setTimeout(() => setFlying(false), 700)
          }
        }}
      />
    </div>
  )
}

function FriendMissionStrip({
  mission,
  now,
  effect,
  lamp,
  flying,
  onOpen,
  onFinish,
}: {
  mission: FriendMission | null
  now: Date
  effect: FriendDialogEffect
  lamp: TodayLamp
  flying: boolean
  onOpen?: (id: string) => void
  onFinish: () => void
}) {
  if (!mission) {
    return (
      <div className={`friend-mission is-${effect} is-scope`}>
        <p className="friend-mission-title">No mission today.</p>
      </div>
    )
  }

  const clock = mission.status === "accepted" ? formatCountdownClock(mission.deadline, now) : ""
  const canAccept = mission.status === "offered" && isActionableFriendKind(mission.kind) && Boolean(mission.taskId)
  const canFinish = mission.status === "accepted" && mission.kind === "whim"

  return (
    <div className={`friend-mission is-${effect} is-scope is-${mission.status}`} data-lamp={lamp}>
      <div className="friend-mission-main">
        <span className={`friend-lamp is-${mission.status}`} aria-hidden="true" />
        <div>
          <p className="friend-mission-kicker">{friendSourceLabel(mission.source)}</p>
          {onOpen ? (
            <button type="button" className="friend-mission-title is-play" onClick={() => onOpen(mission.id)}>
              <span aria-hidden="true">▶ </span>
              {mission.stepTitle || mission.title}
            </button>
          ) : (
            <p className="friend-mission-title">{mission.stepTitle || mission.title}</p>
          )}
        </div>
        {clock ? <span className="friend-due is-seg">{clock}</span> : null}
      </div>
      {canAccept ? (
        <button type="button" className="friend-key is-on" onClick={() => useBabyAnimalsStore.getState().acceptMission(mission.taskId)}>
          Accept
        </button>
      ) : null}
      {canFinish ? (
        <button
          type="button"
          className="friend-key is-on"
          onClick={() => {
            onFinish()
            useBabyAnimalsStore.getState().completeMission(mission.taskId)
          }}
        >
          I did it
        </button>
      ) : null}
      {flying
        ? [0, 1, 2].map((gem) => <span key={gem} className="friend-fly-gem" style={{ ["--fly" as string]: String(gem) }} />)
        : null}
    </div>
  )
}
