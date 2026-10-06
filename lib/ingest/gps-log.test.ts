import { describe, expect, it } from "vitest"
import { hiddenGpsCount, isGpsTrackingLogEvent, visibleIngestEvents } from "./gps-log"
import type { IngestEvent } from "./types"

function row(over: Partial<IngestEvent>): IngestEvent {
  return {
    id: "e",
    at: "2026-09-22T05:00:00.000Z",
    channel: "telegram",
    chatId: "1",
    raw: "x",
    kind: "capture",
    status: "applied",
    summary: "ok",
    ...over,
  }
}

describe("gps ingest log", () => {
  const capture = row({ id: "c", at: "2026-09-22T05:00:00.000Z", raw: "milk" })
  const pin = row({
    id: "g",
    at: "2026-09-22T06:00:00.000Z",
    kind: "gps",
    summary: "GPS → Home",
    raw: "gps: Home",
  })
  const failed = row({
    id: "bad",
    at: "2026-09-22T07:00:00.000Z",
    kind: "gps",
    status: "error",
    summary: "Where?",
  })

  it("hides tracking points until asked", () => {
    expect(isGpsTrackingLogEvent(pin)).toBe(true)
    expect(isGpsTrackingLogEvent(failed)).toBe(false)
    expect(isGpsTrackingLogEvent(row({ kind: "gps", status: "ignored", summary: "Unpaired sender" }))).toBe(
      false,
    )
    expect(visibleIngestEvents([pin, failed, capture], [], false).map((event) => event.id)).toEqual([
      "bad",
      "c",
    ])
    expect(visibleIngestEvents([failed, capture], [pin], true).map((event) => event.id)).toEqual([
      "bad",
      "g",
      "c",
    ])
    expect(hiddenGpsCount([pin, failed], [pin])).toBe(1)
  })
})
