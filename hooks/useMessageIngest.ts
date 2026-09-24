/**
 * hooks/useMessageIngest.ts — Drain Telegram / hub messages into the executor
 *
 * Mounted once from the app shell. Electron IPC is preferred; the always-on
 * phone hub (`npm run phone:hub`) owns Telegram when its heartbeat is live.
 * A 60s vault dump goes only to a live always-on phone hub — never a full-map
 * PUT to localhost `/api/persist` (that re-introduced friend-pic blobs and
 * stale Inbox rows). The old `npm run ingest` queue is the last fallback. A 60s vault dump goes
 * only to a live always-on phone hub — never a full-map PUT to localhost.
 */
"use client"

import { useEffect } from "react"
import { ingestIncomingAsync } from "@/lib/ingest/executor"
import { deliverIngestReply } from "@/lib/ingest/deliver-reply"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { MediaAlbumBuffer } from "@/lib/ingest/media-album"
import {
  fetchHubPending,
  fetchHubStatus,
  getTelegramDesktop,
  incomingFromTelegram,
  postHubReply,
  type IncomingTelegramPayload,
} from "@/lib/ingest/telegram-bridge"
import { fetchPhoneHubStatus, normalizeHubUrl, pushVaultToHub } from "@/lib/ingest/vault-push"

export function useMessageIngest() {
  const enabled = useIngestStore((s) => s.enabled)
  const setPollStatus = useIngestStore((s) => s.setPollStatus)
  const phoneHubUrl = useIngestStore((s) => s.phoneHubUrl)

  useEffect(() => {
    if (!enabled) return

    const desktop = getTelegramDesktop()
    let cancelled = false
    let unsubMessage: (() => void) | undefined
    let unsubStatus: (() => void) | undefined
    let hubTimer: number | undefined
    let pushTimer: number | undefined
    let yieldedToHub = false

    const hubOrigin = normalizeHubUrl(phoneHubUrl) || "http://127.0.0.1:8787"

    const pushVault = async () => {
      // Only dump onto the always-on phone hub. Localhost /api/persist already
      // receives per-key POSTs; a 60s full-map PUT re-introduced friend-pic
      // blobs and stale Inbox rows.
      const remote = await fetchPhoneHubStatus(hubOrigin)
      if (!remote.ok || !remote.polling) return
      await pushVaultToHub(hubOrigin)
    }

    const tickHubOwnership = async () => {
      const remote = await fetchPhoneHubStatus(hubOrigin)
      if (cancelled) return remote
      if (remote.ok && remote.polling) {
        yieldedToHub = true
        setPollStatus(true, "phone-hub")
        if (desktop) void desktop.stop()
      }
      return remote
    }

    const applyPayload = async (payload: IncomingTelegramPayload) => {
      const result = await ingestIncomingAsync(incomingFromTelegram(payload))
      if (desktop) {
        await deliverIngestReply(payload.chatId, result, {
          send: async (chatId, text) => {
            const sent = await desktop.send(chatId, text)
            return { messageId: sent.messageId ?? sent.messageIds?.[0] }
          },
          pin: desktop.pin
            ? async (chatId, messageId, previousId) => {
                await desktop.pin?.(chatId, messageId, previousId)
              }
            : undefined,
        })
        return
      }
      const text = result.status === "ignored" ? result.reply : result.reply
      if (text) await postHubReply(payload.chatId, text)
    }

    const albums = new MediaAlbumBuffer<IncomingTelegramPayload>((merged) => {
      void applyPayload(merged)
    })

    void (async () => {
      const remote = await tickHubOwnership()
      if (cancelled) return
      if (remote.ok && remote.polling) {
        void pushVault()
        return
      }

      if (desktop) {
        const started = await desktop.start()
        if (cancelled) return
        if (started.hub) {
          yieldedToHub = true
          setPollStatus(true, "phone-hub")
          void pushVault()
          return
        }
        setPollStatus(Boolean(started.ok), "electron", started.error)
        unsubMessage = desktop.onMessage((payload) => {
          if (yieldedToHub) return
          albums.push(payload)
        })
        unsubStatus = desktop.onStatus?.((status) => {
          if (status.ok && "hub" in status) {
            yieldedToHub = true
            setPollStatus(true, "phone-hub")
            return
          }
          setPollStatus(Boolean(status.ok), "electron", status.error)
        })
      } else {
        const tick = async () => {
          const hub = await fetchPhoneHubStatus(hubOrigin)
          if (cancelled) return
          if (hub.ok && hub.polling) {
            setPollStatus(true, "phone-hub")
            return
          }
          const status = await fetchHubStatus()
          if (cancelled) return
          setPollStatus(status.ok, "hub", status.ok ? null : "ingest hub offline")
          if (!status.ok) return
          const pending = await fetchHubPending()
          for (const payload of pending) {
            if (cancelled) break
            albums.push(payload)
          }
        }
        void tick()
        hubTimer = window.setInterval(() => void tick(), 3000)
      }
    })()

    pushTimer = window.setInterval(() => {
      void tickHubOwnership()
      void pushVault()
    }, 60_000)
    void pushVault()

    return () => {
      cancelled = true
      albums.dispose()
      unsubMessage?.()
      unsubStatus?.()
      if (hubTimer) window.clearInterval(hubTimer)
      if (pushTimer) window.clearInterval(pushTimer)
      if (desktop) void desktop.stop()
    }
  }, [enabled, phoneHubUrl, setPollStatus])
}
