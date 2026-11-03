/**
 * lib/secrets-store.ts — Is "include secrets" on, and is it unlocked
 *
 * `lib/secrets.ts` hides secret items. This store decides when they come back.
 * Secrets show on a surface (`search` or `chat`) only when the person has
 * unlocked with the passphrase AND switched that surface on. Both are memory
 * only, so a reload locks again, and unlocking re-locks after `IDLE_LOCK_MS`.
 * The passphrase record (salt + hash) is the one thing kept, in plain
 * `localStorage` under `brain2-secrets-lock`, outside the vault so a backup or
 * sync never carries it.
 */
"use client"

import { create } from "zustand"
import { createPassphraseRecord, MIN_PASSPHRASE_LENGTH, verifyPassphrase, type PassphraseRecord } from "@/lib/secrets"

export const SECRETS_LOCK_KEY = "brain2-secrets-lock"
export const IDLE_LOCK_MS = 10 * 60 * 1000

/** Where secrets can be shown. Each is its own switch. */
export type SecretsSurface = "search" | "chat"

function readRecord(): PassphraseRecord | null {
  try {
    const raw = localStorage.getItem(SECRETS_LOCK_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as Partial<PassphraseRecord>
    return value.salt && value.hash && value.iterations ? (value as PassphraseRecord) : null
  } catch {
    return null
  }
}

function writeRecord(record: PassphraseRecord | null): void {
  try {
    if (record) localStorage.setItem(SECRETS_LOCK_KEY, JSON.stringify(record))
    else localStorage.removeItem(SECRETS_LOCK_KEY)
  } catch {
    /* storage unavailable: the passphrase just is not kept */
  }
}

interface SecretsState {
  record: PassphraseRecord | null
  unlocked: boolean
  include: Record<SecretsSurface, boolean>
  /** First passphrase. Refused when one exists or it is too short. */
  setPassphrase: (passphrase: string) => Promise<boolean>
  /** Change it. Needs the current one. */
  changePassphrase: (current: string, next: string) => Promise<boolean>
  /** Remove the passphrase. Needs the current one; secrets then stay hidden. */
  clearPassphrase: (current: string) => Promise<boolean>
  unlock: (passphrase: string) => Promise<boolean>
  lock: () => void
  /** Turn secrets on or off for a surface. Turning on needs to be unlocked. */
  setInclude: (surface: SecretsSurface, on: boolean) => boolean
}

const OFF: Record<SecretsSurface, boolean> = { search: false, chat: false }
let idleTimer: ReturnType<typeof setTimeout> | null = null

export const useSecretsStore = create<SecretsState>((set, get) => {
  const arm = () => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => get().lock(), IDLE_LOCK_MS)
  }
  return {
    record: readRecord(),
    unlocked: false,
    include: { ...OFF },

    async setPassphrase(passphrase) {
      if (get().record || passphrase.length < MIN_PASSPHRASE_LENGTH) return false
      const record = await createPassphraseRecord(passphrase)
      writeRecord(record)
      set({ record, unlocked: true })
      arm()
      return true
    },

    async changePassphrase(current, next) {
      const { record } = get()
      if (!record || next.length < MIN_PASSPHRASE_LENGTH || !(await verifyPassphrase(current, record))) return false
      const fresh = await createPassphraseRecord(next)
      writeRecord(fresh)
      set({ record: fresh })
      return true
    },

    async clearPassphrase(current) {
      const { record } = get()
      if (!record || !(await verifyPassphrase(current, record))) return false
      writeRecord(null)
      get().lock()
      set({ record: null })
      return true
    },

    async unlock(passphrase) {
      const { record } = get()
      if (!record || !(await verifyPassphrase(passphrase, record))) return false
      set({ unlocked: true })
      arm()
      return true
    },

    lock() {
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = null
      set({ unlocked: false, include: { ...OFF } })
    },

    setInclude(surface, on) {
      if (on && !get().unlocked) return false
      set({ include: { ...get().include, [surface]: on } })
      if (on) arm()
      return true
    },
  }
})

/** The one question every surface asks before it keeps secret items. */
export function secretsShown(surface: SecretsSurface): boolean {
  const { unlocked, include } = useSecretsStore.getState()
  return unlocked && include[surface]
}
