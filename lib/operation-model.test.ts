/**
 * lib/operation-model.test.ts — Operation configuration model
 *
 * Covers the two attributes that decide what an individual operation *is*:
 * its panel selection (with the legacy `activities`/`itinerary` renames) and its
 * free-form categories.
 */
import { describe, expect, it } from "vitest"
import {
  DEFAULT_OPERATION_PANELS,
  OPERATION_ATTR,
  OPERATION_PANELS,
  OPERATION_PRESETS,
  canonicalOperationPanelId,
  getOperationCategories,
  getOperationPanel,
  getOperationPreset,
  isOperationPanelEnabled,
  isWideOperationPanel,
  normalizeOperationCategories,
  normalizeOperationPanelIds,
  operationCategoriesAttribute,
  operationPanelsAttribute,
  resolveOperationPanels,
  sortOperationPanelIds,
  toggleOperationPanelIds,
  withOperationCategory,
  withoutOperationCategory,
  getOperationTypeDefinition,
  getOperationTrackingTagIds,
  operationTrackingTagIdsAttribute,
} from "@/lib/operation-types"

function op(attributes: Record<string, unknown> = {}) {
  return { attributes }
}

describe("operation panels", () => {
  it("defaults to the standard panel set when unconfigured", () => {
    expect(resolveOperationPanels(op())).toEqual(sortOperationPanelIds(DEFAULT_OPERATION_PANELS))
    expect(resolveOperationPanels(null)).toContain("home")
    // Trip-only panels are off by default — an operation is not a trip.
    expect(resolveOperationPanels(op())).not.toContain("locations")
    expect(resolveOperationPanels(op())).not.toContain("timeline")
    expect(resolveOperationPanels(op())).toContain("parts")
    expect(getOperationPanel("tasks")?.label).toBe("To do")
    expect(getOperationPanel("parts")?.label).toBe("Parts")
  })

  it("reads the stored selection and keeps registry order", () => {
    const stored = op({ [OPERATION_ATTR.panels]: ["log", "tasks", "home"] })
    expect(resolveOperationPanels(stored)).toEqual(["home", "tasks", "log"])
    expect(isOperationPanelEnabled(stored, "tasks")).toBe(true)
    expect(isOperationPanelEnabled(stored, "phases")).toBe(false)
  })

  it("migrates the trip-flavored panel names", () => {
    expect(canonicalOperationPanelId("activities")).toBe("locations")
    expect(canonicalOperationPanelId("itinerary")).toBe("timeline")
    expect(canonicalOperationPanelId("Activities")).toBe("locations")
    expect(canonicalOperationPanelId("nope")).toBeNull()
    expect(resolveOperationPanels(op({ [OPERATION_ATTR.panels]: ["activities", "itinerary"] }))).toEqual([
      "home",
      "timeline",
      "locations",
    ])
  })

  it("parses comma strings, drops unknown ids, and forces Home on", () => {
    expect(normalizeOperationPanelIds("tasks, log")).toEqual(["home", "tasks", "log"])
    expect(normalizeOperationPanelIds(["ghost"])).toBeNull()
    expect(normalizeOperationPanelIds([])).toBeNull()
    expect(normalizeOperationPanelIds(undefined)).toBeNull()
  })

  it("toggles panels without ever removing Home", () => {
    const withPhases = toggleOperationPanelIds(["home", "log"], "phases", true)
    expect(withPhases).toEqual(["home", "phases", "log"])
    expect(toggleOperationPanelIds(withPhases, "phases", false)).toEqual(["home", "log"])
    expect(toggleOperationPanelIds(["home"], "home", false)).toEqual(["home"])
  })

  it("marks the field-plan panels as full-width", () => {
    expect(isWideOperationPanel("timeline")).toBe(true)
    expect(isWideOperationPanel("locations")).toBe(true)
    expect(isWideOperationPanel("plan")).toBe(true)
    expect(isWideOperationPanel("tasks")).toBe(false)
  })

  it("has exactly one rail panel and one locked panel", () => {
    expect(OPERATION_PANELS.filter((p) => p.surface === "rail").map((p) => p.id)).toEqual(["queue"])
    expect(OPERATION_PANELS.filter((p) => p.locked).map((p) => p.id)).toEqual(["home"])
  })

  it("writes a serializable attribute patch", () => {
    expect(operationPanelsAttribute(["log", "home"])).toEqual({
      [OPERATION_ATTR.panels]: ["home", "log"],
    })
  })
})

describe("operation presets", () => {
  it("gives the trip preset the field-plan panels and the project preset phases", () => {
    const trip = getOperationPreset("trip")!
    expect(trip.panels).toContain("timeline")
    expect(trip.panels).toContain("locations")
    expect(trip.categories).toEqual(["trip"])

    const project = getOperationPreset("project")!
    expect(project.panels).toContain("phases")
    expect(project.panels).toContain("parts")
    expect(project.panels).not.toContain("locations")
  })

  it("keeps Blank down to Home and resolves unknown ids to undefined", () => {
    expect(getOperationPreset("blank")!.panels).toEqual(["home"])
    expect(getOperationPreset("nope")).toBeUndefined()
    expect(OPERATION_PRESETS.every((p) => p.panels.includes("home"))).toBe(true)
  })
})

describe("operation categories", () => {
  it("trims, drops blanks, and de-duplicates case-insensitively", () => {
    expect(normalizeOperationCategories([" trip ", "Trip", "", "paid"])).toEqual(["trip", "paid"])
    expect(normalizeOperationCategories("paid, foxtide job")).toEqual(["paid", "foxtide job"])
    expect(normalizeOperationCategories(42)).toEqual([])
  })

  it("reads many categories off one operation", () => {
    const paidJob = op({ [OPERATION_ATTR.categories]: ["paid", "foxtide job"] })
    expect(getOperationCategories(paidJob)).toEqual(["paid", "foxtide job"])
    expect(getOperationCategories(op())).toEqual([])
  })

  it("adds and removes ignoring case", () => {
    expect(withOperationCategory(["paid"], "Foxtide Job")).toEqual(["paid", "Foxtide Job"])
    expect(withOperationCategory(["paid"], "PAID")).toEqual(["paid"])
    expect(withoutOperationCategory(["paid", "trip"], "TRIP")).toEqual(["paid"])
  })

  it("writes a serializable attribute patch", () => {
    expect(operationCategoriesAttribute([" trip ", "trip"])).toEqual({
      [OPERATION_ATTR.categories]: ["trip"],
    })
  })
})

describe("operation tracking tags", () => {
  it("reads unique trimmed tag ids off the operation", () => {
    expect(getOperationTrackingTagIds(op({ [OPERATION_ATTR.trackingTagIds]: ["tag-work", " tag-work ", "", "tag-rest"] }))).toEqual([
      "tag-work",
      "tag-rest",
    ])
    expect(getOperationTrackingTagIds(op())).toEqual([])
  })

  it("writes a serializable attribute patch", () => {
    expect(operationTrackingTagIdsAttribute([" tag-work ", "tag-work", "tag-rest"])).toEqual({
      [OPERATION_ATTR.trackingTagIds]: ["tag-work", "tag-rest"],
    })
  })
})

describe("operation item type", () => {
  it("declares categories on the schema and shows them in the item detail", () => {
    const def = getOperationTypeDefinition()
    expect(def.attributes?.map((a) => a.id)).toContain(OPERATION_ATTR.categories)
    expect(def.attributes?.find((a) => a.id === OPERATION_ATTR.categories)?.type).toBe("multistring")
    expect(def.displayedAttributes).toContain(OPERATION_ATTR.categories)
  })
})
