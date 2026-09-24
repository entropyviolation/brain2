import { describe, expect, it } from "vitest"
import type { TimeEntry } from "./time-entries"
import type { TrackPen, TrackScope } from "./time-tracking-store"
import {
  actionValuesFor,
  interpolateActionFormat,
  pickActionFormat,
  renderPenActionTitle,
  penActionLogId,
} from "./pen-action-format"

const walking: TrackPen = {
  id: "walk",
  name: "Walking",
  color: "#10b981",
  actionFormats: [
    { id: "f-loc", template: "Went for a {minutes} minute walk at {location}" },
    { id: "f-plain", template: "Went for a walk" },
  ],
}

const work: TrackPen = {
  id: "work",
  name: "Work",
  color: "#2563eb",
  actionFormats: [
    { id: "f-proj", template: "Worked on {project name} for {hours} hours" },
    { id: "f-hours", template: "Worked for {hours} hours" },
    { id: "f-plain", template: "Worked" },
  ],
}

const scopes: TrackScope[] = [
  { id: "activity", name: "Activity", pens: [walking, work] },
  {
    id: "location",
    name: "Location",
    pens: [{ id: "beach", name: "Ocean Beach", color: "#2563eb" }],
  },
]

const walkBlock: TimeEntry = {
  id: "e1",
  date: "2026-09-20",
  scopeId: "activity",
  penId: "walk",
  startMin: 60,
  endMin: 75,
}

describe("pen action formats", () => {
  it("uses the plain Walking template when there is no location", () => {
    const values = actionValuesFor(walkBlock, walking, [walkBlock], scopes)
    expect(renderPenActionTitle(walking.actionFormats, values)).toBe("Went for a walk")
  })

  it("picks the location template when a Location block overlaps", () => {
    const loc: TimeEntry = {
      id: "loc1",
      date: "2026-09-20",
      scopeId: "location",
      penId: "beach",
      startMin: 60,
      endMin: 90,
    }
    const values = actionValuesFor(walkBlock, walking, [walkBlock, loc], scopes)
    expect(values.location).toBe("Ocean Beach")
    expect(renderPenActionTitle(walking.actionFormats, values)).toBe(
      "Went for a 15 minute walk at Ocean Beach",
    )
  })

  it("falls back from a missing project name to Worked / duration", () => {
    const block: TimeEntry = { ...walkBlock, penId: "work", startMin: 540, endMin: 660 }
    const values = actionValuesFor(block, work, [block], scopes)
    expect(renderPenActionTitle(work.actionFormats, values)).toBe("Worked for 2 hours")
  })

  it("uses the project template when a project is set, and re-renders if it changes", () => {
    const block: TimeEntry = {
      ...walkBlock,
      penId: "work",
      startMin: 540,
      endMin: 660,
      project: "Spanish",
    }
    const values = actionValuesFor(block, work, [block], scopes)
    expect(renderPenActionTitle(work.actionFormats, values)).toBe("Worked on Spanish for 2 hours")
    const renamed = actionValuesFor({ ...block, project: "French" }, work, [block], scopes)
    expect(renderPenActionTitle(work.actionFormats, renamed)).toBe("Worked on French for 2 hours")
  })

  it("substitutes the custom display name", () => {
    const block: TimeEntry = { ...walkBlock, title: "walk to the beach" }
    const values = actionValuesFor(block, walking, [block], scopes)
    expect(interpolateActionFormat("Logged {name}", values)).toBe("Logged walk to the beach")
  })

  it("breaks equal specificity by the order the user listed the formats", () => {
    const first = { id: "a", template: "Went for a {x} minute walk" }
    const second = { id: "b", template: "Walked {minutes} minutes" }
    const values = { minutes: "15", x: "15" }
    expect(pickActionFormat([first, second], values)?.id).toBe("a")
    expect(pickActionFormat([second, first], values)?.id).toBe("b")
  })

  it("returns null when the pen has no formats", () => {
    expect(pickActionFormat(undefined, {})).toBeNull()
    expect(renderPenActionTitle([], { minutes: "15" })).toBeNull()
  })

  it("ids the Done row from the span when the block crossed midnight", () => {
    expect(penActionLogId({ id: "e1", spanId: "span-9" })).toBe("pen-action-span-9")
    expect(penActionLogId({ id: "e1" })).toBe("pen-action-e1")
  })
})
