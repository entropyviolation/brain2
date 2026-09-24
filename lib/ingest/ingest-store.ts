/**
 * lib/ingest/ingest-store.ts — Pairing, allowlist, pending clarify, ingest log
 *
 * Poll timestamps (`lastPollAt` / error / source) stay in memory. Persisting
 * them rewrote the hub file every 3s and Fast-Refreshed Tracking.
 *
 * `allowlistRev` bumps on pair and revoke. A seed written before rehydrate
 * (rev 0, no chats) must not replace a paired chat — that race was the bot
 * “randomly” unpairing. `revokedChatIds` are tombstones so a union of two
 * snapshots cannot put a removed chat back.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { mergeIngestAllowlistFields } from "@/lib/vault-guard.js"
import { chatKey } from "./pairing"
import { remapRetiredGroceryExpansion, remapRetiredGroceryShortcuts } from "./shortcut-remap"
import type { IngestChannel, IngestEvent, PendingClarify } from "./types"
import {
  DEFAULT_DISCRETE_EVENT_TRIGGERS,
  type DiscreteTriggerDef,
} from "./text-triggers"

const MAX_EVENTS = 200
const MAX_SEEN_KEYS = 500

export interface PairingState {
  code: string
  expiresAt: number
}

export interface AllowedChat {
  chatId: string
  userId?: string
  username?: string
  pairedAt: string
}

export interface LivePin {
  chatId: string
  messageId: number
  kind: string
  at: string
}

interface IngestState {
  enabled: boolean
  allowGroups: boolean
  pairing: PairingState | null
  allowedChats: AllowedChat[]
  /** Chat ids removed on purpose. A later union must not pair them again. */
  revokedChatIds: string[]
  /** Bumped on pair and revoke. A lower rev is a stale snapshot. */
  allowlistRev: number
  pendingByChat: Record<string, PendingClarify>
  events: IngestEvent[]
  lastPollAt: string | null
  lastPollError: string | null
  lastPollSource: string | null
  /** User aliases: `shop` → `groc`. First token only; letters/digits/_/-. */
  shortcuts: Record<string, string>
  /** Editable discrete-event trigger patterns (smoked weed, ate {item}, …). */
  discreteEventTriggers: DiscreteTriggerDef[]
  /** Recently processed Telegram update/message keys (dedupe). */
  seenIngestKeys: string[]
  /** Optional always-on hub origin, e.g. http://127.0.0.1:8787 */
  phoneHubUrl: string
  livePins: Record<string, LivePin>

  setEnabled: (enabled: boolean) => void
  setAllowGroups: (allow: boolean) => void
  setPairing: (pairing: PairingState | null) => void
  allowChat: (chat: AllowedChat) => void
  revokeChat: (chatId: string) => void
  isAllowed: (chatId: string) => boolean
  setPending: (channel: IngestChannel, chatId: string, pending: PendingClarify | null) => void
  getPending: (channel: IngestChannel, chatId: string) => PendingClarify | undefined
  appendEvent: (event: IngestEvent) => void
  clearEvents: () => void
  setPollStatus: (ok: boolean, source: string, error?: string | null) => void
  setShortcut: (alias: string, expansion: string) => void
  removeShortcut: (alias: string) => void
  setDiscreteEventTriggers: (triggers: DiscreteTriggerDef[]) => void
  upsertDiscreteEventTrigger: (trigger: DiscreteTriggerDef) => void
  removeDiscreteEventTrigger: (id: string) => void
  hasSeenIngestKey: (key: string) => boolean
  rememberIngestKey: (key: string) => void
  setPhoneHubUrl: (url: string) => void
  setLivePin: (kind: string, pin: LivePin | null) => void
}

function newId(): string {
  return `ing-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function makeIngestEventId(): string {
  return newId()
}

export const useIngestStore = create<IngestState>()(
  persist(
    (set, get) => ({
      enabled: true,
      allowGroups: false,
      pairing: null,
      allowedChats: [],
      revokedChatIds: [],
      allowlistRev: 0,
      pendingByChat: {},
      events: [],
      lastPollAt: null,
      lastPollError: null,
      lastPollSource: null,
      shortcuts: {},
      discreteEventTriggers: DEFAULT_DISCRETE_EVENT_TRIGGERS.map((t) => ({ ...t })),
      seenIngestKeys: [],
      phoneHubUrl: "",
      livePins: {},

      setEnabled: (enabled) => set({ enabled }),
      setAllowGroups: (allowGroups) => set({ allowGroups }),
      setPairing: (pairing) => set({ pairing }),
      allowChat: (chat) =>
        set((state) => ({
          allowedChats: [
            ...state.allowedChats.filter((c) => c.chatId !== chat.chatId),
            chat,
          ],
          revokedChatIds: state.revokedChatIds.filter((id) => id !== chat.chatId && id !== chat.userId),
          allowlistRev: state.allowlistRev + 1,
          pairing: null,
        })),
      revokeChat: (chatId) =>
        set((state) => ({
          allowedChats: state.allowedChats.filter((c) => c.chatId !== chatId && c.userId !== chatId),
          revokedChatIds: state.revokedChatIds.includes(chatId)
            ? state.revokedChatIds
            : [...state.revokedChatIds, chatId],
          allowlistRev: state.allowlistRev + 1,
        })),
      isAllowed: (chatId) => {
        const id = String(chatId)
        if (get().revokedChatIds.includes(id)) return false
        return get().allowedChats.some((c) => c.chatId === id || c.userId === id)
      },
      setPending: (channel, chatId, pending) =>
        set((state) => {
          const key = chatKey(channel, chatId)
          const next = { ...state.pendingByChat }
          if (pending) next[key] = pending
          else delete next[key]
          return { pendingByChat: next }
        }),
      getPending: (channel, chatId) => get().pendingByChat[chatKey(channel, chatId)],
      appendEvent: (event) =>
        set((state) => ({
          events: [event, ...state.events].slice(0, MAX_EVENTS),
        })),
      clearEvents: () => set({ events: [] }),
      setPollStatus: (ok, source, error) =>
        set({
          lastPollAt: new Date().toISOString(),
          lastPollError: ok ? null : error || "poll failed",
          lastPollSource: source,
        }),
      setShortcut: (alias, expansion) =>
        set((state) => {
          const key = alias.trim().toLowerCase()
          const value = remapRetiredGroceryExpansion(expansion.trim())
          if (!key) return state
          const shortcuts = { ...state.shortcuts }
          if (!value) delete shortcuts[key]
          else shortcuts[key] = value
          return { shortcuts }
        }),
      removeShortcut: (alias) =>
        set((state) => {
          const shortcuts = { ...state.shortcuts }
          delete shortcuts[alias.trim().toLowerCase()]
          return { shortcuts }
        }),
      setDiscreteEventTriggers: (triggers) =>
        set({
          discreteEventTriggers: triggers
            .map((t) => ({ id: t.id, pattern: t.pattern.trim() }))
            .filter((t) => t.id && t.pattern),
        }),
      upsertDiscreteEventTrigger: (trigger) =>
        set((state) => {
          const pattern = trigger.pattern.trim()
          if (!pattern) return state
          const row = { id: trigger.id || `de-${Date.now().toString(36)}`, pattern }
          const rest = state.discreteEventTriggers.filter((t) => t.id !== row.id)
          return { discreteEventTriggers: [...rest, row] }
        }),
      removeDiscreteEventTrigger: (id) =>
        set((state) => ({
          discreteEventTriggers: state.discreteEventTriggers.filter((t) => t.id !== id),
        })),
      hasSeenIngestKey: (key) => get().seenIngestKeys.includes(key),
      rememberIngestKey: (key) =>
        set((state) => {
          if (state.seenIngestKeys.includes(key)) return state
          const seenIngestKeys = [...state.seenIngestKeys, key]
          return {
            seenIngestKeys:
              seenIngestKeys.length > MAX_SEEN_KEYS
                ? seenIngestKeys.slice(seenIngestKeys.length - MAX_SEEN_KEYS)
                : seenIngestKeys,
          }
        }),
      setPhoneHubUrl: (phoneHubUrl) => set({ phoneHubUrl: phoneHubUrl.trim() }),
      setLivePin: (kind, pin) =>
        set((state) => {
          const livePins = { ...state.livePins }
          if (pin) livePins[kind] = pin
          else delete livePins[kind]
          return { livePins }
        }),
    }),
    {
      name: persistKey("ingest-store"),
      version: 4,
      storage: createCogsJSONStorage(),
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        const triggers = Array.isArray(p.discreteEventTriggers)
          ? (p.discreteEventTriggers as DiscreteTriggerDef[])
          : DEFAULT_DISCRETE_EVENT_TRIGGERS.map((t) => ({ ...t }))
        const rawShortcuts =
          p.shortcuts && typeof p.shortcuts === "object" ? (p.shortcuts as Record<string, string>) : {}
        return {
          ...p,
          shortcuts: remapRetiredGroceryShortcuts(rawShortcuts),
          phoneHubUrl: typeof p.phoneHubUrl === "string" ? p.phoneHubUrl : "",
          livePins: p.livePins && typeof p.livePins === "object" ? p.livePins : {},
          revokedChatIds: Array.isArray(p.revokedChatIds) ? p.revokedChatIds : [],
          allowlistRev: typeof p.allowlistRev === "number" ? p.allowlistRev : 0,
          discreteEventTriggers: triggers.length ? triggers : DEFAULT_DISCRETE_EVENT_TRIGGERS.map((t) => ({ ...t })),
          seenIngestKeys: Array.isArray(p.seenIngestKeys) ? (p.seenIngestKeys as string[]) : [],
        }
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<IngestState>
        const live = current as IngestState
        const allow = mergeIngestAllowlistFields(saved, live) as {
          allowedChats: AllowedChat[]
          revokedChatIds: string[]
          allowlistRev: number
        }
        const shortcuts = remapRetiredGroceryShortcuts(
          (saved.shortcuts && typeof saved.shortcuts === "object" ? saved.shortcuts : live.shortcuts) ?? {},
        )
        return {
          ...live,
          ...saved,
          allowedChats: allow.allowedChats,
          revokedChatIds: allow.revokedChatIds,
          allowlistRev: allow.allowlistRev,
          shortcuts,
          discreteEventTriggers:
            saved.discreteEventTriggers && saved.discreteEventTriggers.length > 0
              ? saved.discreteEventTriggers
              : live.discreteEventTriggers,
          seenIngestKeys: saved.seenIngestKeys ?? live.seenIngestKeys,
        }
      },
      // Poll ticks every 3s. Persisting `lastPollAt` rewrote the hub file on
      // each tick, which made Next Fast Refresh remount Tracking and look like
      // the grid had been wiped. Pairing/allowlist/events still persist.
      partialize: (state) => ({
        enabled: state.enabled,
        allowGroups: state.allowGroups,
        pairing: state.pairing,
        allowedChats: state.allowedChats,
        revokedChatIds: state.revokedChatIds,
        allowlistRev: state.allowlistRev,
        pendingByChat: state.pendingByChat,
        events: state.events,
        shortcuts: state.shortcuts,
        discreteEventTriggers: state.discreteEventTriggers,
        seenIngestKeys: state.seenIngestKeys,
        phoneHubUrl: state.phoneHubUrl,
        livePins: state.livePins,
      }),
    },
  ),
)
