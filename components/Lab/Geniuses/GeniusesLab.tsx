/**
 * components/Lab/Geniuses/GeniusesLab.tsx — Play with the geniuses: talk back, council meetings, prompts, memory
 *
 * Every call that a baby animal friend or a genius makes to a model is here, with its exact prompt. The engine is
 * `lib/geniuses/`; this file only draws it. Writes only the geniuses store (talks, notes, minutes, prompt edits).
 */
"use client"

import { useState } from "react"
import { CouncilTab } from "./CouncilTab"
import { GeniusesTab } from "./GeniusesTab"
import { ModelBar, useModelBar } from "./lab-kit"
import { MemoryTab } from "./MemoryTab"
import { PromptsTab } from "./PromptsTab"
import { TalkTab } from "./TalkTab"

const TABS = [
  { id: "talk", label: "Talk" },
  { id: "council", label: "Council" },
  { id: "geniuses", label: "Geniuses" },
  { id: "prompts", label: "Prompts" },
  { id: "memory", label: "Memory" },
] as const
type TabId = (typeof TABS)[number]["id"]

export function GeniusesLab() {
  const bar = useModelBar()
  const [tab, setTab] = useState<TabId>("talk")
  return (
    <div className="space-y-4 p-4" data-ui-name="Geniuses lab" data-ui-docs="lib/geniuses/README.md">
      <header className="space-y-1 pr-14">
        <h1 className="text-lg font-semibold">GENIUSES</h1>
        <p className="text-sm opacity-70">Baby animal friends with a higher goal, one per area of your life. Argue with one, call a council, edit the exact prompts. Plan: docs/GENIUSES.md.</p>
      </header>
      <ModelBar bar={bar} />
      <nav className="flex flex-wrap gap-1 border-b border-neutral-300 dark:border-neutral-600" aria-label="Lab tabs">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} className={`px-3 py-1.5 text-sm ${tab === t.id ? "border-b-2 border-current font-semibold" : "opacity-70"}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === "talk" ? <TalkTab bar={bar} /> : null}
      {tab === "council" ? <CouncilTab bar={bar} /> : null}
      {tab === "geniuses" ? <GeniusesTab /> : null}
      {tab === "prompts" ? <PromptsTab /> : null}
      {tab === "memory" ? <MemoryTab /> : null}
    </div>
  )
}
