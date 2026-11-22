/**
 * lib/bim-flow/chat-models.ts — Find the models BIM chat can use, on the Mac or the iPhone
 *
 * The Mac (Electron, a desktop tab) asks its own Ollama. The iPhone app asks the
 * Mac it syncs with, through `/api/ollama` (`scripts/persist-api.mjs`) and the
 * hub token, and runs the flow on its own copy of the vault. No Mac, no Ollama,
 * or nothing installed means null: chat stays on the grammar ladder.
 */

import { isPhoneWebStorage } from "@/lib/phone-device"
import { crewFor, type Crew } from "./crew"
import { listOllamaModels, setModelEndpoint } from "./ollama"

const TTL_MS = 60_000
let cached: { at: number; crew: Crew | null } | null = null

function savedMainModel(): string | undefined {
  try {
    const raw = localStorage.getItem("bimflow-model")
    const v = raw ? JSON.parse(raw) : null
    return typeof v === "string" ? v : undefined
  } catch {
    return undefined
  }
}

/**
 * Models too big to sit beside the 3B and the 14B on a 32 GB Mac. A call to one pushes the others out, and the
 * next chat turn pays a reload (a router call took the whole 45 s timeout after one: `docs/BIM_CHAT_USAGE.md` §9).
 * Chat and its BIMBIES leave them out of every ladder, unless one is the only model or the chosen main model.
 * A lab that wants one names it on the node or the run.
 */
export const NOT_RESIDENT = ["qwen3:30b-a3b"]

export function residentCrew(crew: Crew | null): Crew | null {
  if (!crew) return null
  const keep = (ladder: string[]) => {
    const cut = ladder.filter((m) => !NOT_RESIDENT.includes(m) || m === crew.main)
    return cut.length ? cut : ladder
  }
  const out = { ...crew }
  for (const role of Object.keys(crew) as (keyof Crew)[]) if (role !== "main") (out as Record<string, unknown>)[role] = keep(crew[role] as string[])
  return out
}

/** The crew for this device, checked at most once a minute. */
export async function chatCrew(): Promise<Crew | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.crew
  if (isPhoneWebStorage()) {
    const { phoneHubRoute } = await import("@/lib/phone-window")
    const hub = await phoneHubRoute()
    if (!hub.url) {
      cached = { at: Date.now(), crew: null }
      return null
    }
    setModelEndpoint({ base: `${hub.url}/api/ollama`, headers: hub.headers })
  }
  const installed = await listOllamaModels()
  const crew = installed ? residentCrew(crewFor(installed, savedMainModel())) : null
  cached = { at: Date.now(), crew }
  return crew
}

/** Forget the last check, so the next line looks again (after the Mac comes back). */
export function forgetChatCrew(): void {
  cached = null
}
