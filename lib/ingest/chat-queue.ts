/**
 * lib/ingest/chat-queue.ts — One job at a time per chat, in order
 *
 * The hub webhook uses it so two Telegram messages for the same chat apply in
 * order. BIM chat uses it so lines sent during a running turn queue instead of
 * blocking the input (`useBimChatStore.send`). A failure still releases the
 * next job.
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
