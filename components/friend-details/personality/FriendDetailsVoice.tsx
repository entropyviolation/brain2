/**
 * components/friend-details/personality/FriendDetailsVoice.tsx — Chunky voice keys
 *
 * A click (tone, bubble, whim) changes the next line. On their own
 * (cadence, pushiness) is saved for the later clock and stays recessed.
 * Celebrate may glow: finishing already adds its warm line.
 */
"use client"

import {
  FRIEND_CADENCE,
  FRIEND_DIALOG_EFFECTS,
  FRIEND_PUSHINESS,
  FRIEND_TONE,
  type FriendCadence,
  type FriendDialogEffect,
  type FriendPersonality,
  type FriendPushiness,
  type FriendTone,
} from "@/lib/baby-animal-personality"
import { friendSuggestionLine } from "@/lib/friend-copy"
import { FRIEND_WHIMS } from "@/lib/friend-whims"

const TONE_LABEL: Record<FriendTone, string> = {
  gentle: "Gentle",
  playful: "Playful",
  direct: "Direct",
  coach: "Coach",
}

const EFFECT_LABEL: Record<FriendDialogEffect, string> = {
  plain: "Plain",
  heart: "Heart",
  sparkle: "Sparkle",
  stamp: "Stamp",
  whisper: "Whisper",
  bounce: "Bounce",
}

const CADENCE_LABEL: Record<FriendCadence, string> = {
  quiet: "Quiet",
  occasional: "Sometimes",
  chatty: "Chatty",
  eager: "Eager",
}

const PUSH_LABEL: Record<FriendPushiness, string> = {
  never: "Never",
  nudge: "Nudge",
  insist: "Insist",
  celebrate: "Celebrate",
}

function Key({
  pressed,
  live,
  radio,
  swatch,
  children,
  onClick,
  onHover,
  title,
}: {
  pressed: boolean
  live?: boolean
  radio?: boolean
  swatch?: string
  children: string
  onClick: () => void
  onHover?: (line: string) => void
  title?: string
}) {
  return (
    <button
      type="button"
      role={radio ? "radio" : undefined}
      data-no95=""
      className={`friend-key${pressed ? " is-on" : ""}${live ? " is-live" : ""}${swatch ? ` is-swatch is-${swatch}` : ""}`}
      aria-pressed={radio ? undefined : pressed}
      aria-checked={radio ? pressed : undefined}
      title={title}
      onClick={onClick}
      onMouseEnter={onHover ? () => onHover(title || children) : undefined}
      onFocus={onHover ? () => onHover(title || children) : undefined}
    >
      {children}
    </button>
  )
}

export function FriendDetailsVoice({
  draft,
  onChange,
  onPreview,
}: {
  draft: FriendPersonality
  onChange: (partial: Partial<FriendPersonality>) => void
  onPreview?: (line: string) => void
}) {
  const preview = (line: string) => onPreview?.(line)

  return (
    <div className="friend-voice">
      <fieldset className="friend-voice-bay" title="Tone, bubble, and favorite whim change the next chat line.">
        <legend className="friend-bay-title">Voice</legend>
        <p className="friend-field-label" id="friend-tone-label">Tone</p>
        <div className="friend-dial" role="radiogroup" aria-labelledby="friend-tone-label">
          {FRIEND_TONE.map((tone) => (
            <Key
              key={tone}
              radio
              pressed={draft.tone === tone}
              title={friendSuggestionLine(tone, "todo", "this one", () => 0)}
              onHover={preview}
              onClick={() => onChange({ tone })}
            >
              {TONE_LABEL[tone]}
            </Key>
          ))}
        </div>
        <p className="friend-field-label" id="friend-bubble-label">Bubble</p>
        <div className="friend-swatches" role="radiogroup" aria-labelledby="friend-bubble-label">
          {FRIEND_DIALOG_EFFECTS.map((effect) => (
            <Key
              key={effect}
              radio
              swatch={effect}
              pressed={draft.dialogEffect === effect}
              title={`${EFFECT_LABEL[effect]} paints the portrait and the speech bubble.`}
              onHover={preview}
              onClick={() => onChange({ dialogEffect: effect })}
            >
              {EFFECT_LABEL[effect]}
            </Key>
          ))}
        </div>
        <p className="friend-field-label" id="friend-whim-label">Whim</p>
        <div className="friend-key-row is-whims" role="radiogroup" aria-labelledby="friend-whim-label">
          {Object.values(FRIEND_WHIMS).map((row) => (
            <Key
              key={row.id}
              radio
              pressed={draft.whimId === row.id}
              title={row.blurb}
              onHover={preview}
              onClick={() => onChange({ whimId: row.id })}
            >
              {row.title}
            </Key>
          ))}
        </div>
      </fieldset>
      <fieldset
        className="friend-voice-bay is-saved"
        title="Saved for when a friend speaks without a click. Celebrate already adds a warm line when you finish."
      >
        <legend>
          On their own
          <span className="friend-saved-lamp" aria-hidden="true" />
          <span className="friend-saved-word">saved</span>
        </legend>
        <p className="friend-field-label" id="friend-cadence-label">Cadence</p>
        <div className="friend-key-row" role="group" aria-labelledby="friend-cadence-label">
          {FRIEND_CADENCE.map((cadence) => (
            <Key key={cadence} pressed={draft.cadence === cadence} onClick={() => onChange({ cadence })}>
              {CADENCE_LABEL[cadence]}
            </Key>
          ))}
        </div>
        <p className="friend-field-label" id="friend-push-label">Push</p>
        <div className="friend-key-row" role="group" aria-labelledby="friend-push-label">
          {FRIEND_PUSHINESS.map((pushiness) => (
            <Key
              key={pushiness}
              pressed={draft.pushiness === pushiness}
              live={pushiness === "celebrate"}
              onClick={() => onChange({ pushiness })}
            >
              {PUSH_LABEL[pushiness]}
            </Key>
          ))}
        </div>
      </fieldset>
    </div>
  )
}
