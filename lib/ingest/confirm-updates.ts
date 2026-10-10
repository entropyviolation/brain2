/**
 * lib/ingest/confirm-updates.ts — How far a Telegram poll offset may move
 *
 * getUpdates treats an update as confirmed once a later call passes a higher
 * offset. Advance only through a prefix of update ids whose vault write
 * finished. A hole stays unconfirmed so Telegram retries that update.
 */

export function advanceConfirmedOffset(
  startOffset: number,
  orderedUpdateIds: readonly number[],
  confirmed: ReadonlySet<number>,
): number {
  let offset = startOffset
  for (const id of orderedUpdateIds) {
    if (!confirmed.has(id)) break
    offset = Math.max(offset, id + 1)
  }
  return offset
}
