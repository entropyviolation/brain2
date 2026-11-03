"use client"

/**
 * components/Lists/list-content/InstagramProfileKey.tsx — Visit profile key on a list row
 *
 * Shown on rows of the Instagram Account type (`instagramProfileKeyHandle`).
 * The Default display puts it at the row's end; Details puts it in Actions.
 * In the iOS app it opens the Instagram app (`openInstagramProfile`).
 */

import { ExternalLink } from "lucide-react"
import { instagramProfileUrl, openInstagramProfile } from "@/lib/instagram-profile-link"

export function InstagramProfileKey({ handle }: { handle: string }) {
  return (
    <a
      className="fm-read-ig"
      href={instagramProfileUrl(handle)}
      target="_blank"
      rel="noreferrer"
      title={`Visit @${handle} on Instagram`}
      aria-label={`Visit @${handle} on Instagram`}
      data-testid="list-row-instagram"
      draggable={false}
      onClick={(e) => openInstagramProfile(handle, e)}
    >
      <ExternalLink aria-hidden />
    </a>
  )
}
