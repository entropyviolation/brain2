/**
 * lib/commands-bimby/store.ts — The commands you asked BIM to remember
 *
 * In the vault (`brain2-commands`), so the phone, the Mac and the `bim` CLI (`scripts/bim.mjs`, which reads the hub's
 * copy) hold the same list. Forgetting writes a `gone` row instead of deleting, so a shipped command stays hidden too.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { registerPhoneWindowStore } from "@/lib/phone-window"
import { persistKey } from "@/lib/storage-keys"
import { mergeCommands, SEED_COMMANDS, type SavedCommand } from "./commands.mjs"

export const COMMANDS_STORAGE_KEY = persistKey("commands")

function clean(raw: unknown): SavedCommand | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Partial<SavedCommand>
  if (typeof r.id !== "string" || !r.id) return null
  if (r.gone) return { id: r.id, name: String(r.name ?? r.id), command: "", gone: true, ...(r.at ? { at: String(r.at) } : {}) }
  const command = String(r.command ?? "")
  if (!command.trim()) return null
  return {
    id: r.id,
    name: String(r.name ?? r.id).trim() || r.id,
    command,
    ...(r.does ? { does: String(r.does) } : {}),
    ...(Array.isArray(r.words) ? { words: r.words.filter((w): w is string => typeof w === "string") } : {}),
    at: String(r.at ?? new Date().toISOString()),
    source: "you",
  }
}

interface CommandsState {
  saved: SavedCommand[]
  /** Keep a command, replacing one with the same id. */
  save: (c: Omit<SavedCommand, "at" | "source">, now?: Date) => SavedCommand
  forget: (id: string, now?: Date) => void
}

export const useCommandsStore = create<CommandsState>()(
  persist(
    (set, get) => ({
      saved: [],
      save: (c, now = new Date()) => {
        const row: SavedCommand = { ...c, at: now.toISOString(), source: "you" }
        set({ saved: [...get().saved.filter((s) => s.id !== c.id), row] })
        return row
      },
      forget: (id, now = new Date()) => {
        const was = get().saved.find((s) => s.id === id)
        set({ saved: [...get().saved.filter((s) => s.id !== id), { id, name: was?.name ?? id, command: "", gone: true, at: now.toISOString() }] })
      },
    }),
    {
      name: COMMANDS_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (s) => ({ saved: s.saved }),
      merge: (persisted, current) => {
        const rows = (persisted as { saved?: unknown } | null | undefined)?.saved
        return { ...current, saved: Array.isArray(rows) ? rows.map(clean).filter((c): c is SavedCommand => c !== null) : [] }
      },
    },
  ),
)

registerPhoneWindowStore(useCommandsStore)

/** Every command BIM knows now: the shipped ones and yours. */
export function knownCommands(): SavedCommand[] {
  return mergeCommands(SEED_COMMANDS, useCommandsStore.getState().saved)
}
