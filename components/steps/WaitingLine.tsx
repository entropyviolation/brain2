/**
 * components/steps/WaitingLine.tsx — "Everything else is waiting, not forgotten." (UI-5)
 *
 * One calm line that closes a list or a step tree whenever a view switch
 * (Hide locked, Show next only, the sun rule) hides something. The count is a
 * button that peeks at the hidden rows without turning the switch off. With
 * nothing hidden the line is absent.
 */
"use client"

export function WaitingLine({
  hidden,
  peeking,
  onPeek,
}: {
  hidden: number
  peeking: boolean
  onPeek: () => void
}) {
  if (hidden <= 0) return null
  return (
    <p className="step-waiting-line">
      Everything else is waiting, not forgotten.
      {" · "}
      <button
        type="button"
        data-no95
        className="step-waiting-peek"
        aria-pressed={peeking}
        title={peeking ? "Hide them again" : "Peek at them; the switch stays on"}
        onClick={onPeek}
      >
        {hidden} hidden
      </button>
    </p>
  )
}
