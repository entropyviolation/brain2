/**
 * lib/doc-selection/doc-selection-bus.ts — hand highlighted text to a global door
 *
 * Quick Add and BIM Chat are mounted far from the Docs editor. These two
 * window events reach them. BIM Chat's line is written to its saved draft
 * first, so a console that has not mounted yet still opens with the text.
 */
import { BIM_CHAT_DRAFT_KEY, readDraft, writeTextDraft } from "@/lib/draft-store"

export const QUICK_ADD_SEED_EVENT = "brain2:quick-add-seed"
export const BIM_CHAT_ADD_EVENT = "brain2:bim-chat-add"

/** Open Quick Add with this exact text in the entry field. */
export function openQuickAddWith(text: string): void {
  window.dispatchEvent(new CustomEvent<string>(QUICK_ADD_SEED_EVENT, { detail: text }))
}

/** Put this text in BIM Chat's compose well (after anything already typed) and open the console. */
export function addToBimChat(text: string): void {
  const prior = readDraft<{ text?: string }>(BIM_CHAT_DRAFT_KEY)?.text?.trimEnd() ?? ""
  writeTextDraft(BIM_CHAT_DRAFT_KEY, prior ? `${prior}\n${text}` : text)
  window.dispatchEvent(new Event(BIM_CHAT_ADD_EVENT))
}
