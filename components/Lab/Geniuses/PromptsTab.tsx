/**
 * components/Lab/Geniuses/PromptsTab.tsx — Edit the saved prompt templates every genius uses
 *
 * These are the templates, with `{{slots}}`. Saving here changes every later call (lab and, later, the app). The Talk and
 * Council tabs show each call's filled prompt and let you edit it once without saving.
 */
"use client"

import { DEFAULT_PROMPTS, PROMPT_LABELS, promptFor, slotsIn } from "@/lib/geniuses/prompts"
import { useGeniusesStore } from "@/lib/geniuses/store"
import { PROMPT_IDS } from "@/lib/geniuses/types"
import { btn, card, mono } from "./lab-kit"

export function PromptsTab() {
  const prompts = useGeniusesStore((s) => s.prompts)
  const store = useGeniusesStore.getState
  return (
    <div className="space-y-4">
      {PROMPT_IDS.map((id) => {
        const pair = promptFor(id, prompts)
        const changed = !!prompts[id]
        return (
          <section key={id} className={card} aria-label={PROMPT_LABELS[id]}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">{PROMPT_LABELS[id]}</h2>
              <span className="text-xs opacity-60">{changed ? "edited" : "default"}</span>
              <button type="button" className={`${btn} ml-auto`} disabled={!changed} onClick={() => store().resetPrompt(id)}>Reset to default</button>
            </div>
            {(["system", "user"] as const).map((part) => (
              <div key={part} className="space-y-1">
                <p className="text-xs opacity-60">
                  {part === "system" ? "System" : "User"} · slots: {slotsIn(pair[part]).map((s) => `{{${s}}}`).join(" ") || "none"}
                  {pair[part] !== DEFAULT_PROMPTS[id][part] ? " · changed" : ""}
                </p>
                <textarea className={`${mono} ${part === "system" ? "min-h-56" : "min-h-32"}`} value={pair[part]} onChange={(e) => store().setPrompt(id, part, e.target.value)} />
              </div>
            ))}
          </section>
        )
      })}
    </div>
  )
}
