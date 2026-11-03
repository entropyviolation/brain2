/**
 * lib/secrets.ts — Secret items and the passphrase that unlocks them
 *
 * An item with `secret: true` is hidden from every search and every LLM
 * context unless the person has unlocked secrets and switched them on for that
 * surface. Pure and framework-free. The unlock state lives in
 * `lib/secrets-store.ts`.
 *
 * Hiding is the default at the seam: `searchItems` and the BIM snapshot drop
 * secret items unless the caller passes `includeSecrets: true`, so a new caller
 * is private until it opts in.
 *
 * The passphrase is a gate on the app, not encryption. The text of a secret
 * item still sits in the vault on disk. Only a salted PBKDF2 hash of the
 * passphrase is stored.
 */

/** Anything that may carry the flag. */
export interface MaybeSecret {
  secret?: boolean
}

export function isSecret(item: MaybeSecret | null | undefined): boolean {
  return item?.secret === true
}

/** `items` unchanged when secrets are included, else without the secret ones. */
export function withoutSecrets<T extends MaybeSecret>(items: readonly T[], includeSecrets = false): T[] {
  return includeSecrets ? [...items] : items.filter((item) => !isSecret(item))
}

/** Ids of the secret items, for filtering rows that only know an item by id. */
export function secretIds(items: readonly (MaybeSecret & { id: string })[]): Set<string> {
  return new Set(items.filter(isSecret).map((item) => item.id))
}

export interface PassphraseRecord {
  /** base64 salt */
  salt: string
  /** base64 PBKDF2-SHA256 hash */
  hash: string
  iterations: number
}

export const PBKDF2_ITERATIONS = 210_000
export const MIN_PASSPHRASE_LENGTH = 4

function toBase64(bytes: Uint8Array): string {
  let s = ""
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(text: string): Uint8Array {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

async function derive(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveBits"])
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

export async function createPassphraseRecord(passphrase: string): Promise<PassphraseRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(passphrase, salt, PBKDF2_ITERATIONS)
  return { salt: toBase64(salt), hash: toBase64(hash), iterations: PBKDF2_ITERATIONS }
}

export async function verifyPassphrase(passphrase: string, record: PassphraseRecord): Promise<boolean> {
  const got = await derive(passphrase, fromBase64(record.salt), record.iterations)
  const want = fromBase64(record.hash)
  if (got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i]
  return diff === 0
}
