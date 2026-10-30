/**
 * components/friend-details/FriendSpeechBubble.tsx — The nest’s speech bubble
 *
 * The header nest and the instrument’s Say it preview both render this,
 * so chrome (heart, sparkle, stamp, whisper, bounce, plain) cannot drift.
 */
"use client"

import type { FriendDialogEffect } from "@/lib/baby-animal-personality"

export function FriendSpeechBubble({
  effect,
  name,
  line,
  onLineClick,
  onClose,
  className = "",
}: {
  effect: FriendDialogEffect
  name?: string
  line: string
  onLineClick?: () => void
  onClose?: () => void
  className?: string
}) {
  return (
    <div className={`baby-friend-bubble is-${effect}${className ? ` ${className}` : ""}`} role="status">
      <div className="baby-friend-bubble-copy">
        {name ? <p className="baby-friend-bubble-name">{name}</p> : null}
        {onLineClick ? (
          <button
            type="button"
            className="baby-friend-bubble-line"
            data-no95=""
            onClick={onLineClick}
            aria-label="Show mission details"
          >
            {line}
          </button>
        ) : (
          <p className="baby-friend-bubble-line">{line}</p>
        )}
      </div>
      {onClose ? (
        <button type="button" className="baby-friend-bubble-close" data-no95="" aria-label="Close chat" title="Close (Esc)" onClick={onClose}>
          Close
        </button>
      ) : null}
    </div>
  )
}
