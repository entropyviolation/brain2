/**
 * lib/connectors.ts — Pluggable, read-only external-data connector seam
 *
 * A `Connector` is a small, serializable adapter that fetches data from an
 * external source (a weather API, a flight-status API, a currency feed, …) and
 * returns it already shaped as **attribute values** — a `Record<attributeId,
 * AttributeValue>` — so the result drops straight onto an item's `attributes`
 * with no per-source glue code. New integrations register a connector and are
 * immediately usable by any feature that reads the registry (item detail panels,
 * workflows, modules); the core never needs to change.
 *
 * Design constraints:
 *   - **Read-only**: a connector only `fetch`es; it never mutates app state.
 *   - **Serializable I/O**: params and results are JSON-safe (`AttributeValue`s),
 *     so they cross IPC / network boundaries and can be cached or replayed.
 *   - **Self-describing**: `outputs` declares the attributes a connector
 *     produces (reusing `AttributeDefinition`) so the UI can preview/map fields.
 *
 * The bundled **weather** connector is a dependency-free, deterministic stub: it
 * returns shape-correct mock data derived from its params (no API key, works
 * offline) and shows exactly how a real API would map onto attributes later.
 */
import type { AttributeDefinition, AttributeValue } from "@/lib/types"

/** Serializable input parameters passed to a connector's `fetch`. */
export type ConnectorParams = Record<string, string | number | boolean | undefined>

/**
 * A read-only adapter mapping an external source onto attribute values. The
 * `fetch` result is keyed by attribute id so it can be merged directly into an
 * item's `attributes`.
 */
export interface Connector {
  id: string
  name: string
  description?: string
  /** Attributes this connector produces (for previews / schema mapping). */
  outputs?: AttributeDefinition[]
  /** Fetch external data, shaped as attribute values. Read-only. */
  fetch(params: ConnectorParams): Promise<Record<string, AttributeValue>>
}

// ---- Registry --------------------------------------------------------------
// Module-level so connectors registered once are visible app-wide. Real
// integrations call `registerConnector` at startup; the bundled weather
// connector is registered eagerly below.

const registry = new Map<string, Connector>()

/** Register (or replace) a connector by id. */
export function registerConnector(connector: Connector): void {
  registry.set(connector.id, connector)
}

/** Remove a connector by id. Returns true if one was removed. */
export function unregisterConnector(id: string): boolean {
  return registry.delete(id)
}

/** Resolve a connector by id, or undefined when not registered. */
export function getConnector(id: string): Connector | undefined {
  return registry.get(id)
}

/** All registered connectors, in registration order. */
export function listConnectors(): Connector[] {
  return [...registry.values()]
}

/**
 * Fetch from a connector and optionally remap its output keys onto target
 * attribute ids (`{ connectorOutputId: targetAttributeId }`). Returns an
 * attributes patch ready to merge onto `item.attributes`. Convenience for the
 * common "pull external data into this item" flow.
 */
export async function fetchIntoAttributes(
  connector: Connector,
  params: ConnectorParams,
  mapping?: Record<string, string>,
): Promise<Record<string, AttributeValue>> {
  const result = await connector.fetch(params)
  if (!mapping) return result
  const mapped: Record<string, AttributeValue> = {}
  for (const [outId, value] of Object.entries(result)) {
    mapped[mapping[outId] ?? outId] = value
  }
  return mapped
}

// ---- Sample weather connector (stub) ---------------------------------------

export const WEATHER_CONNECTOR_ID = "weather"

const WEATHER_OUTPUTS: AttributeDefinition[] = [
  { id: "location", name: "Location", type: "string" },
  { id: "temperature", name: "Temperature", type: "number", unit: "°C", allowFloat: true },
  { id: "conditions", name: "Conditions", type: "string" },
  { id: "humidity", name: "Humidity", type: "number", unit: "%" },
  { id: "windKph", name: "Wind", type: "number", unit: "kph" },
]

const WEATHER_CONDITIONS = ["Clear", "Partly cloudy", "Cloudy", "Rain", "Snow", "Fog"] as const

/** Stable string → non-negative int hash (deterministic mock seeding). */
function hashString(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h
}

/**
 * A read-only weather connector stub. Returns deterministic, shape-correct mock
 * data derived from `params.location` (no API key, works offline). Swapping in a
 * real API later means only re-implementing `fetch` — every consumer and the
 * registry stay identical.
 */
export function createWeatherConnector(): Connector {
  return {
    id: WEATHER_CONNECTOR_ID,
    name: "Weather",
    description:
      "Fetches current weather for a location (stub: deterministic mock data, no API key). Demonstrates mapping an external API onto attribute values.",
    outputs: WEATHER_OUTPUTS,
    async fetch(params: ConnectorParams): Promise<Record<string, AttributeValue>> {
      const location = String(params.location ?? "Unknown").trim() || "Unknown"
      const seed = hashString(location.toLowerCase())
      return {
        location,
        temperature: -5 + (seed % 35),
        conditions: WEATHER_CONDITIONS[seed % WEATHER_CONDITIONS.length],
        humidity: 30 + (seed % 60),
        windKph: seed % 40,
      }
    },
  }
}

// Register the bundled connector eagerly so it's available app-wide on import.
registerConnector(createWeatherConnector())
