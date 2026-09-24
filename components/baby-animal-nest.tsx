/**
 * components/baby-animal-nest.tsx — Header friend for today's companion
 *
 * Click the photograph for this friend's details (the same page as Gallery
 * Details). The chat button beside the name asks them to speak. Click the
 * bubble for the mission sheet: the task opens item detail on top, Accept
 * starts a same-day point window, Decline walks through a smaller task, a
 * first step, and a reason. Escape, ×, or outside click dismisses the bubble
 * without declining. Finishing an accepted mission opens a small cheer.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { BabyAnimalFriendGallery } from "@/components/baby-animal-gallery"
import { FriendDetailsPanel } from "@/components/friend-details"
import { FriendSpeechBubble } from "@/components/friend-details/FriendSpeechBubble"
import { FriendMissionSheet } from "@/components/friend-mission-sheet"
import { pickFriendTodoNudge, type FriendNudge } from "@/lib/baby-animal-nudge"
import { personalityFor } from "@/lib/baby-animal-personality"
import { ensureWeeklyFriend } from "@/lib/baby-animal-friend"
import { consumeReunionLine, isPriorMonday } from "@/lib/baby-animal-greeting"
import { localMondayKey } from "@/lib/baby-animals"
import { friendCheerLine } from "@/lib/friend-copy"
import { isActionableFriendKind, type FriendMission } from "@/lib/friend-mission"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"
import { useAttachmentSrc } from "@/components/use-attachment-src"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { isClearedFromWork } from "@/lib/completion-status"

/** CRT bezel power-on length (ms) — one short gesture, not a loop. */
const CRT_POWER_ON_MS = 560

function reunionNudge(line: string): FriendNudge {
  return {
    taskId: null,
    line,
    source: null,
    kind: "reunion",
    title: "Hello again",
    blurb: "Just saying hi — not a mission. The chat button asks for work.",
    effect: "heart",
    rewardPoints: 0,
  }
}

function ChatMark() {
  return (
    <svg viewBox="0 0 24 18" width="18" height="14" aria-hidden="true">
      <path
        d="M2.2 1.6h14.2c.7 0 1.2.5 1.2 1.2v8.2c0 .7-.5 1.2-1.2 1.2H7.2L2.2 16.4V2.8c0-.7.5-1.2 1.2-1.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BabyAnimalNest() {
  const personalities = useBabyAnimalsStore((s) => s.personalities)
  const displayName = useBabyAnimalsStore((s) => s.displayName)
  const currentPhotoId = useBabyAnimalsStore((s) => s.currentPhotoId)
  const photos = useBabyAnimalsStore((s) => s.photos)
  const photo = photos.find((p) => p.id === currentPhotoId)
  const src = useAttachmentSrc(photo?.uri, photo?.sourceUrl)
  const [busy, setBusy] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsCover, setDetailsCover] = useState(false)
  const [galleryCover, setGalleryCover] = useState(false)
  const [missionOpen, setMissionOpen] = useState(false)
  const [nudge, setNudge] = useState<FriendNudge | null>(null)
  const [cheer, setCheer] = useState<FriendMission | null>(null)
  const [crtPowerOn, setCrtPowerOn] = useState(false)
  const nestRef = useRef<HTMLDivElement>(null)
  const closeDetails = useRef<() => void>(() => setDetailsOpen(false))
  const hadBubbleRef = useRef(false)

  useEffect(() => {
    const open = nudge !== null
    const justOpened = open && !hadBubbleRef.current
    hadBubbleRef.current = open
    if (!justOpened) return
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCrtPowerOn(false)
      return
    }
    setCrtPowerOn(true)
    const timer = window.setTimeout(() => setCrtPowerOn(false), CRT_POWER_ON_MS)
    return () => window.clearTimeout(timer)
  }, [nudge])

  useEffect(() => {
    let cancelled = false
    const stop = afterPersistHydrated(useBabyAnimalsStore.persist, () => {
      if (cancelled) return
      const stored = useBabyAnimalsStore.getState()
      const monday = localMondayKey()
      const needsFetch = !stored.currentPhotoId || isPriorMonday(stored.weekKey, monday)
      if (needsFetch) setBusy(true)
      void ensureWeeklyFriend().finally(() => {
        if (cancelled) return
        setBusy(false)
        const reunion = consumeReunionLine()
        if (reunion) setNudge(reunionNudge(reunion))
      })
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [])

  useEffect(() => {
    let lastId = useBabyAnimalsStore.getState().currentPhotoId
    return useBabyAnimalsStore.subscribe((state) => {
      if (state.currentPhotoId === lastId) return
      lastId = state.currentPhotoId
      const reunion = consumeReunionLine()
      if (reunion) setNudge(reunionNudge(reunion))
    })
  }, [])

  useEffect(() => {
    if (!nudge) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      if (galleryOpen || missionOpen || detailsOpen || cheer) return
      event.preventDefault()
      setNudge(null)
    }
    const onPointer = (event: MouseEvent) => {
      if (missionOpen || galleryOpen || detailsOpen || cheer) return
      const node = nestRef.current
      if (node && !node.contains(event.target as Node)) setNudge(null)
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onPointer)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onPointer)
    }
  }, [nudge, galleryOpen, missionOpen, detailsOpen, cheer])

  useEffect(() => {
    const scan = () => {
      const store = useBabyAnimalsStore.getState()
      store.expireDueMissions()
      const tasks = useTaskStore.getState().tasks
      const habits = useHabitsStore.getState()
      const today = formatLocalDateKey(new Date())
      for (const mission of store.friendMissions) {
        if (mission.status !== "accepted" || !mission.taskId) continue
        if (mission.kind === "whim" || mission.kind === "affection") continue
        if (mission.taskId.startsWith("habit:")) {
          const habitId = mission.taskId.slice("habit:".length)
          const habit = habits.tasks.find((row) => row.id === habitId)
          if (habit && isHabitGoalMet(habit, habits.weeklyData[today]?.[habitId], { date: new Date(), weeklyData: habits.weeklyData })) {
            const done = store.completeMission(mission.taskId)
            if (done) setCheer(done)
          }
          continue
        }
        const task = tasks.find((row) => row.id === mission.taskId)
        if (!task) continue
        if (mission.stepId) {
          const step = task.subtasks?.find((row) => row.id === mission.stepId)
          if (step?.completed) {
            const done = store.completeMission(mission.taskId)
            if (done) setCheer(done)
          }
          continue
        }
        if (task.completed || isClearedFromWork(task)) {
          const done = store.completeMission(mission.taskId)
          if (done) setCheer(done)
        }
      }
    }
    scan()
    const a = useTaskStore.subscribe(scan)
    const b = useHabitsStore.subscribe(scan)
    return () => {
      a()
      b()
    }
  }, [])

  const speak = () => {
    const items = useTaskStore.getState()
    const friend = useBabyAnimalsStore.getState()
    const habits = useHabitsStore.getState()
    const personality = personalityFor(friend.personalities, friend.animalId, friend.displayName)
    const next = pickFriendTodoNudge(items.tasks, items.folders, nudge?.taskId ?? null, Math.random, {
      personality,
      habits: habits.tasks,
      weeklyData: habits.weeklyData,
      habitExemptions: habits.habitExemptions,
      flavor: true,
    })
    if (isActionableFriendKind(next.kind)) {
      friend.offerMission({
        animalId: friend.animalId,
        displayName: friend.displayName,
        title: next.title,
        line: next.line,
        blurb: next.blurb,
        source: next.source,
        taskId: next.taskId,
        kind: next.kind,
        points: next.rewardPoints,
        effect: next.effect,
      })
    }
    setMissionOpen(false)
    setNudge(next)
  }

  const finishSheet = (done: FriendMission | null) => {
    setMissionOpen(false)
    setNudge(null)
    if (done) setCheer(done)
  }

  const who = displayName || "today's friend"
  const photoLabel = photo ? `Open details for ${who}` : "Open the friend gallery"
  const chatLabel = nudge ? `Ask ${who} for another line` : `Ask ${who} for a mission`
  const celebrate = cheer
    ? personalityFor(personalities, cheer.animalId, cheer.displayName).pushiness === "celebrate"
    : false

  return (
    <div
      className="baby-nest"
      ref={nestRef}
      data-ui-name="Today's friend"
      data-ui-docs="docs/FRIEND_COMPANION.md"
    >
      <button
        type="button"
        className="baby-nest-hit"
        onClick={() => (photo ? setDetailsOpen(true) : setGalleryOpen(true))}
        aria-label={photoLabel}
        title={photoLabel}
        disabled={busy && !photo}
      >
        <span className={`baby-nest-crt${crtPowerOn ? " is-powering" : ""}`}>
          <span className={`baby-nest-screen${busy ? " is-busy" : ""}`}>
            {src ? <img src={src} alt="" /> : <span className="baby-nest-placeholder" />}
          </span>
        </span>
      </button>
      {nudge ? (
        <FriendSpeechBubble
          effect={nudge.effect}
          line={nudge.line}
          onLineClick={() => setMissionOpen(true)}
          onClose={() => {
            setMissionOpen(false)
            setNudge(null)
          }}
        />
      ) : null}
      <span className="baby-nest-wordmark">
        <span className="baby-nest-name">{displayName || (busy ? "Finding…" : "today's friend")}</span>
        <span className="baby-nest-controls">
          <button type="button" className="baby-nest-chat-hit" onClick={speak} aria-label={chatLabel} title={chatLabel} disabled={busy}>
            <ChatMark />
            Chat
          </button>
          <button type="button" className="baby-nest-gallery-hit" onClick={() => setGalleryOpen(true)}>
            Gallery
          </button>
        </span>
      </span>
      <Dialog open={galleryOpen} modal={!galleryCover} onOpenChange={setGalleryOpen}>
        <DialogContent className="baby-friend-dialog flex max-h-[min(88vh,760px)] flex-col overflow-hidden sm:max-w-3xl">
          <DialogHeader className="baby-friend-dialog-head">
            <DialogTitle>Baby animal friend</DialogTitle>
            <DialogDescription>
              Add, remove, and request friends. Details holds history, the mission journal, and personality.
              The worn friend stays until Monday, or until you change it.
            </DialogDescription>
          </DialogHeader>
          <BabyAnimalFriendGallery onCoverChange={setGalleryCover} />
        </DialogContent>
      </Dialog>
      <Dialog
        open={detailsOpen}
        modal={!detailsCover}
        onOpenChange={(next) => {
          if (next) setDetailsOpen(true)
          else closeDetails.current()
        }}
      >
        <DialogContent
          className="baby-friend-dialog baby-friend-instrument-dialog flex max-h-[min(88vh,900px)] flex-col overflow-hidden sm:max-w-3xl"
          hideClose
          onEscapeKeyDown={(event) => {
            if (detailsCover) event.preventDefault()
          }}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{who} details</DialogTitle>
            <DialogDescription>History, mission journal, and personality for this friend.</DialogDescription>
          </DialogHeader>
          <FriendDetailsPanel
            photo={photo ?? null}
            onClose={() => setDetailsOpen(false)}
            closeBridge={closeDetails}
            onCoverChange={setDetailsCover}
          />
        </DialogContent>
      </Dialog>
      <FriendMissionSheet
        open={missionOpen && !!nudge}
        nudge={nudge}
        friendName={who}
        onOpenChange={setMissionOpen}
        onFinished={finishSheet}
      />
      <Dialog open={!!cheer} onOpenChange={(next) => { if (!next) setCheer(null) }}>
        <DialogContent className="baby-friend-cheer fm98-dialog z-[90] max-w-none gap-0 p-0" overlayClassName="z-[90]" hideClose>
          <DialogHeader className="baby-friend-cheer-head">
            <p className="baby-friend-mission-kicker">{cheer?.displayName || who}</p>
            <DialogTitle className="baby-friend-cheer-title">You did it</DialogTitle>
            <DialogDescription className="baby-friend-cheer-line">
              {cheer ? friendCheerLine(cheer.displayName, cheer.stepTitle || cheer.title, cheer.points, cheer.effect) : ""}
            </DialogDescription>
          </DialogHeader>
          {celebrate ? <p className="baby-friend-cheer-extra">They saved a little extra fuss for this one.</p> : null}
          <div className="baby-friend-mission-actions">
            <button type="button" className="baby-friend-cheer-ok" onClick={() => setCheer(null)}>
              Lovely
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
