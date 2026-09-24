/**
 * components/Home/Habits/exemption-wand-button.tsx — Exemption wand
 *
 * A small wand on the Habits control panel. Press it and the sheet becomes
 * yes/no lamps for “this period is not required.” An exempt lamp is grey,
 * not a completion light. Press the crossed wand to log habits again. The
 * control stays metal either way.
 */
"use client"

export function ExemptionWandButton({
  on,
  onToggle,
}: {
  on: boolean
  onToggle: (on: boolean) => void
}) {
  return (
    <button
      type="button"
      className={`hab-wand${on ? " is-on" : ""}`}
      aria-pressed={on}
      data-ui-name="Exemption wand"
      data-ui-help="Waive a period that does not apply, without marking the habit done."
      data-ui-docs="components/Home/Habits/README.md"
      aria-label={on ? "Exemption wand on" : "Exemption wand"}
      title={
        on
          ? "Exemption wand is on. Each lamp waives that period. Click the crossed wand to log habits again."
          : "Exemption wand. Turn it on to waive periods that do not apply, without marking them done."
      }
      onClick={() => onToggle(!on)}
    >
      <WandMark crossed={on} />
      <span>Exemption wand</span>
    </button>
  )
}

function WandMark({ crossed }: { crossed: boolean }) {
  return (
    <svg className="hab-wand-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14.2 3.2c.4-.8 1.6-.8 2 0l.7 1.4 1.5.3c.9.2 1.2 1.3.6 1.9l-1.1 1 .3 1.5c.2.9-.7 1.6-1.5 1.2l-1.3-.7-1.3.7c-.8.4-1.7-.3-1.5-1.2l.3-1.5-1.1-1c-.6-.6-.3-1.7.6-1.9l1.5-.3.7-1.4z"
        fill="currentColor"
      />
      <path d="M13.2 9.6 4.2 20.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M3.4 20.8h2.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      {crossed ? (
        <path className="hab-wand-slash" d="M4 5.2 20 19.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : null}
    </svg>
  )
}
