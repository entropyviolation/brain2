/**
 * lib/ingest/chat-queue.ts — One apply at a time per Telegram chat
 *
 * The renderer already chains applies. The hub webhook does not, so two
 * messages for the same chat wait in order. A failure still releases the
 * next message.
 */

export function createChatQueue() {
  const tails = new Map<string, Promise<void>>()

  return function enqueue<T>(chatId: string, job: () => Promise<T>): Promise<T> {
    const prev = tails.get(chatId) ?? Promise.resolve()
    const run = prev.then(job, job)
    tails.set(
      chatId,
      run.then(
        () => undefined,
        () => undefined,
      ),
    )
    return run
  }
}
