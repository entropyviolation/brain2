/**
 * lib/widgets/dashboard-store.ts — The Visual dashboard's installed copies
 *
 * Storage: `brain2-home-dashboard` (persist v1). Holds every installed copy,
 * one layout per style (Milled, Dash), the chosen style, copies of kinds this
 * build does not know (`unknown`, never dropped), and the old strip as first
 * read (`legacy`, for Reset to my old layout).
 *
 * First run builds the dashboard from `brain2-home-widgets`, the Days Until
 * marks, and the Vocab languages (`dashboardFromLegacy`). A vault that
 * already had a saved strip lands on Milled; a fresh one starts on Dash.
 *
 * Dual-write: every change also writes the old order / hidden pair back to
 * `brain2-home-widgets`, so an older build still opens the same strip. A
 * change to that old pair from anywhere else (an old backup, an old caller)
 * shows or hides whole kinds here. Countdown copies follow the Days Until
 * marks one to one, and every Vocab language keeps a Language study copy.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { homeWidgetsHadSavedLayout, useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { useHomeDaysUntilStore } from "@/lib/home-days-until-store"
import { useVocabStore } from "@/lib/vocab-store"
import { isHomeWidgetId, type HomeWidgetId } from "@/lib/home-widgets"
import {
  EMPTY_DASHBOARD,
  applyLegacyView,
  dashboardFromLegacy,
  installBlocker,
  legacyViewOf,
  makeCopy,
  moveInOrder,
  reconcileCountdowns,
  reconcileLanguages,
  sanitizeDashboard,
  stepInOrder,
  withCopy,
  withoutCopy,
  type DashboardData,
} from "@/lib/widgets/dashboard"
import { sanitizeWidgetSettings, snapWidgetSize, widgetKind } from "@/lib/widgets/kinds"
import type {
  DashboardStyle,
  MilledSize,
  WidgetCopy,
  WidgetKindId,
  WidgetSettings,
  WidgetSize,
} from "@/lib/widgets/types"
import { registerPhoneWindowStore } from "@/lib/phone-window"

export const HOME_DASHBOARD_STORAGE_KEY = persistKey("home-dashboard")

/** Plain per-device key the old Points ticker saved its period under. */
const POINTS_PERIOD_KEY = "brain2-home-points-period"

type InstallOptions = {
  key?: string
  title?: string
  settings?: WidgetSettings
  hidden?: boolean
  /** Place the new copy right after this one. */
  after?: string
}

export type InstallResult = { id: string; created: boolean }

interface DashboardState extends DashboardData {
  /** False until the first dashboard was built from the old stores. */
  migrated: boolean
  /** Test and reset hook: the style the next build lands on. */
  nextStyle: DashboardStyle | null
  ensureReady: () => void
  setStyle: (style: DashboardStyle) => void
  hideCopy: (id: string) => void
  showCopy: (id: string) => void
  moveCopy: (id: string, toIndex: number) => void
  stepCopy: (id: string, direction: -1 | 1) => void
  resizeCopy: (id: string, size: WidgetSize | "auto") => void
  updateCopy: (id: string, patch: Partial<Pick<WidgetCopy, "title" | "lamp" | "daySource" | "showFoot" | "key">>) => void
  updateCopySettings: (id: string, patch: WidgetSettings) => void
  markGuideSeen: (id: string, seen?: boolean) => void
  installCopy: (kind: WidgetKindId, options?: InstallOptions) => InstallResult | null
  removeCopy: (id: string) => void
  resetToLegacy: () => void
  resetDashboard: (style?: DashboardStyle) => void
}

function readPointsPeriod(): string | null {
  try {
    const raw = window.localStorage.getItem(POINTS_PERIOD_KEY)
    return raw === "day" || raw === "week" || raw === "month" || raw === "all" ? raw : null
  } catch {
    return null
  }
}

function buildFromLegacy(style: DashboardStyle | null): DashboardData {
  const legacy = useHomeWidgetsStore.getState()
  const vocab = useVocabStore.getState()
  let data = dashboardFromLegacy({
    order: legacy.order,
    hidden: legacy.hidden,
    countdownIds: useHomeDaysUntilStore.getState().items.map((item) => item.id),
    vocab: { languages: vocab.languages, active: vocab.active, levels: vocab.levels },
    pointsPeriod: typeof window === "undefined" ? null : readPointsPeriod(),
    hadSavedLayout: homeWidgetsHadSavedLayout(),
  })
  if (style) data = { ...data, style }
  return data
}

function hydrated(store: { persist?: { hasHydrated: () => boolean } }): boolean {
  return store.persist?.hasHydrated?.() ?? true
}

/** True while this store writes the old pair, so its own write is not read back as an outside change. */
let writingLegacy = false

function writeLegacy(data: DashboardData) {
  const view = legacyViewOf(data)
  const order = view.order.filter(isHomeWidgetId) as HomeWidgetId[]
  const hidden = view.hidden.filter(isHomeWidgetId) as HomeWidgetId[]
  const current = useHomeWidgetsStore.getState()
  if (current.order.join("|") === order.join("|") && current.hidden.join("|") === hidden.join("|")) return
  writingLegacy = true
  try {
    useHomeWidgetsStore.setState({ order, hidden })
  } finally {
    writingLegacy = false
  }
}

function pick(state: DashboardState): DashboardData {
  return {
    copies: state.copies,
    unknown: state.unknown,
    style: state.style,
    dash: state.dash,
    milled: state.milled,
    legacy: state.legacy,
  }
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => {
      /** Apply a change to the dashboard, then dual-write the old pair. */
      const commit = (change: (data: DashboardData) => DashboardData) => {
        if (!get().migrated) get().ensureReady()
        const next = change(pick(get()))
        set(next)
        writeLegacy(next)
      }
      const layoutKey = () => (get().style === "milled" ? "milled" : "dash")

      return {
        ...EMPTY_DASHBOARD,
        migrated: false,
        nextStyle: null,
        ensureReady: () => {
          if (get().migrated) return
          if (
            !hydrated(useDashboardStore) ||
            !hydrated(useHomeWidgetsStore) ||
            !hydrated(useHomeDaysUntilStore) ||
            !hydrated(useVocabStore)
          ) {
            return
          }
          const data = buildFromLegacy(get().nextStyle)
          set({ ...data, migrated: true, nextStyle: null })
          writeLegacy(data)
        },
        setStyle: (style) => commit((data) => ({ ...data, style })),
        hideCopy: (id) =>
          commit((data) => ({
            ...data,
            copies: data.copies.map((copy) => (copy.id === id ? { ...copy, hidden: true } : copy)),
            unknown: data.unknown.map((entry) => (entry.id === id ? { ...entry, hidden: true } : entry)),
          })),
        showCopy: (id) =>
          commit((data) => ({
            ...data,
            copies: data.copies.map((copy) => (copy.id === id ? { ...copy, hidden: false } : copy)),
          })),
        moveCopy: (id, toIndex) =>
          commit((data) => {
            const key = layoutKey()
            return { ...data, [key]: { ...data[key], order: moveInOrder(data[key].order, id, toIndex) } }
          }),
        stepCopy: (id, direction) =>
          commit((data) => {
            const key = layoutKey()
            const showing = new Set(data.copies.filter((copy) => !copy.hidden).map((copy) => copy.id))
            return { ...data, [key]: { ...data[key], order: stepInOrder(data[key].order, id, direction, showing) } }
          }),
        resizeCopy: (id, size) =>
          commit((data) => {
            const copy = data.copies.find((entry) => entry.id === id)
            if (!copy) return data
            if (data.style === "milled") {
              const sizes: Record<string, MilledSize> = { ...data.milled.sizes }
              if (size === "auto") delete sizes[id]
              else sizes[id] = size
              return { ...data, milled: { ...data.milled, sizes } }
            }
            if (size === "auto") return data
            return { ...data, dash: { ...data.dash, sizes: { ...data.dash.sizes, [id]: snapWidgetSize(copy.kind, size) } } }
          }),
        updateCopy: (id, patch) =>
          commit((data) => ({
            ...data,
            copies: data.copies.map((copy) => (copy.id === id ? { ...copy, ...patch } : copy)),
          })),
        updateCopySettings: (id, patch) =>
          commit((data) => ({
            ...data,
            copies: data.copies.map((copy) =>
              copy.id === id
                ? { ...copy, settings: sanitizeWidgetSettings(copy.kind, { ...copy.settings, ...patch }) }
                : copy,
            ),
          })),
        markGuideSeen: (id, seen = true) =>
          commit((data) => ({
            ...data,
            copies: data.copies.map((copy) => (copy.id === id ? { ...copy, guideSeen: seen } : copy)),
          })),
        installCopy: (kind, options = {}) => {
          if (!widgetKind(kind)) return null
          if (!get().migrated) get().ensureReady()
          const blocker = installBlocker(pick(get()), kind, options.key)
          if (blocker) {
            if (blocker.hidden && options.hidden !== true) get().showCopy(blocker.id)
            return { id: blocker.id, created: false }
          }
          const copy = makeCopy(kind, {
            ...(options.key != null ? { key: options.key } : {}),
            title: options.title,
            settings: options.settings,
            hidden: options.hidden,
          })
          commit((data) => withCopy(data, copy, options.after))
          return { id: copy.id, created: true }
        },
        removeCopy: (id) => commit((data) => withoutCopy(data, id)),
        resetToLegacy: () => {
          const legacy = get().legacy
          if (!legacy) return
          commit((data) => {
            const shown = new Set(legacy.order.filter((id) => !legacy.hidden.includes(id)))
            const rank = (kind: string) => {
              const at = legacy.order.indexOf(kind)
              return at < 0 ? legacy.order.length : at
            }
            const copies = data.copies.map((copy) => ({ ...copy, hidden: !shown.has(copy.kind) }))
            const order = [...data.milled.order].sort((a, b) => {
              const ka = data.copies.find((copy) => copy.id === a)?.kind ?? a
              const kb = data.copies.find((copy) => copy.id === b)?.kind ?? b
              return rank(ka) - rank(kb)
            })
            return { ...data, copies, style: "milled", milled: { order, sizes: {} } }
          })
        },
        resetDashboard: (style) => set({ ...EMPTY_DASHBOARD, migrated: false, nextStyle: style ?? null }),
      }
    },
    {
      name: HOME_DASHBOARD_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ ...pick(state), migrated: state.migrated }),
      merge: (persisted, current) => {
        const raw = persisted as (Partial<DashboardData> & { migrated?: boolean }) | undefined
        if (!raw || raw.migrated !== true) return { ...current, migrated: false }
        return { ...current, ...sanitizeDashboard(raw), migrated: true }
      },
      onRehydrateStorage: () => () => {
        queueMicrotask(() => useDashboardStore.getState().ensureReady())
      },
    },
  ),
)

/** Copy by id, for components that hold one. */
export function selectCopy(id: string) {
  return (state: DashboardState) => state.copies.find((copy) => copy.id === id)
}

// Follow the old stores. Client only: the server render has no vault.
if (typeof window !== "undefined") {
  useHomeWidgetsStore.subscribe((state, prev) => {
    if (writingLegacy) return
    const dash = useDashboardStore.getState()
    if (!dash.migrated) {
      dash.ensureReady()
      return
    }
    if (state.order === prev.order && state.hidden === prev.hidden) return
    const next = applyLegacyView(pick(dash), { order: state.order, hidden: state.hidden })
    useDashboardStore.setState(next)
  })
  useHomeDaysUntilStore.subscribe((state, prev) => {
    if (state.items === prev.items) return
    const dash = useDashboardStore.getState()
    if (!dash.migrated) return
    const ids = state.items.map((item) => item.id)
    const next = reconcileCountdowns(pick(dash), ids)
    if (next.copies !== dash.copies) {
      useDashboardStore.setState(next)
      writeLegacy(next)
    }
  })
  useVocabStore.subscribe((state, prev) => {
    if (state.languages === prev.languages) return
    const dash = useDashboardStore.getState()
    if (!dash.migrated) return
    const next = reconcileLanguages(pick(dash), state.languages)
    if (next.copies !== dash.copies) {
      useDashboardStore.setState(next)
      writeLegacy(next)
    }
  })
  for (const store of [useHomeWidgetsStore, useHomeDaysUntilStore, useVocabStore]) {
    store.persist?.onFinishHydration?.(() => useDashboardStore.getState().ensureReady())
  }
}

registerPhoneWindowStore(useDashboardStore)
