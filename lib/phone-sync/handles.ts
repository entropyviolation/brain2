/**
 * lib/phone-sync/handles.ts — One spelling per phone number or email
 *
 * Messages writes "+15551234567", call history "(555) 123-4567", Contacts
 * "555.123.4567". All three must land on one person. Pure.
 */

/** Country code added to a bare 10-digit number. */
export const DEFAULT_COUNTRY_CODE = "1"

export function isEmailHandle(handle: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(handle.trim())
}

/**
 * Emails lowercase. Phone numbers become +<digits>: a bare 10-digit number gets
 * the default country code, an 11-digit one starting with it gets the plus.
 * Short codes and app handles come back trimmed and lowercased.
 */
export function normalizeHandle(handle: string, countryCode = DEFAULT_COUNTRY_CODE): string {
  const raw = String(handle ?? "").trim()
  if (!raw) return ""
  if (isEmailHandle(raw)) return raw.toLowerCase()
  if (!/^[+\d\s().\-]+$/.test(raw)) return raw.toLowerCase()
  const digits = raw.replace(/\D/g, "")
  if (!digits) return raw.toLowerCase()
  if (raw.startsWith("+")) return `+${digits}`
  if (digits.startsWith("00") && digits.length > 6) return `+${digits.slice(2)}`
  if (digits.length === 10) return `+${countryCode}${digits}`
  if (digits.length === 11 && digits.startsWith(countryCode)) return `+${digits}`
  // Short codes (5–6 digits) and odd lengths stay digits only.
  return digits
}

/** A readable label for an unknown number: +1 (555) 123-4567. */
export function formatHandle(handle: string): string {
  const n = normalizeHandle(handle)
  const us = n.match(/^\+1(\d{3})(\d{3})(\d{4})$/)
  if (us) return `+1 (${us[1]}) ${us[2]}-${us[3]}`
  return n || handle
}
