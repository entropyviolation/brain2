/**
 * lib/inbox-bimby/store.ts — Suggestions and the shared queue
 *
 * A suggestion is advice, not data: it is never written onto the task. Acting on one
 * (`apply.ts`) is what changes the task. Suggestions are kept for this session only,
 * since the Inbox changes fast and an old suggestion is more often wrong than helpful.
 * The queue lives here (not in a component), so closing the dialog does not stop a pass.
 */
"use client"

import { create } from "zustand"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { embedScores, ollamaCall } from "@/lib/bim-flow/ollama"
import { useTaskStore } from "@/lib/task-store"
import { helpTask } from "./suggest"
import type { HelperSuggestion } from "./types"

interface HelperState {
  suggestions: Record<string, HelperSuggestion>
  run: { done: number; total: number; failed: number; current: string | null } | null
  drop: (taskId: string) => void
  clear: () => void
}

let stopFlag = false

export const useInboxHelperStore = create<HelperState>()((set) => ({
  suggestions: {},
  run: null,
  drop: (taskId) =>
    set((s) => {
      const { [taskId]: _gone, ...rest } = s.suggestions
      return { suggestions: rest }
    }),
  clear: () => set({ suggestions: {} }),
}))

/** Most ideas one pass will read. A model call each; the person can run it again. */
export const HELPER_BATCH = 25

/** Ask about each idea in turn, one at a time. A no-op while a pass is running. */
export async function runInboxHelper(ids: string[]): Promise<void> {
  const st = useInboxHelperStore
  if (st.getState().run) return
  const todo = ids.slice(0, HELPER_BATCH)
  if (!todo.length) return
  stopFlag = false
  st.setState({ run: { done: 0, total: todo.length, failed: 0, current: null } })
  const crew = await chatCrew().catch(() => null)
  for (const id of todo) {
    if (stopFlag) break
    const { tasks, lists } = useTaskStore.getState()
    const task = tasks.find((t) => t.id === id && t.stage === "inbox")
    let ok = true
    if (task) {
      st.setState((s) => ({ run: s.run && { ...s.run, current: id } }))
      try {
        const sug = await helpTask({
          task,
          tasks,
          lists,
          call: crew ? ollamaCall(crew.main) : null,
          ladder: crew?.pick ?? [],
          embed: (q, texts) => embedScores(q, texts),
        })
        st.setState((s) => ({ suggestions: { ...s.suggestions, [id]: sug } }))
      } catch {
        ok = false
      }
    }
    st.setState((s) => ({ run: s.run && { ...s.run, done: s.run.done + 1, failed: s.run.failed + (ok ? 0 : 1) } }))
  }
  st.setState({ run: null })
}

export function stopInboxHelper(): void {
  stopFlag = true
}
