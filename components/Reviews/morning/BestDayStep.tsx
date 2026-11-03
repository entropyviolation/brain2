/**
 * components/Reviews/morning/BestDayStep.tsx — Best day ever step.
 */
import { Textarea } from "@/components/ui/textarea"

export function BestDayStep({
  bestDayWhy,
  setBestDayWhy,
}: {
  bestDayWhy: string
  setBestDayWhy: (value: string) => void
}) {
  return (
    <>
      <p className="mr-lede">Why is today going to be the best day ever?</p>
      <Textarea value={bestDayWhy} onChange={(e) => setBestDayWhy(e.target.value)} rows={5} aria-label="Why is today going to be the best day ever?" />
    </>
  )
}
