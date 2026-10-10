/**
 * lib/crt-number.ts — Integer / 1-decimal CRT readouts
 *
 * Prefer whole numbers; otherwise one decimal. Avoids float trails like
 * `1960.0000000000002` on Points and Goals glass.
 */
export function formatCrtNumber(value: number): string {
  if (!Number.isFinite(value)) return "—"
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
