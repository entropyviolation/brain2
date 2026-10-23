/**
 * Time → Places, People, Mood field, Diversity render their 2026-10-23 plates
 * when there is paint. Empty states live in `studio-views.test.tsx`.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"
import type { TimeEntry } from "@/lib/time-entries"
import { resetLocalStorage } from "@/tests/test-utils"
import { useAnalyticsRangeStore } from "./analytics-range-store"
import { PlacesView } from "./PlacesView"
import { PeopleView } from "./PeopleView"
import { MoodFieldView } from "./MoodFieldView"
import { DiversityView } from "./DiversityView"

const pen = (id: string, name: string, color: string, parentId?: string) => ({ id, name, color, parentId })

const scopes = [
  { id: "location", name: "Location", pens: [pen("home", "Home", "#335"), pen("park", "Park", "#3a5")] },
  { id: "company", name: "Company", pens: [pen("ana", "Ana", "#a35"), pen("bo", "Bo", "#53a")] },
  { id: "mood", name: "Mood", pens: [pen("calm", "Calm", "#5aa"), pen("bright", "Bright", "#fa3", "calm")] },
] as unknown as TrackScope[]

function day(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offset)
  return formatLocalDateKey(d)
}

let n = 0
const block = (date: string, scopeId: string, penId: string, startMin: number, endMin: number) =>
  ({ id: `e${n++}`, date, scopeId, penId, startMin, endMin, kind: "block" }) as unknown as TimeEntry

describe("time views with paint", () => {
  beforeEach(() => {
    resetLocalStorage()
    useAnalyticsRangeStore.setState({ days: 30, hydrated: true })
    const entries: TimeEntry[] = []
    for (let i = 0; i < 14; i++) {
      const d = day(i)
      entries.push(block(d, "location", i % 3 ? "home" : "park", 480, 600 + i * 5))
      entries.push(block(d, "company", i % 2 ? "ana" : "bo", 600, 660))
      entries.push(block(d, "mood", i % 2 ? "calm" : "bright", 540, 600))
    }
    useTimeTrackingStore.setState((s) => ({ ...s, scopes, entries }))
  })

  it("Places shows readouts and the place clock", () => {
    render(<PlacesView />)
    expect(screen.getByTestId("places-clock")).toBeInTheDocument()
    expect(screen.getByText("Spread")).toBeInTheDocument()
  })

  it("People shows arcs and days together", () => {
    render(<PeopleView />)
    expect(screen.getByTestId("people-arcs")).toBeInTheDocument()
    expect(screen.getByTestId("people-days-together")).toBeInTheDocument()
  })

  it("Mood field shows the wheel and the table", () => {
    render(<MoodFieldView />)
    expect(screen.getByTestId("mood-wheel")).toBeInTheDocument()
    expect(screen.getByTestId("mood-taxonomy")).toBeInTheDocument()
  })

  it("Diversity shows anchors and the cover slider", () => {
    render(<DiversityView />)
    expect(screen.getByTestId("diversity-anchors")).toBeInTheDocument()
    expect(screen.getByLabelText("Share of time")).toBeInTheDocument()
  })
})
