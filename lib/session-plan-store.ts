/**
 * lib/session-plan-store.ts — Open sessions and the ones behind them
 *
 * `open` holds every draft and parked session, plus at most one running or in
 * review (`admitSession` parks the old one when another goes live).
 * `focusId` is the one the popup shows. `history` keeps every closed session
 * (an append log: Data reads estimate pace and tier hit rate from it,
 * never from `open`). `kept` are lines a review chose to keep for the next
 * session; the next new draft starts with them. `templates` are the person's
 * saved session shapes (built-ins live in code, `BUILT_IN_TEMPLATES`); old
 * blobs load without it. Logic lives in
 * `lib/session-plan.ts`; this is only the blob.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import {
  admitSession,
  allLines,
  isLiveSession,
  migrateSessionPlan,
  parkSession,
  renameTier,
  type SessionPlan,
  type SessionTemplate,
  type SessionTier,
} from "@/lib/session-plan"

export interface KeptSessionRef {
  tier: SessionTier
  taskId: string
  stepId?: string
}

interface SessionPlanState {
  open: SessionPlan[]
  focusId: string | null
  history: SessionPlan[]
  kept: KeptSessionRef[]
  templates: SessionTemplate[]
  /** Add or replace an open session. Returns the sessions it parked to make room. */
  put: (plan: SessionPlan, now?: Date) => SessionPlan[]
  /** Show this session in the popup. An empty draft left behind is dropped. */
  focus: (id: string | null) => void
  remove: (id: string) => void
  /** Move a closed session into history and remember what to keep. */
  archive: (plan: SessionPlan, kept: KeptSessionRef[]) => void
  clearKept: () => void
  /** Save a template; one with the same title is replaced. */
  saveTemplate: (template: SessionTemplate) => void
  removeTemplate: (id: string) => void
}

type SessionBlob = Pick<SessionPlanState, "open" | "focusId" | "history" | "kept"> & { templates?: SessionTemplate[] }

function isEmptyDraft(plan: SessionPlan | undefined): boolean {
  return !!plan && plan.phase === "draft" && allLines(plan).length === 0
}

export const useSessionPlanStore = create<SessionPlanState>()(
  persist(
    (set, get) => ({
      open: [],
      focusId: null,
      history: [],
      kept: [],
      templates: [],
      put: (plan, now = new Date()) => {
        const { open, parked } = admitSession(get().open, plan, now)
        set({ open })
        return parked
      },
      focus: (id) =>
        set((state) => {
          const left = state.open.find((p) => p.id === state.focusId)
          const drop = left && left.id !== id && isEmptyDraft(left)
          return { focusId: id, open: drop ? state.open.filter((p) => p.id !== left.id) : state.open }
        }),
      remove: (id) =>
        set((state) => ({ open: state.open.filter((p) => p.id !== id), focusId: state.focusId === id ? null : state.focusId })),
      archive: (plan, kept) =>
        set((state) => ({
          open: state.open.filter((p) => p.id !== plan.id),
          focusId: state.focusId === plan.id ? null : state.focusId,
          history: [...state.history, plan],
          kept,
        })),
      clearKept: () => set({ kept: [] }),
      saveTemplate: (template) =>
        set((state) => ({
          templates: [
            ...state.templates.filter((t) => t.id !== template.id && t.title.toLowerCase() !== template.title.toLowerCase()),
            template,
          ],
        })),
      removeTemplate: (id) => set((state) => ({ templates: state.templates.filter((t) => t.id !== id) })),
    }),
    {
      name: persistKey("session-plans"),
      storage: createCogsJSONStorage(),
      partialize: (state) => ({
        open: state.open,
        focusId: state.focusId,
        history: state.history,
        kept: state.kept,
        templates: state.templates,
      }),
      version: 2,
      migrate: (persisted) => migrateSessionBlob(persisted),
    },
  ),
)

/** The running or in-review session, if any. */
export function liveSession(open: readonly SessionPlan[]): SessionPlan | undefined {
  return open.find(isLiveSession)
}

/**
 * Any stored version to the current shape.
 * - v0 → v1: the third tier id `excellent` became `exceptional` (slice Q).
 * - v1 → v2: the single `current` moved into `open` and got the focus (slice H).
 * Tier renames run on every plan, so a half-migrated blob also comes out right.
 * Only one session stays live; any other live one is parked.
 */
export function migrateSessionBlob(persisted: unknown): SessionBlob {
  const blob = (persisted ?? {}) as {
    current?: unknown
    open?: unknown
    focusId?: unknown
    history?: unknown
    kept?: unknown
    templates?: unknown
  }
  const plans = (value: unknown) =>
    Array.isArray(value) ? value.map(migrateSessionPlan).filter((p): p is SessionPlan => p !== null) : []
  const history = plans(blob.history)
  const kept = Array.isArray(blob.kept)
    ? (blob.kept as KeptSessionRef[]).filter((ref) => ref && typeof ref.taskId === "string").map((ref) => ({ ...ref, tier: renameTier(ref.tier) as SessionTier }))
    : []
  const current = migrateSessionPlan(blob.current)
  let open: SessionPlan[] = []
  for (const plan of [...plans(blob.open), ...(current && current.phase !== "done" ? [current] : [])]) {
    if (open.some((p) => p.id === plan.id)) continue
    open = admitSession(open, plan).open
  }
  const focusId =
    typeof blob.focusId === "string" && open.some((p) => p.id === blob.focusId)
      ? blob.focusId
      : current && open.some((p) => p.id === current.id)
        ? current.id
        : null
  const templates = Array.isArray(blob.templates)
    ? (blob.templates as SessionTemplate[]).filter((t) => t && typeof t.id === "string" && t.tiers)
    : []
  return { open, focusId, history, kept, templates }
}

/**
 * Park the running session from outside the popup (the focus bar). Returns
 * the parked plan, or null when nothing runs. A painting session's pen clock
 * pauses with it (`linkSessionAndPen` in `lib/session-pen.ts`).
 */
export function parkLiveSession(now = new Date(), futureNote?: string): SessionPlan | null {
  const store = useSessionPlanStore.getState()
  const live = liveSession(store.open)
  if (!live || live.phase !== "run") return null
  const parked = parkSession(live, now, futureNote)
  store.put(parked, now)
  return parked
}
