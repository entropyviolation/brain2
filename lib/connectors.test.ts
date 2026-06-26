import { afterEach, describe, expect, it } from "vitest"
import {
  WEATHER_CONNECTOR_ID,
  createWeatherConnector,
  fetchIntoAttributes,
  getConnector,
  listConnectors,
  registerConnector,
  unregisterConnector,
  type Connector,
} from "@/lib/connectors"

afterEach(() => {
  // Clean up any test connectors; keep the bundled weather one registered.
  unregisterConnector("test-conn")
})

describe("connector registry", () => {
  it("registers the bundled weather connector eagerly", () => {
    const weather = getConnector(WEATHER_CONNECTOR_ID)
    expect(weather).toBeDefined()
    expect(listConnectors().some((c) => c.id === WEATHER_CONNECTOR_ID)).toBe(true)
  })

  it("registers, resolves, and unregisters a custom connector", () => {
    const conn: Connector = {
      id: "test-conn",
      name: "Test",
      async fetch() {
        return { foo: "bar" }
      },
    }
    registerConnector(conn)
    expect(getConnector("test-conn")).toBe(conn)
    expect(unregisterConnector("test-conn")).toBe(true)
    expect(getConnector("test-conn")).toBeUndefined()
  })

  it("replaces a connector registered under the same id", () => {
    const a: Connector = { id: "test-conn", name: "A", fetch: async () => ({}) }
    const b: Connector = { id: "test-conn", name: "B", fetch: async () => ({}) }
    registerConnector(a)
    registerConnector(b)
    expect(getConnector("test-conn")).toBe(b)
  })
})

describe("weather connector (stub)", () => {
  it("returns shape-correct, attribute-keyed data", async () => {
    const result = await createWeatherConnector().fetch({ location: "London" })
    expect(result.location).toBe("London")
    expect(typeof result.temperature).toBe("number")
    expect(typeof result.conditions).toBe("string")
    expect(typeof result.humidity).toBe("number")
    expect(typeof result.windKph).toBe("number")
  })

  it("is deterministic for the same location (offline-friendly mock)", async () => {
    const conn = createWeatherConnector()
    const a = await conn.fetch({ location: "Paris" })
    const b = await conn.fetch({ location: "Paris" })
    expect(a).toEqual(b)
  })

  it("declares its output attributes for schema mapping", () => {
    const conn = createWeatherConnector()
    const ids = (conn.outputs ?? []).map((o) => o.id)
    expect(ids).toContain("temperature")
    expect(ids).toContain("conditions")
  })

  it("defaults to 'Unknown' when no location is provided", async () => {
    const result = await createWeatherConnector().fetch({})
    expect(result.location).toBe("Unknown")
  })
})

describe("fetchIntoAttributes", () => {
  it("returns the raw result when no mapping is given", async () => {
    const conn = createWeatherConnector()
    const patch = await fetchIntoAttributes(conn, { location: "Tokyo" })
    expect(patch.location).toBe("Tokyo")
  })

  it("remaps output keys onto target attribute ids", async () => {
    const conn = createWeatherConnector()
    const patch = await fetchIntoAttributes(conn, { location: "Tokyo" }, { temperature: "tempC" })
    expect(patch.tempC).toBeDefined()
    expect(patch.temperature).toBeUndefined()
    // Unmapped keys pass through unchanged.
    expect(patch.location).toBe("Tokyo")
  })
})
