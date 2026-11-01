/**
 * tests/phone-builders.ts — Mock data for the phone window: vault snapshots, patches, and a hub `fetch`.
 *
 * `canonItems` is what `GET /api/persist?canon=1` sends. `hubFetch` answers that,
 * `/api/sync/status`, and the patch `POST`, and keeps every posted body so a
 * test can read the send order.
 */
import { vi } from "vitest"
import type { PhoneOutboxRow, PhonePatch } from "@/lib/phone-window-cache"
import { TASK_STORE_PERSIST_VERSION } from "@/lib/task-store"

export const PHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"

export type TaskRow = { id: string; title: string } & Record<string, unknown>

export function taskRow(id: string, over: Partial<TaskRow> = {}): TaskRow {
  return { id, title: id, description: id, completed: false, lists: [], createdAt: "2026-10-01T00:00:00.000Z", ...over }
}

/** One persisted `task-storage` blob, as the Mac stores it. */
export function taskStorage(tasks: TaskRow[], over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    state: { tasks, lists: [], folders: [], removedTaskIds: [], removedListIds: [], ...over },
    version: TASK_STORE_PERSIST_VERSION,
  })
}

/** A vault map, `brain2-*` key → persisted string. */
export function canonItems(items: Record<string, string> = {}): Record<string, string> {
  return { "brain2-task-storage": taskStorage([taskRow("a", { title: "Milk" })]), ...items }
}

export function patch(upserts: PhonePatch["upserts"] = [], removedIds: string[] = []): PhonePatch {
  return { upserts, removedIds }
}

let rowCount = 0
export function outboxRow(over: Partial<PhoneOutboxRow> = {}): PhoneOutboxRow {
  rowCount += 1
  return { id: `row-${rowCount}`, name: "brain2-task-storage", source: "phone", patch: patch([{ id: "a", title: `t${rowCount}` }]), ...over }
}

type Answer = { status: number; body?: unknown } | "throw"

export type HubFetchOptions = {
  items?: Record<string, string>
  /** `GET /api/persist?canon=1`. Default 200 with `items`. */
  canon?: () => Answer
  /** One answer per patch `POST`, in order. Default 200. */
  post?: (body: { name: string; patch: PhonePatch }, at: number) => Answer
  status?: () => Answer
}

function respond(answer: Answer) {
  if (answer === "throw") throw new TypeError("Load failed")
  return { ok: answer.status >= 200 && answer.status < 300, status: answer.status, statusText: String(answer.status), json: async () => answer.body ?? {} }
}

/** A `fetch` stub for the Mac hub. `posts` holds every patch body in send order. */
export function hubFetch(opts: HubFetchOptions = {}) {
  const posts: Array<{ name: string; source: string; patch: PhonePatch }> = []
  const canonCalls: string[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (init?.method === "POST" && url.endsWith("/api/persist")) {
      const body = JSON.parse(String(init.body))
      const at = posts.length
      const answer = opts.post?.(body, at) ?? { status: 200, body: { ok: true } }
      if (answer !== "throw" && answer.status >= 200 && answer.status < 300) posts.push(body)
      return respond(answer)
    }
    if (url.includes("/api/persist")) {
      canonCalls.push(url)
      return respond(opts.canon?.() ?? { status: 200, body: { ok: true, items: opts.items ?? canonItems() } })
    }
    if (url.endsWith("/api/sync/status")) {
      return respond(opts.status?.() ?? { status: 200, body: { ok: true, hasData: true } })
    }
    return respond({ status: 404 })
  })
  return { fn, posts, canonCalls }
}
