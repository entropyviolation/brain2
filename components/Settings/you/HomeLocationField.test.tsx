import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_HOME_CITY, useUserSettingsStore } from "@/lib/user-settings-store"
import { HomeLocationField } from "./HomeLocationField"

vi.mock("@/lib/city-search", () => ({
  searchCities: vi.fn(async () => []),
  resolveCityLabel: vi.fn(async (q: string) => q),
}))

describe("HomeLocationField", () => {
  beforeEach(() => {
    localStorage.clear()
    useUserSettingsStore.getState().resetHomeLocation()
  })

  it("shows San Diego as the default home city", () => {
    render(<HomeLocationField />)
    expect(screen.getByLabelText("City")).toHaveValue(DEFAULT_HOME_CITY)
    expect(screen.getByText(/Defaults to San Diego/i)).toBeInTheDocument()
  })
})
