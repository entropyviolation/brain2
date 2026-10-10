/** `~` plus the dashed est. treatment. An estimate is not shown as an observed fact. */
export function EstMark({
  children,
  estimated,
}: {
  children: string
  estimated: boolean
}) {
  if (!estimated) return <span>{children}</span>
  return <span className="trk-est htk-est">~ {children}</span>
}

/** Compact exact / est. key. The box hugs the checkbox and the word. */
export function ExactClock({
  estimated,
  onEstimated,
  label = "Clock is estimated",
}: {
  estimated: boolean
  onEstimated: (next: boolean) => void
  label?: string
}) {
  return (
    <label className="htk-exact">
      <input
        type="checkbox"
        checked={estimated}
        aria-label={label}
        onChange={(event) => onEstimated(event.target.checked)}
      />
      <span className="htk-exact-word">{estimated ? <EstMark estimated>est.</EstMark> : "Exact"}</span>
    </label>
  )
}
