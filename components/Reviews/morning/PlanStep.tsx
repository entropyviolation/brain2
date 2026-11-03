/**
 * components/Reviews/morning/PlanStep.tsx — Day plan step.
 *
 * The textarea is the plan text. Saving appends it; this step only edits it.
 */
import { Textarea } from "@/components/ui/textarea"
import { PlanLogGlimpse } from "@/components/Reviews/PlanLogGlimpse"

export function PlanStep({
  dayKey,
  dayPlan,
  setDayPlan,
}: {
  dayKey: string
  dayPlan: string
  setDayPlan: (value: string) => void
}) {
  return (
    <>
      <p className="mr-lede">Added to Plan → Day Plan as MORNING PLAN when you save (same log as submitting there; it appends, it does not replace). Leave blank to skip.</p>
      <Textarea value={dayPlan} onChange={(e) => setDayPlan(e.target.value)} rows={8} placeholder="Write the day plan…" />
      <PlanLogGlimpse period="day" periodKey={dayKey} heading="Plan tab · Day Plan" />
    </>
  )
}
