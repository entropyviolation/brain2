/**
 * lib/instagram-export-steps.ts — Where and how to request an Instagram export
 *
 * There is no API that returns this data for a personal account. A device
 * export is one request in Accounts Center. Accounts Center can also repeat
 * an export to Google Drive or Dropbox on a schedule; that route is in
 * `docs/INSTAGRAM_AUTO_UPDATE.md` and is not tested yet (checked 2026-10-23).
 * These strings are the one copy of the link and the device-export steps,
 * for the monthly reminder and the Instagram view.
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
  "Create export → Export to device. Pick All time, JSON, and all information.",
  "When Meta emails that it is ready (it can take days), download the zip within 4 days into Downloads.",
  "Brain2 desktop picks it up from Downloads, copies it into its own data folder, and builds the report.",
]

/** One block for a reminder's description: link, then the steps. */
export function instagramExportStepsText(): string {
  return [INSTAGRAM_EXPORT_URL, "", ...INSTAGRAM_EXPORT_STEPS.map((step, i) => `${i + 1}. ${step}`)].join("\n")
}
