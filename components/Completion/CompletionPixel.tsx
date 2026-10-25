/**
 * Phosphor pixel star for the completion caption. Decorative.
 * A few sparks blink in steps; reduced motion holds one spark still.
 */
const STAR: Array<[number, number]> = [
  [7, 1],
  [6, 2], [7, 2], [8, 2],
  [5, 3], [6, 3], [7, 3], [8, 3], [9, 3],
  [4, 4], [5, 4], [7, 4], [9, 4], [10, 4],
  [5, 5], [6, 5], [8, 5], [9, 5],
  [6, 6], [7, 6], [8, 6],
  [7, 7],
]

const SPARK: Array<[number, number, string]> = [
  [2, 1, "a"],
  [13, 2, "b"],
  [1, 6, "c"],
  [13, 7, "d"],
  [7, 12, "a"],
]

export function CompletionPixel() {
  return (
    <span className="completion-pixel" aria-hidden="true">
      <svg viewBox="0 0 16 16" width="22" height="22" shapeRendering="crispEdges">
        {STAR.map(([x, y]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" className="completion-pixel-ink" />
        ))}
        <rect x="6" y="3" width="1" height="1" className="completion-pixel-hot" />
        {SPARK.map(([x, y, frame]) => (
          <rect key={`t-${x}-${y}`} x={x} y={y} width="1" height="1" className={`completion-pixel-spark is-${frame}`} />
        ))}
      </svg>
    </span>
  )
}
