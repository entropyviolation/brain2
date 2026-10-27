/**
 * lib/ingest/scan-door.ts — One `nfc:` line posted to the phone hub
 *
 * `POST /api/scan` on `npm run phone:hub`. The bearer token is the check.
 * The line then takes the same ingest path as a bot message, and the hub
 * flushes the vault. Telegram pairing is not involved. Anything that is not
 * one `nfc:` line is refused here, before a command runs.
 */
import { ingestIncomingAsync } from "./executor"
import { parseMessage } from "./parse-message"
import type { ApplyResult, IncomingMessage } from "./types"

const SCAN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/

export type ScanDoorRequest = { ok: true; text: string; id: string } | { ok: false; error: string }

export function parseScanDoorRequest(body: unknown): ScanDoorRequest {
  if (!body || typeof body !== "object") return { ok: false, error: "JSON body required" }
  const record = body as { text?: unknown; id?: unknown }
  const text = typeof record.text === "string" ? record.text.trim() : ""
  const id = typeof record.id === "string" ? record.id.trim() : ""
  if (!text || text.includes("\n") || text.includes("\r")) return { ok: false, error: "one nfc: line required" }
  if (!SCAN_ID.test(id)) return { ok: false, error: "id required" }
  if (parseMessage(text).kind !== "nfc") return { ok: false, error: "nfc: line required" }
  return { ok: true, text, id }
}

export function scanDoorMessage(text: string, id: string, receivedAt: string): IncomingMessage {
  return {
    source: { channel: "hub", chatId: "scan" },
    text,
    receivedAt,
    scanId: id,
  }
}

/** Apply a door body. A bad body is an error result and does not write. */
export async function applyScanDoor(body: unknown, now = new Date()): Promise<ApplyResult> {
  const parsed = parseScanDoorRequest(body)
  if (!parsed.ok) {
    return { status: "error", kind: "nfc", reply: parsed.error }
  }
  return ingestIncomingAsync(scanDoorMessage(parsed.text, parsed.id, now.toISOString()), now)
}

export function scanDoorResponse(result: ApplyResult): {
  ok: boolean
  status: ApplyResult["status"]
  summary?: string
  reply?: string
} {
  const summary = "summary" in result ? result.summary : undefined
  return {
    ok: result.status === "ok",
    status: result.status,
    ...(summary ? { summary } : {}),
    ...(result.reply ? { reply: result.reply } : {}),
  }
}
