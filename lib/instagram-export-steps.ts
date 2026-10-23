/**
 * lib/instagram-export-steps.ts — Where and how to request an Instagram export
 *
 * Meta has no scheduled or recurring export and no API that returns this
 * data for a personal account (checked 2026-10-23,
 * `docs/INSTAGRAM_AUTO_UPDATE.md`). Each export is one request in Accounts
 * Center. These strings are the one copy of that link and those steps, for
 * the monthly reminder, the Instagram view's empty state, and Settings.
 *
 * No imports, so `lib/reminders.ts` can read the link without a cycle.
 */

export const INSTAGRAM_EXPORT_URL = "https://accountscenter.instagram.com/info_and_permissions/dyi/"

export const INSTAGRAM_EXPORT_REMINDER_ID = "reminder-instagram-export"
export const INSTAGRAM_EXPORT_REMINDER_NAME = "Request a new Instagram export"

/**
 * The export settings the report needs. A date-range export leaves whole
 * sections empty, and HTML exports are not read.
 */
export const INSTAGRAM_EXPORT_STEPS: readonly string[] = [
  "Open Accounts Center → Your information and permissions → Download your information.",
  "Choose Create export → your Instagram account → Export to device.",
  "Set Format to JSON, Date range to All time, and Customize information to all info.",
  "Meta sends an email or notification when the file is ready. The download link works for 4 days.",
  "Download the zip. Brain2 picks it up from Downloads and rebuilds the report.",
]

/** One block for a reminder's description: link, then the steps. */
export function instagramExportStepsText(): string {
  return [INSTAGRAM_EXPORT_URL, "", ...INSTAGRAM_EXPORT_STEPS.map((step, i) => `${i + 1}. ${step}`)].join("\n")
}
