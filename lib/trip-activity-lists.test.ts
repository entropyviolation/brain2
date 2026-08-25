import { describe, it, expect } from "vitest"
import {
  cityChipKey,
  colorForList,
  colorForPlaceKind,
  dedupeCityLabels,
  encodePlaceLists,
  FIXED_PIN_COLORS,
  getPlaceLists,
  isAlwaysVisiblePlaceKind,
  isSignificantPlaceKind,
  placeInList,
  placeVisibleForLists,
  togglePlaceList,
  withListColor,
} from "./trip-activity-lists"

describe("dedupeCityLabels", () => {
  it("collapses Lima / Lima, Peru", () => {
    expect(dedupeCityLabels(["Lima, Peru", "Lima", "lima"])).toEqual(["Lima"])
  })
})

describe("getPlaceLists", () => {
  it("reads string and string[]", () => {
    expect(getPlaceLists({ attributes: { bucket: "Restaurants" } })).toEqual(["Restaurants"])
    expect(getPlaceLists({ attributes: { bucket: ["Must do", "Favorites"] } })).toEqual([
      "Must do",
      "Favorites",
    ])
  })
})

describe("place visibility", () => {
  it("matches multi-list membership", () => {
    const place = { attributes: { bucket: ["Restaurants", "Favorites"] } } as const
    expect(placeInList(place as never, "Favorites")).toBe(true)
    expect(placeVisibleForLists(place as never, { Restaurants: false, Favorites: true })).toBe(true)
    expect(placeVisibleForLists(place as never, { Restaurants: false, Favorites: false })).toBe(false)
  })

  it("treats home / work / significant as always-visible anchors", () => {
    expect(isAlwaysVisiblePlaceKind("Home")).toBe(true)
    expect(isAlwaysVisiblePlaceKind("Work")).toBe(true)
    expect(isAlwaysVisiblePlaceKind("Significant")).toBe(true)
    expect(isSignificantPlaceKind("Home")).toBe(true)
    expect(isSignificantPlaceKind("Place")).toBe(false)
    expect(colorForPlaceKind("Home", ["Must do"])).toBe(FIXED_PIN_COLORS.home)
    expect(colorForPlaceKind("Work", ["Must do"])).toBe(FIXED_PIN_COLORS.work)
    expect(colorForPlaceKind("Significant", [])).toBe(FIXED_PIN_COLORS.significant)
  })
})

describe("encode / toggle", () => {
  it("encodes single as string and multi as array", () => {
    expect(encodePlaceLists(["Must do"])).toBe("Must do")
    expect(encodePlaceLists(["Must do", "Favorites"])).toEqual(["Must do", "Favorites"])
  })

  it("toggles list membership", () => {
    expect(togglePlaceList(["Must do"], "Favorites")).toEqual(["Must do", "Favorites"])
    expect(togglePlaceList(["Must do", "Favorites"], "Favorites")).toEqual(["Must do"])
  })

  it("cityChipKey uses first segment", () => {
    expect(cityChipKey("Lima, Peru")).toBe("lima")
  })
})

describe("isAlwaysVisiblePlaceKind", () => {
  it("marks airport and stay", () => {
    expect(isAlwaysVisiblePlaceKind("Airport")).toBe(true)
    expect(isAlwaysVisiblePlaceKind("Stay")).toBe(true)
    expect(isAlwaysVisiblePlaceKind("Place")).toBe(false)
  })
})

describe("colorForList", () => {
  it("uses stable named colors for restaurants", () => {
    expect(colorForList("Restaurants")).toBe("#ea580c")
    expect(colorForList("Activities")).toBe("#2563eb")
    expect(colorForList("Restaurants")).toBe(colorForList("restaurants"))
  })

  it("honors per-list overrides", () => {
    expect(colorForList("Restaurants", { Restaurants: "#112233" })).toBe("#112233")
    expect(colorForList("restaurants", { Restaurants: "#aabbcc" })).toBe("#aabbcc")
  })

  it("withListColor merges without duplicate keys", () => {
    const next = withListColor({ restaurants: "#111111" }, "Restaurants", "#ff0000")
    expect(next.Restaurants).toBe("#ff0000")
    expect(next.restaurants).toBeUndefined()
  })
})
