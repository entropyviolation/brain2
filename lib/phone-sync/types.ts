/**
 * lib/phone-sync/types.ts — Records the phone sync readers hand to the core
 *
 * A reader (Mac Messages, Mac call history, the iOS app) turns its source rows
 * into these. The core writes them into Tracking and the message archive.
 * Plan: docs/PHONE_SYNC_PLAN.md. Briefs: docs/phone-sync/.
 */

export type PhoneSyncSource = "messages" | "calls" | "location" | "health" | "screen" | "email" | "dms"

/** Who the record is with, as the source names them. */
export interface PhoneParty {
  /** Phone number, email, or app handle exactly as the source has it. */
  handle: string
  /** Contacts name when the source knows one. */
  displayName?: string
}

interface BaseRecord {
  source: PhoneSyncSource
  /** Stable id inside its source (message GUID, call unique id, sample UUID). */
  sourceId: string
  /** When it happened, epoch ms. */
  at: number
}

export interface MessageRecord extends BaseRecord {
  type: "message"
  source: "messages" | "dms" | "email"
  direction: "in" | "out"
  /** The other side. In a group, the sender for "in", the first member for "out". */
  party: PhoneParty
  /** Everyone else in a group chat. */
  members?: PhoneParty[]
  threadId: string
  threadName?: string
  body: string
  /** iMessage, SMS, RCS, Instagram, … */
  service?: string
  attachments?: string[]
}

export interface CallRecord extends BaseRecord {
  type: "call"
  source: "calls"
  direction: "in" | "out"
  party: PhoneParty
  /** Seconds. 0 for missed or declined. */
  durationSec: number
  answered: boolean
  /** phone, facetime-audio, facetime-video, or the VoIP app's name. */
  service?: string
}

export type PhoneRecord = MessageRecord | CallRecord

/** One reader run, for the Settings log. */
export interface PhoneSyncRun {
  source: PhoneSyncSource
  startedAt: number
  finishedAt: number
  read: number
  written: number
  skipped: number
  error?: string
}
