/**
 * lib/home-widgets-store.ts — Which Home overview squares are showing
 *
 * One persist blob for every Home sub-tab (Habits / Plan / To Do / Goals /
 * Tracking). Order + hidden ids, plus whether the overview squares follow
 * the wall clock. Points math and review flow stay elsewhere. Storage:
 * `brain2-home-widgets`. Persist **v8** adds `widgetsFollowClock` and leaves
 * it off, so existing vaults keep the day being viewed. Persist **v7** places
 * Moon after Days Until and leaves it showing. Persist **v6** places Latest
 * award after Points and leaves it showing. Persist **v5** tucks Night well,
 * Harvest leftover, and Inbox mill on older blobs.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import {
  DEFAULT_HOME_WIDGET_HIDDEN,
  DEFAULT_HOME_WIDGET_ORDER,
  migrateHomeWidgetPersist,
  moveHomeWidget,
  sanitizeHomeWidgetHidden,
  sanitizeHomeWidgetOrder,
  visibleHomeWidgets,
  type HomeWidgetId,
} from "@/lib/home-widgets"

interface HomeWidgetsState {
  order: HomeWidgetId[]
  hidden: HomeWidgetId[]
  /** When true, overview squares read the wall clock instead of the selected day. */
  widgetsFollowClock: boolean
  hideWidget: (id: HomeWidgetId) => void
  showWidget: (id: HomeWidgetId) => void
  moveWidget: (id: HomeWidgetId, direction: -1 | 1) => void
  setWidgetsFollowClock: (follow: boolean) => void
  resetWidgets: () => void
}

const EMPTY: Pick<HomeWidgetsState, "order" | "hidden" | "widgetsFollowClock"> = {
  order: [...DEFAULT_HOME_WIDGET_ORDER],
  hidden: [...DEFAULT_HOME_WIDGET_HIDDEN],
  widgetsFollowClock: false,
}

export const useHomeWidgetsStore = create<HomeWidgetsState>()(
  persist(
    (set) => ({
      ...EMPTY,
      hideWidget: (id) =>
        set((state) => ({
          hidden: sanitizeHomeWidgetHidden([...state.hidden, id]),
        })),
      showWidget: (id) =>
        set((state) => ({
          hidden: state.hidden.filter((item) => item !== id),
        })),
      moveWidget: (id, direction) =>
        set((state) => ({
          order: moveHomeWidget(state.order, id, direction),
        })),
      setWidgetsFollowClock: (follow) => set({ widgetsFollowClock: follow }),
      resetWidgets: () => set({ ...EMPTY }),
    }),
    {
      name: persistKey("home-widgets"),
      version: 8,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({
        order: state.order,
        hidden: state.hidden,
        widgetsFollowClock: state.widgetsFollowClock,
      }),
      migrate: (persisted, version) =>
        migrateHomeWidgetPersist(
          persisted as { order?: unknown; hidden?: unknown; widgetsFollowClock?: unknown } | undefined,
          version,
        ),
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as Partial<
          Pick<HomeWidgetsState, "order" | "hidden" | "widgetsFollowClock">
        >
        return {
          ...current,
          order: sanitizeHomeWidgetOrder(raw.order),
          hidden: sanitizeHomeWidgetHidden(raw.hidden ?? DEFAULT_HOME_WIDGET_HIDDEN),
          widgetsFollowClock: raw.widgetsFollowClock === true,
        }
      },
    },
  ),
)

export function selectVisibleHomeWidgets(state: Pick<HomeWidgetsState, "order" | "hidden">) {
  return visibleHomeWidgets(state.order, state.hidden)
}

export function selectHiddenHomeWidgets(state: Pick<HomeWidgetsState, "order" | "hidden">) {
  const hide = new Set(state.hidden)
  return state.order.filter((id) => hide.has(id))
}
