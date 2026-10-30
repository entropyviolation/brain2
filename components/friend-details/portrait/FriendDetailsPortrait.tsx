/**
 * components/friend-details/portrait/FriendDetailsPortrait.tsx — Photograph, bond, today’s mission
 *
 * The lace window and the bond meter share one top and one bottom.
 * Chat previews a line and does not write a mission.
 * Change picture and Remove live here, off the gallery card.
 */
"use client"

import { useRef, useState } from "react"
import type { FriendDialogEffect, FriendPersonality } from "@/lib/baby-animal-personality"
import type { FriendSuggestion } from "@/lib/friend-suggestion"
import { isActionableFriendKind, type FriendMission } from "@/lib/friend-mission"
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
import { FriendDetailsReadouts } from "@/components/friend-details/portrait/FriendDetailsReadouts"

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
  onDismiss,
  onReplacePicture,
  onRemove,
  pictureBusy,
  firstSeenAt,
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
  onDismiss: () => void
  onReplacePicture?: (file: File) => void
  onRemove?: () => void
  pictureBusy?: boolean
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
  const fileRef = useRef<HTMLInputElement>(null)
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
            {line ? <FriendSpeechBubble className="friend-say-bubble" effect={draft.dialogEffect} line={line} /> : null}
          </div>
        </figure>
        <div className="friend-side">
          <div className="friend-side-head">
            <h2 className="friend-name">
              {name}
              {levelPulse ? <span className="friend-level-flash"> LV {bond.level}</span> : null}
            </h2>
            <button type="button" className="friend-dismiss" data-no95="" aria-label="Dismiss friend details" onClick={onDismiss}>
              Close
            </button>
          </div>
          <FriendDetailsReadouts
            bond={bond}
            points={points}
            streak={streak}
            teaser={nextUnlock(bond)}
            wearCount={wearCount}
            firstSeenAt={firstSeenAt}
          />
          {onReplacePicture || onRemove ? (
            <div className="friend-manage">
              {onReplacePicture ? (
                <>
                  <button
                    type="button"
                    className="friend-key"
                    data-no95=""
                    disabled={pictureBusy}
                    onClick={() => fileRef.current?.click()}
                  >
                    {pictureBusy ? "Cutting out…" : "Change picture"}
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ""
                      if (file) onReplacePicture(file)
                    }}
                  />
                </>
              ) : null}
              {onRemove ? (
                <button type="button" className="friend-key" data-no95="" onClick={onRemove}>
                  Remove
                </button>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className={`friend-say${bloom ? " is-down" : ""}`}
            data-no95=""
            onClick={chat}
            title="Preview a line with these settings. Nothing is logged."
          >
            Chat
          </button>
        </div>
      </div>
      <FriendMissionStrip
        mission={pinned}
        now={now}
        effect={draft.dialogEffect}
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
  flying,
  onOpen,
  onFinish,
}: {
  mission: FriendMission | null
  now: Date
  effect: FriendDialogEffect
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
  const title = mission.stepTitle || mission.title

  return (
    <div className={`friend-mission is-${effect} is-scope is-${mission.status}`}>
      <span className={`friend-lamp is-${mission.status}`} aria-hidden="true" />
      {onOpen ? (
        <button type="button" className="friend-mission-title is-play" data-no95="" onClick={() => onOpen(mission.id)}>
          {title}
        </button>
      ) : (
        <p className="friend-mission-title">{title}</p>
      )}
      {clock ? <span className="friend-due is-seg">{clock}</span> : <span className="friend-due is-seg is-empty" />}
      {canAccept ? (
        <button type="button" className="friend-key is-on" data-no95="" onClick={() => useBabyAnimalsStore.getState().acceptMission(mission.taskId)}>
          Accept mission
        </button>
      ) : null}
      {canFinish ? (
        <button
          type="button"
          className="friend-key is-on"
          data-no95=""
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
