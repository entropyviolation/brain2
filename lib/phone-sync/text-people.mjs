/**
 * lib/phone-sync/text-people.mjs — Who you text back and forth with, from the synced texts
 *
 * Counts only. Reads `MessageRecord` lines from `data/phone-sync/messages.jsonl` and keeps, per
 * one-to-one handle, how many texts came in and went out since `since`, and the last one. Group
 * chats are left out. No message text leaves this file. `/api/phone-text-people` serves it, and the
 * Texts People BIMBY (`lib/texts-people-bimby.ts`) turns the rows into People I Know items.
 */
import { normalizeHandleMjs } from "./contact-names.mjs"

/**
 * @param {Iterable<any>} records parsed archive lines
 * @param {number} since epoch ms; older texts are skipped
 * @returns {{ handle: string, inbound: number, outbound: number, last: number }[]} two-way handles only, most texts first
 */
export function tallyTextPeople(records, since) {
  /** @type {Map<string, { handle: string, inbound: number, outbound: number, last: number }>} */
  const by = new Map()
  for (const r of records) {
    if (!r || r.type !== "message" || typeof r.at !== "number" || r.at < since) continue
    if (Array.isArray(r.members) && r.members.length) continue
    const handle = normalizeHandleMjs(r.party?.handle)
    if (!handle) continue
    const row = by.get(handle) ?? { handle, inbound: 0, outbound: 0, last: 0 }
    if (r.direction === "out") row.outbound += 1
    else if (r.direction === "in") row.inbound += 1
    else continue
    row.last = Math.max(row.last, r.at)
    by.set(handle, row)
  }
  return [...by.values()]
    .filter((row) => row.inbound > 0 && row.outbound > 0)
    .sort((a, b) => b.inbound + b.outbound - (a.inbound + a.outbound))
}
