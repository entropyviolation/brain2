/**
 * Shared test helpers for component tests.
 */
import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement } from "react"
import { beforeEach } from "vitest"
import { useEventStore } from "@/lib/event-store"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import { useThemeStore } from "@/lib/theme-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { useMetricsStore } from "@/lib/metrics-store"
import { useRegretStore } from "@/lib/regret-store"
import { resetPersistStatus } from "@/lib/persist-storage"
import { clearAllAttachments } from "@/lib/attachments"

export function resetLocalStorage() {
  localStorage.clear()
  resetPersistStatus()
}

export function resetAllStores() {
  resetLocalStorage()
  void clearAllAttachments()
  useHabitsStore.getState().resetData()
  useTaskStore.getState().clearAllData()
  useEventStore.getState().setEvents([])
  usePointsStore.setState({ pointsHistory: [] })
  useRegretStore.setState({ regretHistory: [] })
  useMetricsStore.setState({ datapoints: [] })
  useGoalsStore.setState({ goals: [] })
  useReviewsStore.setState({ reviews: [] })
  useThemeStore.getState().resetColors()
  useUserSettingsStore.getState().resetHomeLocation()
  useTimeTrackingStore.setState({
    data: {},
    blockDetails: [],
    activeScopeId: "activity",
    selectedPenId: null,
  })
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, options)
}

/** Call in describe blocks that touch persisted Zustand stores. */
export function useCleanLocalStorage() {
  beforeEach(() => {
    resetLocalStorage()
  })
}

/** Call in describe blocks that touch Zustand stores. */
export function useCleanStores() {
  beforeEach(() => {
    resetAllStores()
  })
}
