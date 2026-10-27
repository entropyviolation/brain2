/**
 * components/Tracking/MetricLogger.test.tsx — Now Metrics key writes a wellbeing reading
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useMetricsStore } from "@/lib/metrics-store"
import { MetricLoggerButton } from "./MetricLogger"

describe("MetricLogger", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("writes today's chosen wellbeing reading into the metrics store", async () => {
    const user = userEvent.setup()
    render(<MetricLoggerButton />)

    await user.click(screen.getByRole("button", { name: "Metrics" }))
    expect(await screen.findByRole("heading", { name: "Wellbeing metrics" })).toBeInTheDocument()

    const joy = document.getElementById("metric-joy")
    expect(joy).toBeInstanceOf(HTMLInputElement)
    await user.type(joy as HTMLInputElement, "72")
    await user.click(screen.getByRole("button", { name: "Log datapoint" }))

    const today = formatLocalDateKey(new Date())
    const saved = useMetricsStore.getState().datapoints
    expect(saved).toHaveLength(1)
    expect(saved[0].at.startsWith(today)).toBe(true)
    expect(saved[0].values.joy).toBe(72)
  })
})
