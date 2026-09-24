import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHomeWidgetsStore } from "@/lib/home-widgets-store"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { HomeOverview } from "./home-overview"
import { HomeWidgetsMenu } from "./home-widgets-menu"
import { fetchHomeDayWeather, fetchHomeAirQuality } from "@/lib/weather-client"
import { fetchHomeTide } from "@/lib/tide-client"
import { searchCities } from "@/lib/city-search"
import { useHomeWeatherStore } from "@/lib/home-weather-store"
import { writeAliasedLocal } from "@/lib/storage-keys"
import "./home-chrome.css"
import "@/components/Home/Habits/habit-chrome.css"

const HOME_WX = {
  weather: "unused",
  cityName: "San Diego",
  date: "2026-09-21",
  lat: 32.715,
  lng: -117.161,
  condition: "Clear",
  weatherCode: 0,
  tempF: 72,
  highF: 76,
  lowF: 61,
  precipChance: 10,
  windMph: 8,
  humidity: 64,
  uvIndex: 6,
  visibilityMi: 10,
  sunrise: "6:40 AM",
  sunset: "6:55 PM",
  sunriseHhmm: "06:40",
  sunsetHhmm: "18:55",
  hourly: [
    { time: "2026-09-21T06:00", hour: 6, tempF: 61, weatherCode: 0 },
    { time: "2026-09-21T09:00", hour: 9, tempF: 66, weatherCode: 1 },
    { time: "2026-09-21T12:00", hour: 12, tempF: 72, weatherCode: 2 },
    { time: "2026-09-21T15:00", hour: 15, tempF: 76, weatherCode: 0 },
    { time: "2026-09-21T18:00", hour: 18, tempF: 70, weatherCode: 3 },
    { time: "2026-09-21T21:00", hour: 21, tempF: 64, weatherCode: 61 },
  ],
  week: [
    { date: "2026-09-21", weatherCode: 0, condition: "Clear", highF: 76, lowF: 61, precipChance: 10 },
    { date: "2026-09-22", weatherCode: 61, condition: "Rain", highF: 70, lowF: 60, precipChance: 80 },
    { date: "2026-09-23", weatherCode: 2, condition: "Partly cloudy", highF: 72, lowF: 62, precipChance: 20 },
    { date: "2026-09-24", weatherCode: 3, condition: "Overcast", highF: 71, lowF: 63, precipChance: 15 },
    { date: "2026-09-25", weatherCode: 0, condition: "Clear", highF: 74, lowF: 61, precipChance: 5 },
    { date: "2026-09-26", weatherCode: 1, condition: "Mainly clear", highF: 75, lowF: 62, precipChance: 5 },
    { date: "2026-09-27", weatherCode: 2, condition: "Partly cloudy", highF: 73, lowF: 61, precipChance: 10 },
  ],
}

const HOME_TIDE = {
  stationId: "9410230",
  stationName: "La Jolla (Scripps)",
  place: "Ocean Beach",
  heightFt: 3.2,
  nextHigh: { kind: "H" as const, heightFt: 5.1, timeLabel: "7:14 PM", timeCompact: "7:14p", stamp: "2026-09-21 19:14" },
  nextLow: { kind: "L" as const, heightFt: 0.8, timeLabel: "1:02 AM", timeCompact: "1:02a", stamp: "2026-09-22 01:02" },
  extremes: [],
  hourlyFt: [1.2, 2.4, 3.2, 4.1, 5.1, 3.8],
}

vi.mock("@/lib/weather-client", () => ({
  fetchHomeDayWeather: vi.fn(async () => HOME_WX),
  fetchHomeAirQuality: vi.fn(async () => ({ usAqi: 41, pm25: 8, label: "Good" })),
}))

vi.mock("@/lib/tide-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tide-client")>()
  return {
    ...actual,
    fetchHomeTide: vi.fn(async () => HOME_TIDE),
  }
})

vi.mock("@/lib/city-search", () => ({
  searchCities: vi.fn(async () => []),
}))

const fetchHomeDayWeatherMock = vi.mocked(fetchHomeDayWeather)
const fetchHomeTideMock = vi.mocked(fetchHomeTide)
const fetchHomeAirQualityMock = vi.mocked(fetchHomeAirQuality)
const searchCitiesMock = vi.mocked(searchCities)

function looksOrangeAmber(color: string) {
  if (!color) return false
  const lower = color.toLowerCase()
  if (/(orange|amber|#f59|#fb9|#f90|#ffa|#ff8|#eab|#d977|#ea58|#f973|#c241)/.test(lower)) return true
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!m) return false
  const r = Number(m[1])
  const g = Number(m[2])
  const b = Number(m[3])
  if (r < 160 || b > 140) return false
  return r > g + 10 && g > b + 20
}

describe("HomeOverview", () => {
  const currentDate = new Date("2026-09-21T12:00:00")

  beforeEach(() => {
    resetAllStores()
    usePointsStore.getState().addPoints("task-1", 42, "Test task", currentDate)
    fetchHomeDayWeatherMock.mockReset()
    fetchHomeDayWeatherMock.mockResolvedValue(HOME_WX)
    fetchHomeTideMock.mockReset()
    fetchHomeTideMock.mockResolvedValue(HOME_TIDE)
    fetchHomeAirQualityMock.mockReset()
    fetchHomeAirQualityMock.mockResolvedValue({ usAqi: 41, pm25: 8, label: "Good" })
    searchCitiesMock.mockReset()
    searchCitiesMock.mockResolvedValue([])
  })

  it("renders the shared square strip with centered CRT values", async () => {
    const { container } = render(
      <div className="home95">
        <HomeOverview currentDate={currentDate} />
      </div>,
    )
    expect(screen.getByTestId("home-overview")).toBeInTheDocument()
    expect(await screen.findAllByText("42")).toHaveLength(4)
    expect(screen.getByTestId("home-award-tile")).toHaveTextContent("+42")
    expect(screen.getByTestId("home-award-tile")).toHaveTextContent("Completed Test task")
    const readouts = container.querySelectorAll(".hab-score-readout")
    expect(readouts.length).toBeGreaterThan(0)
    for (const node of readouts) {
      expect(node).toHaveAttribute("data-centered", "true")
      const style = getComputedStyle(node)
      expect(style.textAlign).toBe("center")
      expect(style.justifyContent === "center" || style.display === "flex").toBeTruthy()
      expect(style.color === "var(--hab-crt-green)" || style.color === "rgb(125, 255, 196)").toBe(true)
      expect(style.textShadow === "var(--hab-crt-glow)" || /0px 0px 3px/.test(style.textShadow)).toBe(true)
    }
    const overview = screen.getByTestId("home-overview")
    expect(getComputedStyle(overview.closest(".home95")!).getPropertyValue("--hab-crt-green").trim()).toBe(
      "#7dffc4",
    )
    expect(container.querySelector(".hab-progress-title")).toBeNull()
    expect(screen.getByText("Today's Progress")).toBeInTheDocument()
    expect(screen.getByText(/To do \d+\/\d+ · habits \d+\/\d+/)).toBeInTheDocument()
    expect(container.querySelector(".home-tile.is-progress .home-crt")).toBeTruthy()
    const points = container.querySelector(".home-tile.is-points")
    expect(points).toBeTruthy()
    expect(points!.querySelectorAll(".home-points-line")).toHaveLength(4)
    expect(container.querySelector(".hab-score-well.is-alltime")).toBeNull()
    expect(container.querySelector(".hab-score-well.is-today")).toBeNull()
    const glass = points!.querySelector(".home-points-crt") as HTMLElement
    expect(glass).toBeTruthy()
    expect(getComputedStyle(glass).color === "var(--hab-crt-green)" || getComputedStyle(glass).color === "rgb(125, 255, 196)").toBe(
      true,
    )
  })

  it("keeps the same well face inside the Habits console", async () => {
    const { container } = render(
      <div className="hab95">
        <div className="home95">
          <HomeOverview currentDate={currentDate} />
        </div>
      </div>,
    )
    expect(await screen.findAllByText("42")).toHaveLength(4)
    const points = container.querySelector(".home-tile.is-points")
    expect(points).toBeTruthy()
    expect(points!.querySelectorAll(".home-points-line")).toHaveLength(4)
    expect(container.querySelectorAll(".hab-score-well.is-alltime, .hab-score-well.is-today")).toHaveLength(0)
  })

  it("paints well gradients from the three Habits color keys", () => {
    useHabitsStore.setState({
      percentLedTint: "#112233",
      gradeTubeColor: "#445566",
      outputGradeTubeColor: "#778899",
    })
    render(<HomeOverview currentDate={currentDate} />)
    expect(screen.getByTestId("home-overview")).toHaveAttribute(
      "data-home-grad",
      "#112233|#445566|#778899",
    )
  })

  it("hides a stats well and persists the choice across remount", async () => {
    const user = userEvent.setup()
    const { unmount } = render(<HomeOverview currentDate={currentDate} />)
    expect(screen.getByTestId("home-points-tile")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Hide Points" }))
    expect(screen.getByRole("heading", { name: "Are you sure?" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.getByTestId("home-points-tile")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Hide Points" }))
    await user.click(screen.getByRole("button", { name: "Hide" }))
    expect(screen.queryByTestId("home-points-tile")).not.toBeInTheDocument()
    const snap = localStorage.getItem("cogs-home-widgets")
    expect(snap).toContain("points")

    unmount()
    useHomeWidgetsStore.getState().resetWidgets()
    expect(useHomeWidgetsStore.getState().hidden).not.toContain("points")
    writeAliasedLocal("brain2-home-widgets", snap!)
    await useHomeWidgetsStore.persist.rehydrate()

    render(<HomeOverview currentDate={currentDate} />)
    expect(screen.queryByTestId("home-points-tile")).not.toBeInTheDocument()
    expect(screen.getByText("Today's Progress")).toBeInTheDocument()
  })

  it("adds a tucked widget back from the Widgets key", async () => {
    const user = userEvent.setup()
    render(
      <div className="home95">
        <div className="home-title-bar">
          <HomeWidgetsMenu />
        </div>
        <HomeOverview currentDate={currentDate} />
      </div>,
    )
    expect(screen.queryByText("Weather")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Widgets" }))
    await user.click(screen.getByRole("button", { name: "Add Weather" }))
    expect(screen.getByTestId("home-weather-tile")).toBeInTheDocument()
    await waitFor(() => {
      expect(document.querySelector(".home-weather-readout")).toHaveTextContent("72°")
    })
    expect(useHomeWidgetsStore.getState().hidden).not.toContain("weather")
  })

  it("keeps the weather square the same size as a points well and shows a later-today glance", async () => {
    useHomeWidgetsStore.getState().showWidget("weather")
    const { container } = render(
      <div className="home95">
        <HomeOverview currentDate={currentDate} />
      </div>,
    )
    await waitFor(() => {
      expect(document.querySelector(".home-weather-readout")).toHaveTextContent("72°")
    })
    const weather = container.querySelector(".home-tile.is-weather") as HTMLElement
    const points = container.querySelector(".home-tile.is-points") as HTMLElement
    expect(weather && points).toBeTruthy()
    expect(getComputedStyle(weather).height).toBe(getComputedStyle(points).height)
    expect(getComputedStyle(weather).maxWidth).toBe(getComputedStyle(points).maxWidth)
    expect(container.querySelector('[data-weather-icon="sun"]')).toBeInTheDocument()
    expect(screen.getByText("San Diego")).toBeInTheDocument()
    expect(container.querySelector(".home-tile.is-weather .hab-score-caption")).toHaveTextContent("San Diego")
    expect(weather.querySelector(".home-tile-foot")?.textContent).toMatch(/Clear/)
    expect(screen.queryByTestId("home-weather-strip")).not.toBeInTheDocument()
    expect(weather.querySelector(".hab-score-readout")).toHaveTextContent("72°")
  })

  it("opens the instrument dialog with the hourly strip and tides", async () => {
    const user = userEvent.setup()
    useHomeWidgetsStore.getState().showWidget("weather")
    render(
      <div className="home95">
        <HomeOverview currentDate={currentDate} />
      </div>,
    )
    await waitFor(() => {
      expect(document.querySelector(".home-weather-readout")).toHaveTextContent("72°")
    })
    await user.click(screen.getByRole("button", { name: "Open weather detail" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("Weather · San Diego")
    const dialogBody = dialog.querySelector(".home-weather-dialog-body") as HTMLElement
    expect(parseFloat(getComputedStyle(dialogBody).paddingLeft)).toBeGreaterThanOrEqual(14)
    expect(parseFloat(getComputedStyle(dialogBody).paddingTop)).toBeGreaterThanOrEqual(12)
    const search = screen.getByRole("searchbox", { name: "Search other cities" })
    for (const node of [dialog, dialogBody, search, screen.getByTestId("home-weather-rain"), ...dialog.querySelectorAll("button")]) {
      const style = getComputedStyle(node)
      for (const prop of [style.color, style.backgroundColor, style.outlineColor, style.caretColor, style.accentColor, style.borderLeftColor]) {
        expect(looksOrangeAmber(prop)).toBe(false)
      }
    }
    const strip = screen.getByTestId("home-weather-strip")
    expect(strip.querySelectorAll(".home-weather-chip")).toHaveLength(6)
    expect(strip).toHaveTextContent("6a")
    expect(strip).toHaveTextContent("76°")
    expect(strip).toHaveTextContent("9p")
    expect(strip.querySelector('[data-hour="21"] [data-weather-icon="rain"]')).toBeInTheDocument()
    expect(dialog).toHaveTextContent("H 76°")
    expect(screen.getByTestId("home-weather-rain")).toHaveTextContent("Dry — only 10% chance of rain")
    expect(dialog).toHaveTextContent("8 mph")
    expect(dialog).toHaveTextContent("64% humidity")
    expect(screen.getByTestId("home-weather-spark").querySelector("path")).toBeTruthy()
    const tide = screen.getByTestId("home-weather-tide")
    expect(tide).toHaveTextContent("La Jolla (Scripps)")
    expect(tide).toHaveTextContent("3.2 ft")
    expect(tide).toHaveTextContent("5.1 ft 7:14 PM")
    expect(tide).toHaveTextContent("0.8 ft 1:02 AM")

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Ocean Beach" })).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: "Ocean Beach" }))
    expect(useHomeWeatherStore.getState().beachLabel).toBe("Ocean Beach")
    expect(useHomeWeatherStore.getState().stationId).toBe("9410230")

    await user.click(screen.getByRole("tab", { name: "Week" }))
    const week = screen.getByTestId("home-weather-week")
    expect(week.querySelectorAll(".home-weather-week-day")).toHaveLength(7)
    expect(week).toHaveTextContent("80%")
    expect(week).toHaveTextContent("70°/60°")

    searchCitiesMock.mockResolvedValue([
      { label: "Portland, Oregon", name: "Portland", lat: 45.52, lng: -122.68 },
    ])
    await user.type(screen.getByRole("searchbox", { name: "Search other cities" }), "Portland")
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Portland, Oregon" })).toBeInTheDocument()
    })
    await user.click(screen.getByRole("button", { name: "Portland, Oregon" }))
    expect(useHomeWeatherStore.getState().cityQuery).toBe("Portland, Oregon")
    expect(useHomeWeatherStore.getState().lat).toBe(45.52)
    expect(useHomeWeatherStore.getState().beachLabel).toBeNull()
  })

  it("keeps the weather tile intact when the forecast is empty", async () => {
    fetchHomeDayWeatherMock.mockResolvedValueOnce(null)
    fetchHomeTideMock.mockResolvedValueOnce(null)
    useHomeWidgetsStore.getState().showWidget("weather")
    const { container } = render(
      <div className="home95">
        <HomeOverview currentDate={currentDate} />
      </div>,
    )
    await waitFor(() => {
      expect(screen.getByText("No reading.")).toBeInTheDocument()
    })
    const weather = container.querySelector(".home-tile.is-weather") as HTMLElement
    const points = container.querySelector(".home-tile.is-points") as HTMLElement
    expect(getComputedStyle(weather).height).toBe(getComputedStyle(points).height)
    expect(screen.queryByTestId("home-weather-strip")).not.toBeInTheDocument()
  })

  it("opens Widgets as an overlay on the date bar, not a tile", async () => {
    const user = userEvent.setup()
    const { container } = render(
      <div className="home95">
        <div className="home-title-bar">
          <HomeWidgetsMenu />
        </div>
        <HomeOverview currentDate={currentDate} />
      </div>,
    )
    const overview = screen.getByTestId("home-overview")
    expect(container.querySelector(".home-tile.is-add")).toBeNull()
    expect(getComputedStyle(overview).flexWrap).toBe("wrap")
    const pet = container.querySelector(".home-tile.is-pet") as HTMLElement
    const points = container.querySelector(".home-tile.is-points") as HTMLElement
    expect(pet && points).toBeTruthy()
    expect(getComputedStyle(pet).height).toBe(getComputedStyle(points).height)
    expect(getComputedStyle(overview).getPropertyValue("--home-tile-h").trim()).toBe("156px")

    await user.click(screen.getByRole("button", { name: "Widgets" }))
    const menu = screen.getByRole("group", { name: "Home widgets" })
    expect(getComputedStyle(menu).position).toBe("absolute")
    expect(overview.contains(menu)).toBe(false)
    expect(container.querySelector(".home-tile.is-add")).toBeNull()
  })

  it("wraps equal-height squares instead of scrolling the overview tray", async () => {
    useHomeWidgetsStore.getState().showWidget("weather")
    useHomeWidgetsStore.getState().showWidget("affirmation")
    const { container } = render(
      <div className="home95">
        <div className="home-window">
          <div className="home-window-body">
            <HomeOverview currentDate={currentDate} />
          </div>
        </div>
      </div>,
    )
    await waitFor(() => {
      expect(document.querySelector(".home-weather-readout")).toHaveTextContent("72°")
    })
    const overview = screen.getByTestId("home-overview")
    const body = container.querySelector(".home-window-body") as HTMLElement
    expect(getComputedStyle(overview).flexWrap).toBe("wrap")
    expect(["hidden", "visible", "clip", ""]).toContain(getComputedStyle(overview).overflowX)
    expect(getComputedStyle(overview).overflowX).not.toBe("auto")
    expect(getComputedStyle(overview).overflowX).not.toBe("scroll")
    expect(getComputedStyle(body).overflowX).toBe("hidden")
    const tiles = [...container.querySelectorAll(".home-overview > .home-tile, .home-overview > .hab-score-well")] as HTMLElement[]
    expect(tiles.length).toBeGreaterThan(4)
    const h = getComputedStyle(tiles[0]).height
    for (const tile of tiles) {
      expect(getComputedStyle(tile).height).toBe(h)
    }
  })

  it("keeps Start review and Dismiss on the review square", async () => {
    const user = userEvent.setup()
    const onStartReview = vi.fn()
    render(<HomeOverview currentDate={currentDate} onStartReview={onStartReview} />)
    expect(screen.getByText("Review due")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Start review" }))
    expect(onStartReview).toHaveBeenCalledOnce()
    await user.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(screen.queryByText("Review due")).not.toBeInTheDocument()
  })

  it("opens a points breakdown and a progress detail", async () => {
    const user = userEvent.setup()
    render(<HomeOverview currentDate={currentDate} />)
    await screen.findAllByText("42")
    await user.click(screen.getByRole("button", { name: "Open Points" }))
    const pointsDialog = await screen.findByRole("dialog")
    expect(pointsDialog).toHaveTextContent("All Time Points")
    expect(pointsDialog).toHaveTextContent("Today's Points")
    expect(pointsDialog).toHaveTextContent("42")
    await user.keyboard("{Escape}")
    await user.click(screen.getByRole("button", { name: "Open Today's Progress" }))
    expect(await screen.findByRole("dialog")).toHaveTextContent("To do:")
  })

  it("saves a Days Until date and label", async () => {
    const user = userEvent.setup()
    render(<HomeOverview currentDate={currentDate} />)
    expect(screen.getByTestId("home-daysuntil-tile")).toHaveTextContent("Set a date")
    await user.click(screen.getByRole("button", { name: "Open Days Until" }))
    await user.type(screen.getByLabelText("Label"), "Birth Day")
    await user.type(screen.getByLabelText("Date"), "2026-10-01")
    expect(screen.getByTestId("home-daysuntil-tile")).toHaveTextContent("Days Until Birth Day")
    expect(screen.getByTestId("home-daysuntil-tile")).toHaveTextContent("10")
  })

  it("shows Solar remainder and Tracking now when added", async () => {
    const user = userEvent.setup()
    useHomeWidgetsStore.getState().showWidget("solar")
    useHomeWidgetsStore.getState().showWidget("tracking")
    render(
      <div className="home95">
        <HomeOverview currentDate={currentDate} />
      </div>,
    )
    expect(screen.getByTestId("home-solar-tile")).toHaveTextContent("Solar remainder")
    expect(screen.getByTestId("home-tracking-tile")).toHaveTextContent("Activity")
    expect(screen.getByTestId("home-tracking-tile")).toHaveTextContent("Location")
    await user.click(screen.getByRole("button", { name: "Update" }))
    expect(await screen.findByText("What is true right now?")).toBeInTheDocument()
  })
})
