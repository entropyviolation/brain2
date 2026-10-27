/**
 * Cycle phase view — empty until bleed or ovulation, then a mix and a joined reading.
 */
import { render, screen, within } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { addCalendarDays, formatLocalDateKey } from "@/lib/date-utils"
import { useCycleMarksStore } from "@/lib/cycle-marks"
import { useMetricsStore } from "@/lib/metrics-store"
import { useCleanStores } from "@/tests/test-utils"
import { useAnalyticsRangeStore } from "./analytics-range-store"
import { CyclePhaseView } from "./CyclePhaseView"

describe("cycle phase view", () => {
  useCleanStores()

  beforeEach(() => {
    const today = new Date()
    useAnalyticsRangeStore.getState().setCustomRange(formatLocalDateKey(addCalendarDays(today, -1)), formatLocalDateKey(today))
  })

  it("explains that phases appear after bleed days are marked", () => {
    render(<CyclePhaseView />)
    expect(screen.getByTestId("cycle-phase-view")).toBeInTheDocument()
    expect(screen.getByText(/Phases appear after bleed days are marked in the Tracking log/)).toBeInTheDocument()
    expect(screen.getByText(/This describes your own logs/)).toBeInTheDocument()
    expect(screen.queryByTestId("cycle-phase-mix")).not.toBeInTheDocument()
    expect(screen.queryByTestId("cycle-phase-basis")).not.toBeInTheDocument()
  })

  it("does not open a phase from spotting alone", () => {
    const today = formatLocalDateKey(new Date())
    useCycleMarksStore.setState({
      marks: { [today]: { date: today, spotting: true } },
    })
    render(<CyclePhaseView />)
    expect(screen.getByText(/Spotting is stored and does not set a phase/)).toBeInTheDocument()
    expect(screen.queryByTestId("cycle-phase-mix")).not.toBeInTheDocument()
    expect(screen.queryByTestId("cycle-phase-basis")).not.toBeInTheDocument()
  })

  it("counts the bleed day, keeps unknown, and joins a joy reading without a finding", () => {
    const todayKey = formatLocalDateKey(new Date())
    useCycleMarksStore.setState({
      marks: { [todayKey]: { date: todayKey, bleeding: true } },
    })
    useMetricsStore.setState({
      datapoints: [
        {
          id: "dp-joy",
          at: `${todayKey}T09:00`,
          values: { joy: 80 },
          createdAt: new Date(),
        },
      ],
    })
    render(<CyclePhaseView />)
    expect(screen.getByTestId("cycle-phase-mix")).toBeInTheDocument()
    expect(screen.getAllByText("Menstrual").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Unknown").length).toBeGreaterThan(0)
    const mix = within(screen.getByTestId("cycle-phase-mix-table"))
    const menstrual = mix.getByRole("row", { name: /Menstrual/ })
    expect(within(menstrual).getAllByRole("cell")[1]).toHaveTextContent("1")
    expect(within(menstrual).getAllByRole("cell")[2]).toHaveTextContent("0")
    expect(screen.queryByTestId("cycle-phase-estimated-bars")).not.toBeInTheDocument()
    expect(screen.getByTestId("cycle-phase-basis")).toHaveTextContent(/not a diagnosis/i)
    const joy = screen.getByTestId("cycle-phase-joy")
    expect(within(joy).getByRole("table", { name: "Joy on marked days" })).toHaveTextContent("80")
    expect(within(joy).queryByRole("table", { name: "Joy on estimated days" })).not.toBeInTheDocument()
    expect(joy).toHaveTextContent(/fewer than 5/)
    expect(joy).not.toHaveTextContent(/drops/)
  })

  it("labels an estimated luteal day apart from the marked bleed", () => {
    useAnalyticsRangeStore.getState().setCustomRange("2026-01-01", "2026-01-20")
    useCycleMarksStore.setState({
      marks: {
        "2026-01-01": { date: "2026-01-01", bleeding: true },
        "2026-01-29": { date: "2026-01-29", bleeding: true },
        "2026-02-26": { date: "2026-02-26", bleeding: true },
        "2026-03-26": { date: "2026-03-26", bleeding: true },
      },
    })
    useMetricsStore.setState({
      datapoints: [
        { id: "dp-bleed", at: "2026-01-01T09:00", values: { joy: 80 }, createdAt: new Date() },
        { id: "dp-guess", at: "2026-01-20T09:00", values: { joy: 20 }, createdAt: new Date() },
      ],
    })
    render(<CyclePhaseView />)

    const mix = within(screen.getByTestId("cycle-phase-mix-table"))
    const menstrual = mix.getByRole("row", { name: /Menstrual/ })
    expect(within(menstrual).getAllByRole("cell")[1]).toHaveTextContent("1")
    expect(within(menstrual).getAllByRole("cell")[2]).toHaveTextContent("0")
    const follicular = mix.getByRole("row", { name: /Follicular/ })
    expect(within(follicular).getAllByRole("cell")[1]).toHaveTextContent("0")
    expect(within(follicular).getAllByRole("cell")[2]).toHaveTextContent("13")
    const luteal = mix.getByRole("row", { name: /Luteal/ })
    expect(within(luteal).getAllByRole("cell")[1]).toHaveTextContent("0")
    expect(within(luteal).getAllByRole("cell")[2]).toHaveTextContent("5")
    expect(screen.getByTestId("cycle-phase-estimated-bars")).toHaveTextContent("Luteal")
    expect(screen.getByTestId("cycle-phase-basis")).toHaveTextContent(/not a diagnosis/i)
    expect(screen.getByTestId("cycle-phase-basis")).toHaveTextContent(/14-day prior/)
    expect(screen.getByTestId("cycle-phase-mix")).toHaveTextContent(/not a logged phase/)

    const joy = screen.getByTestId("cycle-phase-joy")
    const marked = within(joy).getByRole("table", { name: "Joy on marked days" })
    const markedLuteal = within(marked).getByRole("row", { name: /Luteal/ })
    expect(within(marked).getByRole("row", { name: /Menstrual/ })).toHaveTextContent("80")
    expect(markedLuteal).not.toHaveTextContent("20")
    expect(markedLuteal).not.toHaveTextContent("80")

    const estimated = within(joy).getByRole("table", { name: "Joy on estimated days" })
    const estimatedLuteal = within(estimated).getByRole("row", { name: /Luteal/ })
    expect(estimatedLuteal).toHaveTextContent("5")
    expect(estimatedLuteal).toHaveTextContent("20")
    expect(estimated).not.toHaveTextContent("80")
    expect(joy).toHaveTextContent(/not a logged phase/)
    expect(joy).toHaveTextContent(/not a finding/)
    expect(joy).not.toHaveTextContent(/drops/)
  })
})
