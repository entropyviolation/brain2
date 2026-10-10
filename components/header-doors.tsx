/**
 * components/header-doors.tsx — Thin pin-bar keys
 *
 * Inbox, Quick Add, Rituals, and Settings stay on the first paint. The rooms
 * behind them load the first time they open, so a refresh does not download
 * a closed door. The mill keys themselves (label, count, gear) are here.
 * Rituals loads on the first press and replaces this key with the real menu;
 * the next press opens that menu. Quick Add mounts `QuickAddWroteHost` on the
 * key so the floating "added" confirmation outlives the dialog chunk.
 */
"use client"

import { useEffect, useMemo, useState, type ComponentType } from "react"
import { ClipboardCheck, Inbox as InboxIcon, Plus, Settings as SettingsIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MachineLoading } from "@/components/machine-loading"
import { QuickAddWroteHost } from "@/components/quick-add-wrote"
import { openRevisitInboxIds } from "@/lib/inbox-batch"
import { countAvailableRituals } from "@/lib/rituals"
import { useReviewsStore } from "@/lib/reviews-store"
import { listStarLordSlots } from "@/lib/star-lord"
import { useStarLordStore } from "@/lib/star-lord-store"
import { useTaskStore } from "@/lib/task-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"

function useDoor<T>(open: boolean, load: () => Promise<T>): T | null {
  const [mod, setMod] = useState<T | null>(null)
  useEffect(() => {
    if (!open || mod) return
    let cancelled = false
    void load().then((value) => {
      if (!cancelled) setMod(() => value)
    })
    return () => {
      cancelled = true
    }
  }, [open, mod, load])
  return mod
}

function DoorWait({ show }: { show: boolean }) {
  if (!show) return null
  return <MachineLoading size="pip" decorative />
}

type InboxDoorProps = {
  onTaskSelect: (taskId: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export function InboxKey({ onTaskSelect }: { onTaskSelect: (taskId: string) => void }) {
  const tasks = useTaskStore((state) => state.tasks)
  const revisitCount = openRevisitInboxIds(tasks).size
  const [open, setOpen] = useState(false)
  const load = useMemo(
    () => () => import("@/components/inbox").then((mod) => mod.Inbox as ComponentType<InboxDoorProps>),
    [],
  )
  const Inbox = useDoor(open, load)
  const title = revisitCount > 0 ? `${revisitCount} to revisit` : "Inbox — nothing to revisit"

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        data-inbox-entry=""
        title={title}
        onClick={() => setOpen(true)}
      >
        <InboxIcon className="h-4 w-4" />
        Inbox
        {revisitCount > 0 ? (
          <Badge variant="secondary" className="b2-shell-count">
            {revisitCount}
          </Badge>
        ) : null}
      </Button>
      {Inbox ? (
        <Inbox hideTrigger open={open} onOpenChange={setOpen} onTaskSelect={onTaskSelect} />
      ) : (
        <DoorWait show={open} />
      )}
    </>
  )
}

type QuickAddDoorProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  seed?: string
  hideTrigger?: boolean
}

export function QuickAddKey({
  open = false,
  onOpenChange,
  seed,
}: {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  seed?: string
}) {
  const load = useMemo(
    () => () => import("@/components/quick-add").then((mod) => mod.QuickAdd as ComponentType<QuickAddDoorProps>),
    [],
  )
  const QuickAdd = useDoor(open, load)

  return (
    <>
      <Button size="sm" className="b2-shell-go gap-1" onClick={() => onOpenChange?.(true)}>
        <Plus className="h-4 w-4" />
        <span>Quick Add</span>
      </Button>
      <QuickAddWroteHost />
      {QuickAdd ? (
        <QuickAdd hideTrigger open={open} onOpenChange={onOpenChange} seed={seed} />
      ) : (
        <DoorWait show={open} />
      )}
    </>
  )
}

type SettingsDoorProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  hideTrigger?: boolean
}

export function SettingsKey() {
  const [open, setOpen] = useState(false)
  const load = useMemo(
    () => () =>
      import("@/components/Settings/SettingsDialog").then(
        (mod) => mod.SettingsDialog as ComponentType<SettingsDoorProps>,
      ),
    [],
  )
  const Settings = useDoor(open, load)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="b2-shell-icon"
        title="Settings"
        aria-label="Settings"
        onClick={() => setOpen(true)}
      >
        <SettingsIcon />
      </Button>
      {Settings ? <Settings hideTrigger open={open} onOpenChange={setOpen} /> : <DoorWait show={open} />}
    </>
  )
}

export function RitualsKey() {
  const reviews = useReviewsStore((s) => s.reviews)
  const starReports = useStarLordStore((s) => s.reports)
  const birthday = useUserSettingsStore((s) => s.birthday)
  const now = useMemo(() => new Date(), [])
  const starSlots = useMemo(() => listStarLordSlots(starReports, now, birthday), [starReports, now, birthday])
  const availableCount = useMemo(
    () => countAvailableRituals(reviews, now) + starSlots.filter((slot) => slot.status !== "done").length,
    [reviews, now, starSlots],
  )
  const [Rituals, setRituals] = useState<ComponentType | null>(null)

  function load() {
    if (Rituals) return
    void import("@/components/Reviews/reviews").then((mod) => {
      setRituals(() => mod.Rituals)
    })
  }

  if (Rituals) return <Rituals />

  const title =
    availableCount > 0 ? `${availableCount} ritual${availableCount === 1 ? "" : "s"} available` : "Rituals"

  return (
    <Button
      variant="outline"
      size="sm"
      className="relative"
      data-home-review-entry
      data-rituals-entry
      title={title}
      onPointerDown={load}
      onClick={load}
    >
      <ClipboardCheck className="h-4 w-4 mr-2" />
      Rituals
      {availableCount > 0 ? (
        <Badge className="b2-shell-count" variant="default">
          {availableCount}
        </Badge>
      ) : null}
    </Button>
  )
}
