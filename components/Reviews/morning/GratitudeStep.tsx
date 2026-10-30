/**
 * components/Reviews/morning/GratitudeStep.tsx — Ten gratitude lines.
 *
 * Enter moves to the next line, up to 10, and keeps the text where it was.
 */
import { StringListEditor } from "./StringListEditor"

export function GratitudeStep({
  gratitude,
  setGratitude,
}: {
  gratitude: string[]
  setGratitude: (next: string[]) => void
}) {
  return (
    <>
      <p className="mr-lede">
        10 things you are grateful for today. Enter moves to the next line.{" "}
        <b>{gratitude.filter((g) => g.trim()).length}/10</b>
      </p>
      <StringListEditor values={gratitude} onChange={setGratitude} placeholder="Grateful for…" enterAdvances max={10} />
    </>
  )
}
