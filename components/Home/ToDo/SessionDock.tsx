/**
 * components/Home/ToDo/SessionDock.tsx — The session popup for ways in outside To Do
 *
 * Loaded by the header Now box (`components/header-now-box.tsx`) only when
 * `lib/session-open-store.ts` holds a request: the focus bar's **Session** /
 * **Just 25**, Plan's **Session in this time**, or the header's session chip.
 * The pick list's lens is today's open tasks. To Do's fascia keeps its own
 * planner; both read the same session store.
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useSessionOpenStore } from "@/lib/session-open-store"
import { isClearedFromWork } from "@/lib/completion-status"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { SessionPlanner } from "./SessionPlanner"

export default function SessionDock() {
  const request = useSessionOpenStore((s) => s.request)
  const clear = useSessionOpenStore((s) => s.clear)
  const tasks = useTaskStore((s) => s.tasks)
  const today = useMemo(() => {
    const now = new Date()
    return tasks.filter((t) => !t.completed && !isClearedFromWork(t) && taskScheduledOnDay(t, now))
  }, [tasks])
  if (!request) return null
  const { startOn, ...rest } = request
  return <SessionPlanner open startOn={startOn} request={rest} onClose={clear} periodLabel="This day" periodTasks={today} />
}
