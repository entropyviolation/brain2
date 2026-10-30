/**
 * components/Home/Plan/phone/plan-phone.test.tsx — Phone Plan stays off the desktop tree.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { act, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { format } from "date-fns"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { PlanPanel } from "../plan-panel"
import { PlanPhone } from "./plan-phone"
import { PlannedTasksSidebar } from "../rail/planned-tasks-sidebar"
import { placeRailItem } from "./plan-phone-place"
import { PLAN_PHONE_QUERY } from "./use-plan-phone"

vi.mock("@/lib/weather-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/weather-client")>("@/lib/weather-client")
  return { ...actual, fetchDayClimate: vi.fn(async () => null) }
})

const originalMatchMedia = window.matchMedia

function media(matches: (query: string) => boolean) {
  window.matchMedia = ((query: string) => ({
    matches: matches(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia
}

const day = new Date("2026-10-27T12:00:00")

function phoneProps(setCurrentDate = vi.fn()) {
  return {
    currentDate: day,
    setCurrentDate,
    planTab: "month" as const,
    setPlanTab: vi.fn(),
    events: [],
    planDark: false,
    setPlanDark: vi.fn(),
    gemMode: false,
    setGemMode: vi.fn(),
    onOpenDay: vi.fn(),
    onOpenMonth: vi.fn(),
    onTaskClick: vi.fn(),
    onEventClick: vi.fn(),
    onCreateEvent: vi.fn(),
    onAddEvent: vi.fn(),
    onAddPlan: vi.fn(),
    onPlannedAction: vi.fn(),
    onPaste: vi.fn(),
    onSettings: vi.fn(),
  }
}

describe("Plan phone", () => {
  beforeEach(() => {
    resetAllStores()
    window.matchMedia = originalMatchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it("does not mount the phone tree when matchMedia is false (desktop / 1280)", () => {
    render(<PlanPanel currentDate={day} />)
    expect(screen.queryByTestId("plan-phone")).not.toBeInTheDocument()
    expect(document.querySelector(".plan-window")).toBeTruthy()
    expect(document.querySelector("[data-plan-phone]")).toBeNull()
    expect(document.documentElement.dataset.planPhone).toBeUndefined()
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Event" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Plan" })).not.toBeInTheDocument()
  })

  it("mounts the phone tree at phone width and keeps Add Event, Add Plan, and Paste", async () => {
    media((query) => query === PLAN_PHONE_QUERY)
    const user = userEvent.setup()
    render(<PlanPanel currentDate={day} />)
    expect(screen.getByTestId("plan-phone")).toBeInTheDocument()
    expect(document.querySelector(".plan-window")).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Month" })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: "Month" })).toHaveClass("plan-phone-key")
    expect(screen.getByRole("button", { name: "Add" })).toHaveClass("plan-phone-key")
    expect(screen.getByRole("button", { name: "Today" })).toHaveClass("plan-phone-key")
    expect(screen.getByRole("button", { name: "Open day" })).toHaveClass("plan-phone-key")
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Add" }))
    expect(screen.getByRole("button", { name: "Add Event" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add Plan" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Paste Events" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Free block at a time" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Done" }))
    await user.click(screen.getByRole("button", { name: "More" }))
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("id", "plan-dark-mode")
    expect(screen.getByRole("button", { name: "Gem and trinket" })).toHaveAttribute("id", "plan-gem-mode")
    expect(document.getElementById("plan-chrome-toggles")).toBeTruthy()
  })

  it("swipes to the next month and leaves a vertical drag alone", () => {
    const setCurrentDate = vi.fn()
    render(<PlanPhone {...phoneProps(setCurrentDate)} />)
    const body = screen.getByTestId("plan-phone-scroll")

    act(() => {
      body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 180, clientY: 40, button: 0 }))
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 180, clientY: 180, button: 0 }))
    })
    expect(setCurrentDate).not.toHaveBeenCalled()

    act(() => {
      body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 240, clientY: 40, button: 0 }))
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: 40, clientY: 48 }))
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: 40, clientY: 48 }))
    })
    expect(format(setCurrentDate.mock.calls[0][0] as Date, "yyyy-MM")).toBe("2026-11")
  })

  it("steps a week when Week is the open period", async () => {
    const user = userEvent.setup()
    const setCurrentDate = vi.fn()
    render(<PlanPhone {...phoneProps(setCurrentDate)} planTab="week" />)
    await user.click(screen.getByRole("button", { name: "Next week" }))
    expect(format(setCurrentDate.mock.calls.at(-1)?.[0] as Date, "yyyy-MM-dd")).toBe("2026-11-03")
  })

  it("places a to-do on the day at an hour and can place a date with no hour", () => {
    useTaskStore.getState().setTasks([
      {
        id: "phone-task",
        description: "Call the studio",
        stage: "scheduled",
        createdAt: day,
        completed: false,
        lists: [],
        urgency: 3,
        importance: 3,
        estimatedDuration: 45,
        cognitiveLoad: 2,
        dependencies: [],
        context: "",
        entropy: 0,
        rewardValue: 1,
        allowPartialCompletion: false,
        minimumChunkSize: 15,
      },
    ])
    const placed = placeRailItem({ kind: "task", id: "phone-task", date: day, hour: 15, mode: "day" })
    expect(placed?.startTime).toBe("15:00")
    expect(useTaskStore.getState().tasks[0]?.scheduledTime).toBe("15:00")

    useTaskStore.getState().setTasks([
      {
        ...useTaskStore.getState().tasks[0]!,
        scheduledTime: undefined,
        scheduledDate: undefined,
      },
    ])
    const dated = placeRailItem({ kind: "task", id: "phone-task", date: day, hour: null, mode: "month" })
    expect(dated).toBeNull()
    expect(useTaskStore.getState().tasks[0]?.scheduledDate).toBeTruthy()
    expect(useTaskStore.getState().tasks[0]?.scheduledTime).toBeUndefined()
    expect(usePlannedActionStore.getState().actions.some((row) => row.sourceId === "phone-task")).toBe(true)
  })

  it("omits the Plan key on the desktop rail", () => {
    render(<PlannedTasksSidebar mode="day" currentDate={day} onTaskClick={vi.fn()} />)
    expect(screen.queryByRole("button", { name: /^Plan / })).not.toBeInTheDocument()
  })

  it("keeps phone overrides for the shared window and dialogs inside the 767px block", () => {
    const dir = join(process.cwd(), "components/Home/Plan")
    const css = readFileSync(join(dir, "phone/plan-phone.css"), "utf8")
    const chrome = readFileSync(join(dir, "plan-chrome.css"), "utf8")
    const gate = css.indexOf("@media (max-width: 767px)")
    expect(gate).toBeGreaterThan(0)
    expect(css.indexOf(".plan95 > .plan-window")).toBeGreaterThan(gate)
    expect(css.indexOf("body .plan95-dialog")).toBeGreaterThan(gate)
    expect(chrome).not.toContain("max-width: 767px")
    expect(chrome).not.toContain(".plan-phone")
    expect(css).toContain("min-height: 44px")
    expect(css).toContain("linear-gradient(180deg, #f1f3f5, #dfe2e6)")
    expect(css).not.toContain("#0a84ff")
    expect(css).not.toContain("#64d2ff")
    expect(css).toContain("prefers-reduced-motion: reduce")
    expect(css).toContain("safe-area-inset-bottom")
    expect(390 <= 767 && 430 <= 767 && 1280 > 767).toBe(true)
  })
})
