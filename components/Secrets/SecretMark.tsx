/**
 * components/Secrets/SecretMark.tsx — "Secret" checkbox for one record
 *
 * Writes straight through `onChange`, so it works beside editors that save on
 * their own schedule. Marked records are left out of search and BIM answers
 * unless secrets are shown (`lib/secrets-store.ts`).
 */
"use client"

export function SecretMark({ checked, onChange, label = "Secret" }: { checked: boolean; onChange: (on: boolean) => void; label?: string }) {
  return (
    <label data-ui-name="SecretMark" className="inline-flex items-center gap-1 text-xs" title="Left out of search and BIM answers unless secrets are unlocked">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
