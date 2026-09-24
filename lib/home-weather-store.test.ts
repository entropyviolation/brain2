import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { HOME_WEATHER_STORAGE_KEY } from "./home-weather"
import { useHomeWeatherStore } from "./home-weather-store"

describe("home weather store", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("persists city and beach without touching Settings", async () => {
    useHomeWeatherStore.getState().setPlace({
      cityQuery: "Portland, Oregon",
      cityName: "Portland",
      lat: 45.52,
      lng: -122.68,
      stationId: "9432780",
      beachLabel: "South Beach",
    })
    const raw = localStorage.getItem(HOME_WEATHER_STORAGE_KEY)
    expect(raw).toContain("Portland")
    expect(raw).toContain("9432780")

    useHomeWeatherStore.getState().resetPlace()
    expect(useHomeWeatherStore.getState().cityQuery).toBe("")
    localStorage.setItem(HOME_WEATHER_STORAGE_KEY, raw!)
    await useHomeWeatherStore.persist.rehydrate()
    expect(useHomeWeatherStore.getState().cityName).toBe("Portland")
    expect(useHomeWeatherStore.getState().beachLabel).toBe("South Beach")
  })
})
