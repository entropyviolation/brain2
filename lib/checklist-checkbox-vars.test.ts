import { describe, expect, it } from "vitest"
import {
  DEFAULT_CHECKLIST_CHECKBOX_VARS,
  sanitizeChecklistCheckboxVars,
  toggleChecklistCheckboxVar,
} from "@/lib/checklist-checkbox-vars"

describe("sanitizeChecklistCheckboxVars", () => {
  it("defaults to Completed only", () => {
    expect(sanitizeChecklistCheckboxVars(undefined)).toEqual(["completed"])
    expect(sanitizeChecklistCheckboxVars([])).toEqual(["completed"])
    expect(sanitizeChecklistCheckboxVars(["missed"])).toEqual(["completed", "missed"])
    expect(DEFAULT_CHECKLIST_CHECKBOX_VARS).toEqual(["completed"])
  })

  it("always keeps Completed first and drops unknown ids", () => {
    expect(sanitizeChecklistCheckboxVars(["missed", "completed", "nope"])).toEqual(["completed", "missed"])
  })
})

describe("toggleChecklistCheckboxVar", () => {
  it("stores undefined when only Completed remains", () => {
    expect(toggleChecklistCheckboxVar(["completed", "missed"], "missed", false)).toBeUndefined()
  })

  it("adds Missed opportunity as an extra column", () => {
    expect(toggleChecklistCheckboxVar(undefined, "missed", true)).toEqual(["completed", "missed"])
  })
})
