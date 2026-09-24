/**
 * lib/ingest/chunk-text.ts — Split long bot replies for Telegram's 4096 cap
 */
export const TELEGRAM_MESSAGE_MAX = 4096
export const TELEGRAM_CHUNK_MAX = 3900

/** Split on newlines (then spaces) so list dumps stay readable. */
export function chunkTelegramText(text: string, max = TELEGRAM_CHUNK_MAX): string[] {
  const source = String(text ?? "")
  if (!source) return []
  if (source.length <= max) return [source]

  const chunks: string[] = []
  let rest = source
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max)
    if (cut < max * 0.45) cut = rest.lastIndexOf(" ", max)
    if (cut < max * 0.45) cut = max
    chunks.push(rest.slice(0, cut).replace(/[ \t]+$/g, ""))
    rest = rest.slice(cut).replace(/^\n+/, "")
  }
  if (rest) chunks.push(rest)
  return chunks.filter((part) => part.length > 0)
}
