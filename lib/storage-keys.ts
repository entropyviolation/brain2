/**
 * lib/storage-keys.ts — Canonical `brain2-*` persist keys, `cogs-*` alias
 *
 * Product storage is **`brain2-*`**. Historical **`cogs-*`** keys are a
 * read/write alias so a rename cannot drop a vault. Reads prefer `brain2-*`,
 * then copy from `cogs-*` if that is all that exists. Small pins dual-write;
 * large vaults write `brain2-*` only. QuotaExceeded drops duplicate `cogs-*`
 * twins and dead pre-prefix relics (`task-storage`, `habits-store`, …) that
 * already have a `brain2-*` copy, then writes again.
 *
 * A write lands on the **first** alias — the one reads prefer — before any
 * twin, and that write alone decides success. Filling the origin used to park
 * the newer value on `cogs-*` while `brain2-*` kept the older one, so a
 * submitted day note read back as if it had never been written.
 *
 * **Data profile.** Settings can switch **Live** (your vault) vs **Demo**
 * (stock fiction). Demo physical keys are `brain2-demo-*` only — never
 * `cogs-*`, never unprefixed live `brain2-*`. The selector itself is
 * `brain2-data-profile` and is never scoped. Default is Live.
 *
 * Not storage: CSS like `.cogs-color-swatch`, Electron userData folder
 * `cogs`, git folder names. Those stay.
 */

export const LEGACY_PERSIST_PREFIX = "cogs-"
export const PERSIST_PREFIX = "brain2-"
export const DEMO_PERSIST_PREFIX = "brain2-demo-"

/** Selector for Live vs Demo. Never dual-written, never demo-scoped. */
export const DATA_PROFILE_KEY = "brain2-data-profile"

/** Set after the stock vault is written into `brain2-demo-*` keys. */
export const DEMO_VAULT_READY_KEY = "brain2-demo-vault-ready"

export type DataProfile = "live" | "demo"

/** Stores that never used a `cogs-` / `brain2-` prefix. Do not invent one. */
const UNPREFIXED_KEYS = new Set(["points-store", "regret-store"])

const PLAN_TEXT_BARE = /^(day|week|month)Plan-/

const UNSCOPED_KEYS = new Set([DATA_PROFILE_KEY, DEMO_VAULT_READY_KEY])

export function readDataProfile(): DataProfile {
  if (typeof localStorage === "undefined") return "live"
  try {
    return localStorage.getItem(DATA_PROFILE_KEY) === "demo" ? "demo" : "live"
  } catch {
    return "live"
  }
}

export function writeDataProfile(profile: DataProfile): void {
  if (typeof localStorage === "undefined") return
  try {
    if (profile === "demo") localStorage.setItem(DATA_PROFILE_KEY, "demo")
    else localStorage.removeItem(DATA_PROFILE_KEY)
  } catch {
    /* selector is best-effort */
  }
}

export function isDemoProfile(): boolean {
  return readDataProfile() === "demo"
}

export function isDemoPhysicalKey(name: string): boolean {
  return name.startsWith(DEMO_PERSIST_PREFIX)
}

/** Map a logical persist name onto the Demo-only physical key. */
export function demoPhysicalKey(name: string): string {
  if (UNSCOPED_KEYS.has(name) || isDemoPhysicalKey(name)) return name
  const suffix = persistSuffix(name)
  if (suffix != null) return `${DEMO_PERSIST_PREFIX}${suffix}`
  if (UNPREFIXED_KEYS.has(name)) return `${DEMO_PERSIST_PREFIX}${name}`
  if (PLAN_TEXT_BARE.test(name)) return `${DEMO_PERSIST_PREFIX}${name}`
  return `${DEMO_PERSIST_PREFIX}${name}`
}

/** Day/week/month plan logs (`dayPlan-*` / `weekPlan-*` / `monthPlan-*`). */
export function isPlanTextStorageKey(name: string): boolean {
  const bare = persistSuffix(name) ?? name
  return PLAN_TEXT_BARE.test(bare)
}

/** `friend-worn` → `brain2-friend-worn`. Pass a full key of either prefix too. */
export function persistKey(name: string): string {
  if (UNPREFIXED_KEYS.has(name)) return name
  const suffix = persistSuffix(name)
  return `${PERSIST_PREFIX}${suffix ?? name}`
}

export function legacyPersistKey(name: string): string {
  if (UNPREFIXED_KEYS.has(name)) return name
  const suffix = persistSuffix(name)
  return `${LEGACY_PERSIST_PREFIX}${suffix ?? name}`
}

export function persistSuffix(name: string): string | null {
  if (name.startsWith(DEMO_PERSIST_PREFIX)) return name.slice(DEMO_PERSIST_PREFIX.length)
  if (name.startsWith(PERSIST_PREFIX)) return name.slice(PERSIST_PREFIX.length)
  if (name.startsWith(LEGACY_PERSIST_PREFIX)) return name.slice(LEGACY_PERSIST_PREFIX.length)
  return null
}

/** True when this physical key belongs to the active Live/Demo vault. */
export function persistKeyBelongsToActiveProfile(name: string): boolean {
  if (UNSCOPED_KEYS.has(name)) return true
  if (isDemoProfile()) return isDemoPhysicalKey(name)
  return !isDemoPhysicalKey(name)
}

/** Drop every `brain2-demo-*` key. Never touches Live `brain2-*` / `cogs-*`. */
export function wipeDemoPhysicalKeys(): number {
  if (typeof localStorage === "undefined") return 0
  let n = 0
  const names: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key) names.push(key)
  }
  for (const key of names) {
    if (!isDemoPhysicalKey(key)) continue
    try {
      localStorage.removeItem(key)
      n++
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(DEMO_VAULT_READY_KEY)
  } catch {
    /* ignore */
  }
  return n
}

/** Compare vault names ignoring cogs/brain2 prefix. */
export function samePersistKey(a: string, b: string): boolean {
  return persistKey(a) === persistKey(b)
}

export function persistKeyAliases(name: string): string[] {
  if (UNSCOPED_KEYS.has(name)) return [name]
  if (isDemoProfile()) return [demoPhysicalKey(name)]
  if (UNPREFIXED_KEYS.has(name)) return [name]
  const suffix = persistSuffix(name)
  if (suffix == null) {
    if (PLAN_TEXT_BARE.test(name)) return [name, `${PERSIST_PREFIX}${name}`, `${LEGACY_PERSIST_PREFIX}${name}`]
    return [name]
  }
  return [`${PERSIST_PREFIX}${suffix}`, `${LEGACY_PERSIST_PREFIX}${suffix}`]
}

export function twinPersistKey(name: string): string | null {
  if (name.startsWith(PERSIST_PREFIX)) return `${LEGACY_PERSIST_PREFIX}${name.slice(PERSIST_PREFIX.length)}`
  if (name.startsWith(LEGACY_PERSIST_PREFIX)) return `${PERSIST_PREFIX}${name.slice(LEGACY_PERSIST_PREFIX.length)}`
  return null
}

export function readAliasedLocal(name: string): string | null {
  if (typeof localStorage === "undefined") return null
  const aliases = persistKeyAliases(name)
  try {
    for (const key of aliases) {
        const value = localStorage.getItem(key)
        if (value != null && value !== "") {
          const canonical = persistKey(name)
          if (!isDemoProfile() && key !== canonical) {
            try {
              if (localStorage.getItem(canonical) == null) localStorage.setItem(canonical, value)
            } catch {
              /* keep the alias read */
            }
          }
          return value
        }
    }
  } catch {
    return null
  }
  return null
}

/** Twin-write tiny prefs; lists / photos must not consume a second quota slice. */
const DUAL_WRITE_MAX_CHARS = 8192

function writeKeysForValue(name: string, value: string): string[] {
  const aliases = persistKeyAliases(name)
  if (isDemoProfile() || value.length <= DUAL_WRITE_MAX_CHARS) return aliases
  const canonical = persistKey(name)
  return aliases[0] === canonical ? [canonical] : [aliases[0]]
}

/**
 * Drop `cogs-*` keys that already have a `brain2-*` copy. Frees origin quota
 * after the dual-write era. Never removes a legacy key that is the only vault.
 */
export function releaseDuplicateLegacyTwins(minChars = 0): number {
  if (typeof localStorage === "undefined") return 0
  if (isDemoProfile()) return 0
  let n = 0
  const names: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) names.push(key)
    }
  } catch {
    return 0
  }
  for (const key of names) {
    if (!key.startsWith(LEGACY_PERSIST_PREFIX)) continue
    const neu = persistKey(key)
    if (neu === key) continue
    try {
      const live = localStorage.getItem(neu)
      const twin = localStorage.getItem(key)
      if (live == null || live === "") continue
      // Not a duplicate. A twin that drifted (a write that half-failed on a
      // full origin) may hold the newer copy; its vault heals that on read.
      if (twin != null && twin !== "" && twin !== live) continue
      if (minChars > 0 && (live.length < minChars && (twin == null || twin.length < minChars))) continue
      localStorage.removeItem(key)
      n++
    } catch {
      /* skip this twin */
    }
  }
  return n
}

/**
 * The first alias is what `readAliasedLocal` hands back, so it is written
 * first and alone decides success. Writing a twin after the primary failed
 * (origin quota) parked the newer copy on `cogs-*` where nothing reads it —
 * a submitted day note that looked saved and was gone on refresh.
 */
export function writeAliasedLocal(name: string, value: string): void {
  if (typeof localStorage === "undefined") return
  const keys = writeKeysForValue(name, value)
  const primary = keys[0] ?? persistKey(name)
  try {
    localStorage.setItem(primary, value)
  } catch (error) {
    if (!isQuotaExceededError(error)) throw error
    releaseDuplicateLegacyTwins()
    releaseCopiedUnprefixedKeys()
    localStorage.setItem(primary, value)
  }
  for (const key of keys.slice(1)) {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* twin is a courtesy copy; the primary already holds this value */
    }
  }
}

/** Origin quota is exhausted. `persist-storage` re-exports this for callers. */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const err = error as { name?: string; code?: number }
  return (
    err.name === "QuotaExceededError" ||
    err.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    err.code === 22 ||
    err.code === 1014
  )
}

export function removeAliasedLocal(name: string): void {
  if (typeof localStorage === "undefined") return
  for (const key of persistKeyAliases(name)) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

/**
 * Copy every `cogs-*` localStorage entry onto `brain2-*` when the new key is
 * empty. Then drop oversized `cogs-*` twins that already copied, so origin
 * quota can hold one lists vault instead of two.
 */
export function copyLegacyPersistKeys(): number {
  if (typeof localStorage === "undefined") return 0
  if (isDemoProfile()) return 0
  let copied = 0
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
    for (const key of keys) {
      if (!key.startsWith(LEGACY_PERSIST_PREFIX)) continue
      const neu = persistKey(key)
      if (neu === key) continue
      if (localStorage.getItem(neu) != null) continue
      const value = localStorage.getItem(key)
      if (value == null) continue
      try {
        localStorage.setItem(neu, value)
        copied += 1
      } catch {
        /* skip this entry */
      }
    }
  } catch {
    return copied
  }
  return copied
}

let copiedOnce = false

/**
 * Friend cutouts live in IndexedDB. Data-URL copies in localStorage are what
 * filled origin quota and dropped Inbox / theme writes on reload.
 */
export function releaseFriendPicLocalKeys(): number {
  if (typeof localStorage === "undefined") return 0
  let n = 0
  const names: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) names.push(key)
    }
  } catch {
    return 0
  }
  for (const key of names) {
    if (!key.includes("friend-pic:")) continue
    try {
      const value = localStorage.getItem(key)
      if (typeof value !== "string" || value.length < DUAL_WRITE_MAX_CHARS) continue
      localStorage.removeItem(key)
      n++
    } catch {
      /* skip */
    }
  }
  return n
}

/**
 * Pre-prefix keys (`task-storage`, `habits-store`, `timegrid-store`, …) that a
 * `brain2-*` copy replaced. Nothing reads them — `persistKeyAliases` only hands
 * back a bare key for plan text — and on a nearly full origin they were 130KB
 * the live vault could not spend, which is how a 60-character day note stopped
 * fitting. A bare key with no `brain2-*` copy is the only vault and stays.
 */
export function releaseCopiedUnprefixedKeys(): number {
  if (typeof localStorage === "undefined") return 0
  if (isDemoProfile()) return 0
  let n = 0
  const names: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) names.push(key)
    }
  } catch {
    return 0
  }
  for (const key of names) {
    if (persistSuffix(key) != null) continue
    if (UNPREFIXED_KEYS.has(key) || UNSCOPED_KEYS.has(key)) continue
    if (PLAN_TEXT_BARE.test(key)) continue
    try {
      const copy = localStorage.getItem(`${PERSIST_PREFIX}${key}`)
      if (copy == null || copy === "") continue
      localStorage.removeItem(key)
      n++
    } catch {
      /* skip this relic */
    }
  }
  return n
}

export function ensureLegacyPersistCopied(): void {
  if (copiedOnce) return
  copiedOnce = true
  copyLegacyPersistKeys()
  releaseDuplicateLegacyTwins(DUAL_WRITE_MAX_CHARS)
  releaseCopiedUnprefixedKeys()
  releaseFriendPicLocalKeys()
}

/** Test helper. */
export function resetLegacyPersistCopyFlag(): void {
  copiedOnce = false
}
