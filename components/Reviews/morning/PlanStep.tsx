/**
 * components/Reviews/morning/PlanStep.tsx — Day plan step.
 *
 * The textarea is the plan text. Saving appends it; this step only edits it.
 */
import { Textarea } from "@/components/ui/textarea"

export function PlanStep({
  dayPlan,
  setDayPlan,
}: {
  dayPlan: string
  setDayPlan: (value: string) => void
}) {
  return (
    <>
      <p className="mr-lede">Appends today&apos;s Plan log on the Plan tab (same as submitting there). Leave blank to skip.</p>
      <Textarea value={dayPlan} onChange={(e) => setDayPlan(e.target.value)} rows={8} placeholder="Write the day plan…" />
    </>
  )
}
