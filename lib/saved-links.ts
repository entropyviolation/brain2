/**
 * lib/saved-links.ts — Links pile (pure helpers)
 *
 * A message to BIM that starts with a link is a saved link, not a log line
 * or an Inbox idea. The first token is the link. Any text after it is the
 * note: `wikipedia.com good for research` → link `wikipedia.com`, note
 * `good for research`. The row is a `stage: "inbox"` task with `savedLink`
 * set, so it sits on Inbox → Links and not on the revisit pile.
 *
 * A bare domain counts only with a known ending (`.com`, `.org`, …), so
 * `st.louis trip` is not a link.
 */
import type { SavedLink, SavedLinkKind, Task } from "@/lib/types"

export type { SavedLink, SavedLinkKind }

/** Bare-domain endings that read as a link without `http`. */
const BARE_TLDS = [
  "com", "org", "net", "edu", "gov", "io", "co", "app", "dev", "me", "tv", "ai",
  "ly", "gg", "fm", "so", "to", "info", "xyz", "news", "blog", "site", "page",
  "us", "uk", "ca", "au", "de", "fr", "it", "es", "nl", "be", "ch", "jp", "in",
  "is", "art", "wiki", "link", "online", "store", "shop",
]

const SCHEME_RE = /^https?:\/\/[^\s/$.?#][^\s]*$/i
const WWW_RE = /^www\.[^\s.]+\.[^\s]+$/i
const BARE_RE = new RegExp(
  `^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${BARE_TLDS.join("|")})(?::\\d+)?(?:[/?#][^\\s]*)?$`,
  "i",
)

/** Trailing punctuation a link in a sentence often picks up. */
function trimLinkTail(token: string): string {
  return token.replace(/[),.;!?]+$/, "")
}

export function looksLikeLink(token: string): boolean {
  const t = trimLinkTail(token.trim())
  if (!t) return false
  return SCHEME_RE.test(t) || WWW_RE.test(t) || BARE_RE.test(t)
}

export function normalizeLinkUrl(token: string): string {
  const t = trimLinkTail(token.trim())
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return ""
  }
}

export function linkKind(url: string): SavedLinkKind {
  const host = hostOf(url)
  const on = (...domains: string[]) => domains.some((d) => host === d || host.endsWith(`.${d}`))
  if (on("tiktok.com")) return "tiktok"
  if (on("instagram.com", "instagr.am")) return "instagram"
  if (on("youtube.com", "youtu.be")) return "youtube"
  if (on("x.com", "twitter.com")) return "x"
  if (on("reddit.com", "redd.it")) return "reddit"
  if (on("spotify.com", "spotify.link")) return "spotify"
  if (on("pinterest.com", "pin.it")) return "pinterest"
  if (on("substack.com")) return "substack"
  if (on("wikipedia.org", "wikipedia.com")) return "wikipedia"
  return "article"
}

const KIND_LABELS: Record<SavedLinkKind, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  reddit: "Reddit",
  spotify: "Spotify",
  pinterest: "Pinterest",
  substack: "Substack",
  wikipedia: "Wikipedia",
  article: "Article",
}

/** `Instagram reel`, `YouTube short`, `TikTok`, `Article`. */
export function linkKindLabel(link: SavedLink): string {
  const base = KIND_LABELS[link.kind]
  let path = ""
  try {
    path = new URL(link.url).pathname.toLowerCase()
  } catch {
    return base
  }
  if (link.kind === "instagram" && /^\/(reel|reels)\//.test(path)) return "Instagram reel"
  if (link.kind === "instagram" && /^\/p\//.test(path)) return "Instagram post"
  if (link.kind === "youtube" && /^\/shorts\//.test(path)) return "YouTube short"
  return base
}

/** Host without `www.`, for the row's quiet second line. */
export function linkHost(url: string): string {
  return hostOf(url) || url
}

/**
 * A message whose first token is a link. Returns null otherwise.
 * The note is the rest of the message, trimmed (newlines kept).
 */
export function parseLinkMessage(text: string): { link: SavedLink; note: string } | null {
  const trimmed = text.replace(/^﻿/, "").trim()
  const match = /^(\S+)([\s\S]*)$/.exec(trimmed)
  if (!match || !looksLikeLink(match[1]!)) return null
  const raw = match[1]!
  const tail = trimLinkTail(raw) === raw ? "" : raw.slice(trimLinkTail(raw).length)
  const url = normalizeLinkUrl(raw)
  const note = `${tail.replace(/^[,.;]+/, "")}${match[2] ?? ""}`.trim()
  return { link: { url, kind: linkKind(url) }, note }
}

/** Open rows on Inbox → Links. */
export function isOpenSavedLink(task: Task): boolean {
  return task.stage === "inbox" && !task.completed && task.savedLink != null
}
