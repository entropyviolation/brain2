/**
 * components/Reviews/morning/CircumstancesStep.tsx — Three circumstance rows.
 *
 * Must-not, new events, and excited. The must-do flag stays on the draft and
 * is not a row here; required tasks are asked on the to-do step.
 */
import type { Dispatch, SetStateAction } from "react"
import { Textarea } from "@/components/ui/textarea"
import type { MorningDraft } from "./types"

export function CircumstancesStep({
  circumstance,
  setCircumstance,
  mustNotDo,
  setMustNotDo,
  newEvents,
  setNewEvents,
  excitedAbout,
  setExcitedAbout,
}: {
  circumstance: MorningDraft["circumstance"]
  setCircumstance: Dispatch<SetStateAction<MorningDraft["circumstance"]>>
  mustNotDo: string
  setMustNotDo: Dispatch<SetStateAction<string>>
  newEvents: string
  setNewEvents: Dispatch<SetStateAction<string>>
  excitedAbout: string
  setExcitedAbout: Dispatch<SetStateAction<string>>
}) {
  return (
    <>
      <p className="mr-lede">Check what applies, then fill in.</p>
      {(
        [
          ["mustNotDo", "Something I absolutely must not do", mustNotDo, setMustNotDo],
          ["newEvents", "New events scheduled today", newEvents, setNewEvents],
          ["excited", "Something I'm excited about", excitedAbout, setExcitedAbout],
        ] as const
      ).map(([key, label, value, setter]) => (
        <div key={key} className="space-y-1.5 rounded-md border bg-white/70 p-2.5">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={circumstance[key]}
              onChange={(e) => setCircumstance((c) => ({ ...c, [key]: e.target.checked }))}
            />
            {label}
          </label>
          {circumstance[key] && <Textarea value={value} onChange={(e) => setter(e.target.value)} rows={2} autoFocus />}
        </div>
      ))}
    </>
  )
}
