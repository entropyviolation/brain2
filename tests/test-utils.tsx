/**
 * Shared test helpers for component tests.
 */
import { render, type RenderOptions } from "@testing-library/react"
import type { ReactElement } from "react"
import { beforeEach } from "vitest"
import { useEventStore } from "@/lib/event-store"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useTaskStore } from "@/lib/task-store"
import { DEFAULT_CHROME_FACE, DEFAULT_THEME, useThemeStore } from "@/lib/theme-store"
import { DEFAULT_PCB_MODE } from "@/lib/pcb-backdrop"
import { defaultScopes, defaultTags, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useSunTimesStore } from "@/lib/sun-times-store"
import { useUserSettingsStore } from "@/lib/user-settings-store"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useMetricsStore } from "@/lib/metrics-store"
import { useRegretStore } from "@/lib/regret-store"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { useHomeWeatherStore } from "@/lib/home-weather-store"
import { useUiNamesStore } from "@/lib/ui-names-store"
import { resetPersistStatus } from "@/lib/persist-storage"
import { resetDayNotesPersist } from "@/lib/day-notes-persist"
import { resetActionHistory } from "@/lib/action-history"
import { clearAllAttachments } from "@/lib/attachments"
import {
  DEFAULT_ACCOMPLISHMENT_BONUS,
  DEFAULT_ACCOMPLISHMENT_THRESHOLD,
} from "@/lib/habit-accomplishment"
import { DEFAULT_DAY_GRADE_LIFT_BONUS, DEFAULT_WEEKLY_GRADE_LIFT_BONUS } from "@/lib/habit-points"
import { DEFAULT_GRADE_TOLERANCE } from "@/lib/calculations"
import { DEFAULT_PERCENT_LED_TINT } from "@/lib/habit-led"
import { DEFAULT_GRADE_TUBE_COLOR, DEFAULT_OUTPUT_TUBE_COLOR } from "@/lib/habit-tube"
import { DEFAULT_WILLPOWER_PHYSICS } from "@/lib/willpower-physics"

export function resetLocalStorage() {
  localStorage.clear()
  resetPersistStatus()
}

export function resetAllStores() {
  resetLocalStorage()
  resetDayNotesPersist()
  resetActionHistory()
  void clearAllAttachments()
  useHabitsStore.getState().resetData()
  useHabitsStore.setState({
    gradeTolerance: DEFAULT_GRADE_TOLERANCE,
    outputGradeTolerance: DEFAULT_GRADE_TOLERANCE,
    accomplishmentThreshold: DEFAULT_ACCOMPLISHMENT_THRESHOLD,
    accomplishmentBonus: DEFAULT_ACCOMPLISHMENT_BONUS,
    dayGradeLiftBonus: DEFAULT_DAY_GRADE_LIFT_BONUS,
    weeklyGradeLiftBonus: DEFAULT_WEEKLY_GRADE_LIFT_BONUS,
    willpowerImage: null,
    habitGems: {},
    percentLedTint: DEFAULT_PERCENT_LED_TINT,
    gradeTubeColor: DEFAULT_GRADE_TUBE_COLOR,
    outputGradeTubeColor: DEFAULT_OUTPUT_TUBE_COLOR,
    appearanceRev: 0,
    contentRev: 0,
    habitDayView: false,
    percentLoadingBar: true,
    habitSmallLeds: true,
    hideCompletedToday: false,
    exemptionWand: false,
    habitExemptions: { daily: {}, weekly: {}, monthly: {} },
    habitViewMode: "grid",
    habitSortMode: "default",
    sortHabitsByPriorityFlag: false,
    willpowerPhysicsHud: false,
    willpowerPhysics: DEFAULT_WILLPOWER_PHYSICS,
  })
  useTaskStore.getState().clearAllData()
  useEventStore.getState().setEvents([])
  usePlannedActionStore.getState().setActions([])
  usePointsStore.setState({ pointsHistory: [] })
  useRegretStore.setState({ regretHistory: [] })
  useMetricsStore.setState({ datapoints: [] })
  useGoalsStore.setState({ goals: [] })
  useReviewsStore.setState({ reviews: [] })
  useThemeStore.setState({
    colors: DEFAULT_THEME,
    chromeFace: DEFAULT_CHROME_FACE,
    pcbMode: DEFAULT_PCB_MODE,
    appearanceRev: 0,
  })
  useUserSettingsStore.getState().resetHomeLocation()
  useTimeTrackingStore.setState({
    entries: [],
    dayNotes: {},
    untrackedNotes: {},
    hiddenPenIds: {},
    infiniteScroll: false,
    confirmedEventIds: [],
    gridSpan: "day",
    // Pens, variants, tags and links are state too: a test that adds "Ian's
    // House" must not leave it behind for the next one.
    scopes: defaultScopes(),
    tags: defaultTags(),
    activeScopeId: "activity",
    selectedPenId: null,
    selectedVariantIds: [],
    penSort: "recent",
  })
  useSleepStore.setState({ nights: {} })
  useSunTimesStore.getState().resetSunTimes()
  useWorkSessionStore.setState({ session: null })
  usePenColorSessionStore.setState({ session: null })
  useIngestStore.setState({
    enabled: true,
    allowGroups: false,
    pairing: null,
    allowedChats: [],
    revokedChatIds: [],
    allowlistRev: 0,
    pendingByChat: {},
    events: [],
    lastPollAt: null,
    lastPollError: null,
    lastPollSource: null,
    shortcuts: {},
    phoneHubUrl: "",
    livePins: {},
  })
  useBabyAnimalsStore.getState().resetGallery()
  useHomeWidgetsStore.getState().resetWidgets()
  useHomeWeatherStore.getState().resetPlace()
  useUiNamesStore.setState({ mode: "off" })
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
