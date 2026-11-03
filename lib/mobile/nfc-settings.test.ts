/**
 * lib/mobile/nfc-settings.test.ts — The testing-settings record round-trips
 */
import { describe, expect, it } from "vitest"
import { encodeTestingSettings, parseTestingSettings } from "./nfc-settings"

describe("testing settings record", () => {
  it("keeps the hub and the sync URL, and drops a path on the hub", () => {
    const text = encodeTestingSettings({
      origin: "http://mac.local:8787",
      token: "s3cret",
      syncUrl: "http://192.168.0.150:3000",
    })
    expect(JSON.parse(text)).toEqual({
      k: "b2test",
      o: "http://mac.local:8787",
      t: "s3cret",
      s: "http://192.168.0.150:3000",
    })
    expect(parseTestingSettings(text)).toEqual({
      origin: "http://mac.local:8787",
      token: "s3cret",
      syncUrl: "http://192.168.0.150:3000",
    })
    expect(
      parseTestingSettings(
        encodeTestingSettings({ origin: "http://mac.local:8787/api/scan", token: "s3cret", syncUrl: "" }),
      ),
    ).toEqual({ origin: "http://mac.local:8787", token: "s3cret", syncUrl: "" })
  })

  it("leaves other text alone", () => {
    expect(parseTestingSettings("")).toBeNull()
    expect(parseTestingSettings("nfc:adderall 2")).toBeNull()
    expect(parseTestingSettings('{"k":"b2test"}')).toBeNull()
    expect(parseTestingSettings('{"k":"b2test","o":"notaurl","t":"x"}')).toBeNull()
  })
})
