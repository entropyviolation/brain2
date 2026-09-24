/**
 * lib/ingest/telegram-bridge.ts — Renderer access to the Telegram poller
 *
 * Electron: window.desktop.telegram.*
 * Dev hub: /api/ingest/pending + /api/ingest/reply while `npm run ingest` runs.
 */
import type { IncomingAttachment, IncomingMessage } from "./types"

export interface TelegramDesktopBridge {
  setToken: (token: string) => Promise<{ ok: boolean; hasToken?: boolean }>
  clearToken: () => Promise<{ ok: boolean }>
  hasToken: () => Promise<{ ok: boolean; hasToken: boolean }>
  start: () => Promise<{ ok: boolean; polling?: boolean; hub?: boolean; error?: string }>
  stop: () => Promise<{ ok: boolean }>
  status: () => Promise<{ ok: boolean; polling?: boolean; hasToken?: boolean; hub?: boolean }>
  send: (chatId: string, text: string) => Promise<{ ok: boolean; error?: string; messageId?: number; messageIds?: number[] }>
  pin?: (chatId: string, messageId: number, previousId?: number) => Promise<{ ok: boolean; error?: string }>
  onMessage: (cb: (msg: IncomingTelegramPayload) => void) => () => void
  onStatus?: (cb: (status: { ok: boolean; error?: string }) => void) => () => void
}

export interface IncomingTelegramPayload {
  text: string
  chatId: string
  userId?: string
  username?: string
  isGroup?: boolean
  telegramMessageId?: number
  telegramUpdateId?: number
  receivedAt: string
  attachments?: IncomingAttachment[]
  mediaGroupId?: string
}

interface DesktopWithTelegram {
  telegram?: TelegramDesktopBridge
}

export function getTelegramDesktop(): TelegramDesktopBridge | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { desktop?: DesktopWithTelegram }).desktop?.telegram
}

export function incomingFromTelegram(payload: IncomingTelegramPayload): IncomingMessage {
  return {
    source: {
      channel: "telegram",
      chatId: payload.chatId,
      userId: payload.userId,
      username: payload.username,
      isGroup: payload.isGroup,
    },
    text: payload.text,
    receivedAt: payload.receivedAt || new Date().toISOString(),
    telegramMessageId: payload.telegramMessageId,
    telegramUpdateId: payload.telegramUpdateId,
    attachments: payload.attachments,
  }
}

export async function fetchHubPending(base = ""): Promise<IncomingTelegramPayload[]> {
  const res = await fetch(`${base}/api/ingest/pending`, { cache: "no-store" })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data.pending) ? data.pending : []
}

export async function postHubReply(chatId: string, text: string, base = ""): Promise<void> {
  await fetch(`${base}/api/ingest/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, text }),
  })
}

export async function fetchHubStatus(base = ""): Promise<{ ok: boolean; pending?: number; polling?: boolean }> {
  try {
    const res = await fetch(`${base}/api/ingest/status`, { cache: "no-store" })
    if (!res.ok) return { ok: false }
    return await res.json()
  } catch {
    return { ok: false }
  }
}
