/**
 * lib/rules/rules-store.ts — The list of standing rules (`brain2-rules`)
 *
 * On this device. The first run copies the old single text-mirror rule
 * (`brain2-text-mirror`) into the list so Allietext keeps working.
 */
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import type { Rule, RuleDraft } from "./rule-types"

const SEEN_CAP = 2000
const LEGACY_KEY = "brain2-text-mirror"

function newId(): string {
  return `rule-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export interface RulesState {
  rules: Rule[]
  add: (draft: RuleDraft) => Rule
  update: (id: string, patch: Partial<Pick<Rule, "name" | "on" | "trigger" | "sink">>) => void
  remove: (id: string) => void
  remember: (id: string, hash: string) => void
  forget: (id: string, hash: string) => void
}

export const useRulesStore = create<RulesState>()(
  persist(
    (set, get) => ({
      rules: [],
      add: (draft) => {
        const rule: Rule = {
          id: newId(),
          name: draft.name,
          on: draft.on ?? true,
          trigger: draft.trigger,
          sink: draft.sink,
          createdAt: new Date().toISOString(),
          seen: [],
        }
        set({ rules: [...get().rules, rule] })
        return rule
      },
      update: (id, patch) => set({ rules: get().rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }),
      remove: (id) => set({ rules: get().rules.filter((r) => r.id !== id) }),
      remember: (id, hash) =>
        set({ rules: get().rules.map((r) => (r.id === id ? { ...r, seen: [...r.seen, hash].slice(-SEEN_CAP) } : r)) }),
      forget: (id, hash) =>
        set({ rules: get().rules.map((r) => (r.id === id ? { ...r, seen: r.seen.filter((h) => h !== hash) } : r)) }),
    }),
    {
      name: "brain2-rules",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (!state || state.rules.length) return
        try {
          const raw = localStorage.getItem(LEGACY_KEY)
          const old = raw ? (JSON.parse(raw) as { state?: { enabled?: boolean; docId?: string; title?: string; overWords?: number; seen?: string[] } }).state : null
          if (!old?.title) return
          const rule = state.add({
            name: `Add typed text to ${old.title}`,
            on: !!old.enabled,
            trigger: { kind: "typed-text", overWords: old.overWords ?? 70 },
            sink: { kind: "doc-append", docId: old.docId ?? "", title: old.title },
          })
          useRulesStore.setState({ rules: useRulesStore.getState().rules.map((r) => (r.id === rule.id ? { ...r, seen: old.seen ?? [] } : r)) })
          localStorage.removeItem(LEGACY_KEY)
        } catch {
          /* no legacy rule to carry over */
        }
      },
    },
  ),
)
