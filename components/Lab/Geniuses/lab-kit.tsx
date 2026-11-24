/**
 * components/Lab/Geniuses/lab-kit.tsx — Shared pieces of the geniuses lab: the model bar, the vault read, the prompt box
 *
 * Reads the real stores (items, habits, goals, friend personalities). Writes only the geniuses store.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { chatCrew } from "@/lib/bim-flow/chat-models"
import { listOllamaModels, ollamaCall } from "@/lib/bim-flow/ollama"
import { useBabyAnimalsStore } from "@/lib/baby-animals-store"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import type { PromptPair } from "@/lib/geniuses/prompts"
import type { AreaVault } from "@/lib/geniuses/read"
import { geniusContext, type GeniusContext, type ModelRun, type Sent } from "@/lib/geniuses/run"
import { useGeniusesStore } from "@/lib/geniuses/store"
import type { Genius } from "@/lib/geniuses/types"

export const btn = "min-h-9 rounded border border-neutral-400 px-3 py-1 text-sm hover:bg-neutral-100 disabled:opacity-40 dark:border-neutral-600 dark:hover:bg-neutral-800"
export const field = "w-full rounded border border-neutral-300 bg-transparent p-2 text-sm dark:border-neutral-600"
export const mono = "w-full rounded border border-neutral-300 bg-transparent p-2 font-mono text-xs leading-relaxed dark:border-neutral-600"
export const card = "space-y-2 rounded border border-neutral-300 p-3 dark:border-neutral-600"

export type ModelSettings = { off: boolean; model: string; temperature: number; fresh: boolean }

/** Installed models, the crew's main model as the default pick. */
export function useModelBar() {
  const [installed, setInstalled] = useState<string[] | null>(null)
  const [settings, setSettings] = useState<ModelSettings>({ off: false, model: "", temperature: 0.4, fresh: true })
  useEffect(() => {
    let live = true
    void (async () => {
      const crew = await chatCrew().catch(() => null)
      const names = await listOllamaModels()
      if (!live) return
      setInstalled(names)
      setSettings((s) => (s.model ? s : { ...s, model: crew?.main ?? names?.[0] ?? "" }))
    })()
    return () => {
      live = false
    }
  }, [])
  const run: ModelRun = useMemo(
    () => (settings.off || !settings.model ? { call: null, ladder: [] } : { call: ollamaCall(settings.model, undefined, { fresh: settings.fresh }), ladder: [settings.model], temperature: settings.temperature }),
    [settings],
  )
  return { installed, settings, setSettings, run }
}

export function ModelBar({ bar }: { bar: ReturnType<typeof useModelBar> }) {
  const { installed, settings, setSettings } = bar
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm" aria-label="Model">
      <label className="flex items-center gap-1">
        Model
        <select className="rounded border border-neutral-300 bg-transparent p-1 dark:border-neutral-600" value={settings.model} disabled={settings.off || !installed?.length} onChange={(e) => setSettings({ ...settings, model: e.target.value })}>
          {(installed ?? []).map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1">
        Temperature
        <input type="number" min={0} max={1.5} step={0.1} className="w-16 rounded border border-neutral-300 bg-transparent p-1 dark:border-neutral-600" value={settings.temperature} onChange={(e) => setSettings({ ...settings, temperature: Number(e.target.value) || 0 })} />
      </label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={settings.fresh} onChange={(e) => setSettings({ ...settings, fresh: e.target.checked })} /> Fresh (no cache)</label>
      <label className="flex items-center gap-1"><input type="checkbox" checked={settings.off} onChange={(e) => setSettings({ ...settings, off: e.target.checked })} /> Script only</label>
      <span className="opacity-60">{installed === null ? "Looking for Ollama…" : installed.length ? `${installed.length} models` : "Ollama is not answering: script only"}</span>
    </div>
  )
}

/** The live vault a genius reads. */
export function useAreaVault(): AreaVault {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const habits = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const goals = useGoalsStore((s) => s.goals)
  const objectives = useGoalsStore((s) => s.objectives)
  return useMemo(() => ({ tasks, lists, habits, weeklyData, habitExemptions, goals, objectives }), [tasks, lists, habits, weeklyData, habitExemptions, goals, objectives])
}

export function useGeniusNames(): Record<string, string> {
  const geniuses = useGeniusesStore((s) => s.geniuses)
  return useMemo(() => Object.fromEntries(geniuses.map((g) => [g.id, g.name])), [geniuses])
}

/** A function that builds a genius's context (area read + memory) from the live stores. */
export function useContextFor(): (g: Genius, exceptTalkId?: string) => GeniusContext {
  const vault = useAreaVault()
  const personalities = useBabyAnimalsStore((s) => s.personalities)
  const photos = useBabyAnimalsStore((s) => s.photos)
  const talks = useGeniusesStore((s) => s.talks)
  const meetings = useGeniusesStore((s) => s.meetings)
  const names = useGeniusNames()
  return useMemo(
    () => (genius: Genius, exceptTalkId?: string) =>
      geniusContext({ genius, vault: { ...vault, now: new Date() }, personalities, talks, meetings, names, exceptTalkId, faceName: photos.find((p) => p.animalId === genius.animalId)?.displayName }),
    [vault, personalities, talks, meetings, names, photos],
  )
}

/**
 * The exact system and user text for one call, editable. It follows `built` until you type in it; "Rebuild" drops your
 * edits and follows again.
 */
export function usePromptDraft(built: PromptPair) {
  const [draft, setDraft] = useState<PromptPair | null>(null)
  return { prompt: draft ?? built, edited: draft !== null, edit: (part: keyof PromptPair, text: string) => setDraft({ ...(draft ?? built), [part]: text }), rebuild: () => setDraft(null) }
}

export function PromptBox({ draft, label = "Exact prompt", open: startOpen = false }: { draft: ReturnType<typeof usePromptDraft>; label?: string; open?: boolean }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-xs">
        <button type="button" className="underline" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"} {label.toLowerCase()}</button>
        {draft.edited ? (
          <>
            <span className="opacity-70">edited by hand</span>
            <button type="button" className="underline" onClick={draft.rebuild}>Rebuild</button>
          </>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-1">
          <p className="text-xs opacity-60">System</p>
          <textarea className={`${mono} min-h-40`} value={draft.prompt.system} onChange={(e) => draft.edit("system", e.target.value)} />
          <p className="text-xs opacity-60">User</p>
          <textarea className={`${mono} min-h-32`} value={draft.prompt.user} onChange={(e) => draft.edit("user", e.target.value)} />
        </div>
      ) : null}
    </div>
  )
}

/** What came back: by whom, why the script answered, the hops, the raw JSON. */
export function SentMeta({ sent }: { sent: Sent<unknown> }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="text-xs opacity-70">
      <span>{sent.by === "model" ? "model" : `script${sent.why ? ` (${sent.why})` : ""}`}</span>
      {sent.hops.length ? <span> · {sent.hops.map((h) => `${h.model} ${h.ms} ms${h.why ? ` (${h.why})` : ""}`).join(" → ")}</span> : null}
      {sent.raw !== undefined || sent.system ? (
        <>
          {" "}
          <button type="button" className="underline" onClick={() => setOpen(!open)}>{open ? "hide" : "raw"}</button>
          {open ? (
            <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded bg-neutral-100 p-2 dark:bg-neutral-800">
              {`SYSTEM\n${sent.system}\n\nUSER\n${sent.user}\n\nRAW\n${JSON.stringify(sent.raw, null, 2) ?? "(no model call)"}`}
            </pre>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function GeniusSelect({ value, onChange, activeOnly = false }: { value: string; onChange: (id: string) => void; activeOnly?: boolean }) {
  const geniuses = useGeniusesStore((s) => s.geniuses)
  const rows = activeOnly ? geniuses.filter((g) => g.status === "active") : geniuses
  return (
    <select className="rounded border border-neutral-300 bg-transparent p-1 text-sm dark:border-neutral-600" value={value} onChange={(e) => onChange(e.target.value)}>
      {rows.map((g) => (
        <option key={g.id} value={g.id}>{g.name} · {g.area}{g.status !== "active" ? ` (${g.status})` : ""}</option>
      ))}
    </select>
  )
}
