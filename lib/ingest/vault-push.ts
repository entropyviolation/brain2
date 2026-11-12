/**
 * lib/ingest/vault-push.ts — Push this profile's persist keys to the phone hub
 *
 * Chrome already POSTs to /api/persist. Electron does not. The always-on hub
 * hydrates from that file (or a remote URL), so Settings / a 60s tick dumps
 * the live localStorage map. Friend-pic data URLs stay off this map (IndexedDB).
 * Demo profile keys stay off this map so Live hub
 * files cannot pick up stock fiction, and Demo cannot upload Live PII.
 */
import { persistKey, persistKeyAliases, persistKeyBelongsToActiveProfile, readAliasedLocal, DATA_PROFILE_KEY, DEMO_VAULT_READY_KEY } from "@/lib/storage-keys"

const SKIP = /^(?:cogs|brain2)-telegram|friend-pic:/

export function collectVaultItems(): Record<string, string> {
  if (typeof localStorage === "undefined") return {}
  const items: Record<string, string> = {}
  for (let i = 0; i < localStorage.length; i += 1) {
    const name = localStorage.key(i)
    if (!name || SKIP.test(name)) continue
    if (name === DATA_PROFILE_KEY || name === DEMO_VAULT_READY_KEY) continue
    if (!persistKeyBelongsToActiveProfile(name)) continue
    const value = localStorage.getItem(name)
    if (typeof value !== "string" || value === "") continue
    items[name] = value
    if (value.length > 8192) continue
    for (const alias of persistKeyAliases(name)) {
      if (items[alias] == null) items[alias] = value
    }
  }
  return items
}

export function normalizeHubUrl(url: string): string {
  return url.trim().replace(/\/+$/, "")
}

/**
 * What the vault looks like for "did anything change?": the last good save's stamp
 * (`persist-storage.ts` writes it on every real write) and the key count. Cheap: no value is read.
 */
export function vaultPushStamp(): string {
  if (typeof localStorage === "undefined") return ""
  try {
    return `${readAliasedLocal(persistKey("last-persist-ok")) ?? ""}|${localStorage.length}`
  } catch {
    return ""
  }
}

const pushedStamp = new Map<string, string>()

/** Tests start from a clean slate. */
export function resetVaultPushStamps(): void {
  pushedStamp.clear()
}

/**
 * The timed dump. The full map is about 16 MB, and serializing and sending it froze the page for
 * about 200 ms every minute even when nothing had changed. Now it is sent only when a save landed
 * since the last push to that hub.
 */
export async function pushVaultToHubIfChanged(baseUrl: string, token = ""): Promise<{ ok: boolean; skipped?: boolean; error?: string; keyCount?: number }> {
  const origin = normalizeHubUrl(baseUrl)
  const stamp = vaultPushStamp()
  if (stamp && pushedStamp.get(origin) === stamp) return { ok: true, skipped: true }
  const done = await pushVaultToHub(origin, token)
  if (done.ok && stamp) pushedStamp.set(origin, stamp)
  return done
}

export async function pushVaultToHub(baseUrl: string, token = ""): Promise<{ ok: boolean; error?: string; keyCount?: number }> {
  const origin = normalizeHubUrl(baseUrl)
  if (!origin) return { ok: false, error: "No hub URL" }
  const items = collectVaultItems()
  const keyCount = Object.keys(items).length
  if (keyCount === 0) return { ok: false, error: "Nothing in this profile to push" }
  try {
    const res = await fetch(`${origin}/api/persist`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(token.trim() ? { Authorization: `Bearer ${token.trim()}` } : {}),
      },
      body: JSON.stringify({ items, source: "phone-push" }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      return { ok: false, error: body || `HTTP ${res.status}` }
    }
    return { ok: true, keyCount }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "push failed" }
  }
}

/** A hub that refused a connection is not asked again for this long. */
export const HUB_OFFLINE_BACKOFF_MS = 60_000
const hubDownUntil = new Map<string, number>()

/** Tests start from a clean slate. */
export function resetHubOfflineBackoff(): void {
  hubDownUntil.clear()
}

export async function fetchPhoneHubStatus(
  baseUrl: string,
): Promise<{ ok: boolean; polling?: boolean; hub?: boolean; error?: string }> {
  const origin = normalizeHubUrl(baseUrl)
  if (!origin) return { ok: false }
  if ((hubDownUntil.get(origin) ?? 0) > Date.now()) return { ok: false, error: "hub offline" }
  try {
    const res = await fetch(`${origin}/api/ingest/status`, { cache: "no-store" })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    return {
      ok: Boolean(data.ok),
      polling: Boolean(data.polling),
      hub: Boolean(data.hub),
    }
  } catch (err) {
    // The browser logs every refused request as a console error, and the
    // ingest poll asks every 1-5 s. Back off instead of asking a dead hub.
    hubDownUntil.set(origin, Date.now() + HUB_OFFLINE_BACKOFF_MS)
    return { ok: false, error: err instanceof Error ? err.message : "hub offline" }
  }
}
