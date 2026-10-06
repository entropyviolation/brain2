/**
 * screen-history — stack behavior for in-app Back / Forward
 */
import { describe, expect, it } from "vitest"
import {
  createScreenHistory,
  currentScreen,
  goBack,
  goForward,
  pushScreen,
  screenHistorySnapshot,
} from "@/lib/screen-history"
import type { ScreenLocation } from "@/lib/screen-location"
import { screenLocationKey } from "@/lib/screen-location"

function loc(partial: Partial<ScreenLocation> & Pick<ScreenLocation, "appTab">): ScreenLocation {
  return {
    itemId: null,
    homeTab: null,
    homeHabitsTab: null,
    homePlanTab: null,
    homeTodoTab: null,
    homeTrackingTab: null,
    homeGoalsPeriod: null,
    homeGoalsFilter: null,
    lists: { location: "home", openTarget: null },
    schedulerTab: null,
    schedulerView: null,
    docsDocId: null,
    docsFolder: null,
    opsId: null,
    opsPanel: null,
    modulesWorkspaceId: null,
    modulesView: null,
    analyticsTab: null,
    itemDetailTab: null,
    ...partial,
  }
}

describe("screen-history", () => {
  it("starts empty with both directions disabled", () => {
    const snap = screenHistorySnapshot(createScreenHistory(null))
    expect(snap.canBack).toBe(false)
    expect(snap.canForward).toBe(false)
    expect(snap.current).toBeNull()
  })

  it("seeds a single screen with both directions disabled", () => {
    const snap = screenHistorySnapshot(createScreenHistory(loc({ appTab: "home" })))
    expect(snap.canBack).toBe(false)
    expect(snap.canForward).toBe(false)
    expect(snap.current?.appTab).toBe("home")
  })

  it("pushes distinct screens and enables back", () => {
    let state = createScreenHistory(loc({ appTab: "home" }))
    state = pushScreen(state, loc({ appTab: "categories" }))
    const snap = screenHistorySnapshot(state)
    expect(snap.canBack).toBe(true)
    expect(snap.canForward).toBe(false)
    expect(currentScreen(state)?.appTab).toBe("categories")
  })

  it("ignores consecutive duplicate screens", () => {
    let state = createScreenHistory(loc({ appTab: "home" }))
    state = pushScreen(state, loc({ appTab: "home" }))
    state = pushScreen(state, loc({ appTab: "home", homeTab: null }))
    expect(state.entries).toHaveLength(1)
    expect(screenLocationKey(loc({ appTab: "home" }))).toBe(
      screenLocationKey(loc({ appTab: "home", homeTab: null })),
    )
  })

  it("goes back and forward without losing the stack", () => {
    let state = createScreenHistory(loc({ appTab: "home" }))
    state = pushScreen(state, loc({ appTab: "categories" }))
    state = pushScreen(state, loc({ appTab: "docs" }))
    state = goBack(state)
    expect(currentScreen(state)?.appTab).toBe("categories")
    expect(screenHistorySnapshot(state).canBack).toBe(true)
    expect(screenHistorySnapshot(state).canForward).toBe(true)
    state = goBack(state)
    expect(currentScreen(state)?.appTab).toBe("home")
    expect(screenHistorySnapshot(state).canBack).toBe(false)
    expect(screenHistorySnapshot(state).canForward).toBe(true)
    state = goForward(state)
    expect(currentScreen(state)?.appTab).toBe("categories")
  })

  it("truncates the forward stack when navigating after back", () => {
    let state = createScreenHistory(loc({ appTab: "home" }))
    state = pushScreen(state, loc({ appTab: "categories" }))
    state = pushScreen(state, loc({ appTab: "docs" }))
    state = goBack(state)
    state = pushScreen(state, loc({ appTab: "scheduler" }))
    expect(state.entries.map((e) => e.appTab)).toEqual(["home", "categories", "scheduler"])
    expect(screenHistorySnapshot(state).canForward).toBe(false)
    expect(currentScreen(state)?.appTab).toBe("scheduler")
  })

  it("no-ops back/forward at the edges", () => {
    let state = createScreenHistory(loc({ appTab: "home" }))
    expect(goBack(state)).toBe(state)
    expect(goForward(state)).toBe(state)
  })

  it("treats lists folder changes as distinct screens", () => {
    let state = createScreenHistory(
      loc({ appTab: "categories", lists: { location: "home", openTarget: null } }),
    )
    state = pushScreen(
      state,
      loc({
        appTab: "categories",
        lists: { location: "folder-1", openTarget: { type: "category", id: "list-1" } },
      }),
    )
    expect(state.entries).toHaveLength(2)
    state = goBack(state)
    expect(currentScreen(state)?.lists.location).toBe("home")
  })

  it("treats full-page item detail as a distinct screen", () => {
    let state = createScreenHistory(loc({ appTab: "categories" }))
    state = pushScreen(state, loc({ appTab: "categories", itemId: "task-1" }))
    expect(state.entries).toHaveLength(2)
    state = goBack(state)
    expect(currentScreen(state)?.itemId).toBeNull()
  })
})
