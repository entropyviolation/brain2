/**
 * components/Lab/NodeDetailLab/lab-store.ts — The lab's own copy of the world
 *
 * A clone of `useTaskStore` (tasks, lists, folders) that the mockups write to.
 * **Sandbox** (default): writes stay here and never reach disk. While the copy is
 * untouched it follows the real store live, so edits made in the app show up.
 * **Live**: writes go through the real `updateTask` / `addTask`, same as the card.
 * Spent minutes are sim-only (`spent`), fed by the ▶ clock.
 */
"use client"

import { create } from "zustand"
import type { Folder, List, Subtask, Task } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"

export type LabMode = "sandbox" | "live"

interface LabState {
  mode: LabMode
  /** True once the sandbox copy has its own edits; it stops following the real store. */
  dirty: boolean
  tasks: Task[]
  lists: List[]
  folders: Folder[]
  spent: Record<string, number>
  log: { at: number; text: string }[]
  setMode: (m: LabMode) => void
  reset: () => void
  updateTask: (t: Task) => void
  addTask: (t: Task) => void
  addSpent: (id: string, min: number) => void
  say: (text: string) => void
}

const clone = <T,>(v: T): T => {
  try {
    return structuredClone(v)
  } catch {
    return JSON.parse(JSON.stringify(v)) as T
  }
}

function readReal() {
  const s = useTaskStore.getState()
  const tasks = clone(s.tasks ?? [])
  return { tasks: tasks.some((t) => t.subtasks?.length) ? tasks : [...tasks, ...demoTasks()], lists: clone(s.lists ?? []), folders: clone(s.folders ?? []) }
}

export const useLab = create<LabState>()((set, get) => ({
  mode: "sandbox",
  dirty: false,
  ...readReal(),
  spent: {},
  log: [],
  setMode: (mode) => {
    set({ mode })
    if (mode === "live") set({ ...readReal(), dirty: false })
    get().say(mode === "live" ? "Live: writes reach the real store" : "Sandbox: writes stay in the lab")
  },
  reset: () => (set({ ...readReal(), dirty: false, spent: {} }), get().say("Copied the real store again")),
  updateTask: (t) => {
    if (get().mode === "live") useTaskStore.getState().updateTask(t)
    else set((s) => ({ dirty: true, tasks: s.tasks.map((x) => (x.id === t.id ? t : x)) }))
  },
  addTask: (t) => {
    if (get().mode === "live") useTaskStore.getState().addTask(t)
    else set((s) => ({ dirty: true, tasks: [...s.tasks, t] }))
  },
  addSpent: (id, min) => set((s) => ({ spent: { ...s.spent, [id]: Math.max(0, (s.spent[id] ?? 0) + min) } })),
  say: (text) => set((s) => ({ log: [...s.log.slice(-5), { at: Date.now(), text }] })),
}))

// Follow the real store: always in Live, and in Sandbox until the copy is edited.
if (typeof window !== "undefined") {
  useTaskStore.subscribe((real, prev) => {
    if (real.tasks === prev.tasks && real.lists === prev.lists) return
    const lab = useLab.getState()
    if (lab.mode === "live" || !lab.dirty) useLab.setState({ ...readReal() })
  })
}

// ── A demo task for an empty store ───────────────────────────────────

function step(id: string, description: string, extra: Partial<Subtask> = {}): Subtask {
  return { id, description, completed: false, ...extra }
}

function demoTasks(): Task[] {
  const now = new Date()
  const subtasks: Subtask[] = [
    step("lab-s1", "Chaos CD Design", {
      tier: "goal",
      estimatedDuration: 20,
      actualDuration: 62,
      subtasks: [
        step("lab-s1a", "Pick the typeface", { completed: true, tier: "min", estimatedDuration: 15 }),
        step("lab-s1b", "Cover photograph", { completed: true, tier: "min", estimatedDuration: 30 }),
        step("lab-s1c", "Spine and tray card", { tier: "goal", estimatedDuration: 25 }),
        step("lab-s1d", "Disc face", { tier: "goal", estimatedDuration: 20, dependsOn: ["lab-s1c"] }),
        step("lab-s1e", "Booklet, 8 panels", { tier: "goal", estimatedDuration: 45 }),
        step("lab-s1f", "Lace die-cut sleeve", { tier: "exceptional", estimatedDuration: 50 }),
      ],
    }),
    step("lab-s2", "Order the pressing", { tier: "goal", estimatedDuration: 15, dependsOn: ["lab-s1"] }),
    step("lab-s3", "Mail promo copies", { tier: "exceptional", estimatedDuration: 30 }),
  ]
  return [
    { id: "lab-task-cds", title: "Finish CDs", completed: false, subtasks, createdAt: now, noteLog: [{ id: "lab-n1", date: "2026-10-20", text: "fdgbdgbs", tag: "notice" }] } as unknown as Task,
    { id: "lab-ev-proof", title: "Printer sends proof", type: "event", completed: false, createdAt: now } as unknown as Task,
    { id: "lab-item-scans", title: "Lace scans folder", type: "item", completed: false, createdAt: now } as unknown as Task,
  ]
}
