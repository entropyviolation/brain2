/**
 * lib/plan-bimby/store.ts — The live run, kept across a reload
 *
 * One `Run` at a time. Each action takes a pure step from `run.ts`, then fires the effects it earned
 * (`apply.ts`): a closed play becomes time on a confirmed task, a finished intake item logs its intake once,
 * a filed confirmation becomes a Flight item. Effects are written onto the item so the list can say what happened.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { fileFlight, logIntakeFor, logSpanOnTask } from "./apply"
import * as clock from "./run"
import type { PlanItem, PlanLink, Run } from "./types"

interface PlanRunState {
  run: Run | null
  begin: (items: PlanItem[], remarks: string[], source: string, now?: Date) => void
  play: (id: string, now?: Date) => void
  pause: (id: string, now?: Date) => void
  complete: (id: string, now?: Date) => void
  skip: (id: string, now?: Date) => void
  reopen: (id: string) => void
  toggleSub: (id: string, subId: string) => void
  /** File a flight from a pasted confirmation on this item. Finishes the item if it is still open. */
  fileConfirmation: (id: string, raw: string, now?: Date) => string | null
  end: () => void
}

/** Time goes to a task only after the person confirmed the match. */
function confirmedTaskId(link: PlanLink | undefined): string | null {
  return link?.kind === "task" && link.confirmed ? link.taskId : null
}

export const usePlanRunStore = create<PlanRunState>()(
  persist(
    (set, get) => {
      /** Log the spans a step closed, then record what each wrote. */
      const settle = (step: clock.Step): Run => {
        let run = step.run
        for (const span of step.spans) {
          const item = run.items.find((i) => i.id === span.itemId)
          const taskId = confirmedTaskId(item?.link)
          const said = taskId ? logSpanOnTask(taskId, span) : null
          if (said) run = clock.addEffect(run, span.itemId, said)
        }
        const done = step.finished
        if (done?.link?.kind === "intake" && !done.effects.some((e) => e.startsWith("Logged intake"))) {
          const said = logIntakeFor(done, done.link, new Date(done.doneAt ?? Date.now()))
          if (said) run = clock.addEffect(run, done.id, said)
        }
        return run
      }
      const apply = (make: (run: Run) => clock.Step) => {
        const run = get().run
        if (run) set({ run: settle(make(run)) })
      }
      return {
        run: null,
        begin: (items, remarks, source, now = new Date()) => set({ run: clock.startRun(items, remarks, source, now) }),
        play: (id, now = new Date()) => apply((run) => clock.play(run, id, now)),
        pause: (id, now = new Date()) => apply((run) => clock.pause(run, id, now)),
        complete: (id, now = new Date()) => apply((run) => clock.complete(run, id, now)),
        skip: (id, now = new Date()) => apply((run) => clock.skip(run, id, now)),
        reopen: (id) => set((s) => (s.run ? { run: clock.reopen(s.run, id) } : s)),
        toggleSub: (id, subId) => set((s) => (s.run ? { run: clock.toggleSub(s.run, id, subId) } : s)),
        fileConfirmation: (id, raw, now = new Date()) => {
          const said = fileFlight(raw, now)
          const run = get().run
          if (!said || !run) return null
          const item = run.items.find((i) => i.id === id)
          let next = clock.addEffect(run, id, said)
          next = { ...next, items: next.items.map((i) => (i.id === id ? { ...i, needsConfirmation: false } : i)) }
          set({ run: next })
          if (item && item.state !== "done" && item.state !== "skipped") get().complete(id, now)
          return said
        },
        end: () => set({ run: null }),
      }
    },
    {
      name: persistKey("plan-bimby-run"),
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ run: state.run }),
      version: 1,
    },
  ),
)

registerPersistRehydrator(persistKey("plan-bimby-run"), () => usePlanRunStore.persist.rehydrate())
