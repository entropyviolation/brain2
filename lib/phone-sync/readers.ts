/**
 * lib/phone-sync/readers.ts — The readers the hub runs
 *
 * Node only. Each Wave 1 agent adds one line here for its reader and touches
 * nothing else in this file. A reader that cannot run on this machine (not a
 * Mac, no Full Disk Access) throws from `read`; the run log shows why.
 */
import type { PhoneReader } from "./runner"

export async function loadPhoneReaders(): Promise<PhoneReader[]> {
  const readers: PhoneReader[] = []
  // Wave 1: texts  → readers.push((await import("./messages-reader")).messagesReader)
  // Wave 1: calls  → readers.push((await import("./calls-reader")).callsReader)
  return readers
}
