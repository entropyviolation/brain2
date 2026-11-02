/**
 * lib/mobile/reminders-bridge.ts — The JS side of the iPhone Reminders plugin
 *
 * The native side is `ios/App/App/RemindersPlugin.swift` (jsName
 * `BrainReminders`). It adds one timed item, with an alarm and the repeat
 * rule, to the default list in Apple Reminders. It never reads or edits what
 * is already there.
 *
 * On the web and in Electron nothing is available: `iosRemindersAvailable()`
 * is false and `addIosReminder` reports why. Only the iPhone app can write
 * to the phone's Reminders.
 */
import { Capacitor, registerPlugin } from "@capacitor/core"
import type { ReminderRepeat } from "@/lib/reminders"

export type IosRemindersPermission = "granted" | "denied" | "restricted" | "notDetermined" | "unknown"

export interface IosReminderInput {
  title: string
  at: Date
  repeat: ReminderRepeat
}

export interface IosReminderResult {
  ok: boolean
  id?: string
  error?: string
}

interface BrainRemindersPlugin {
  getStatus(): Promise<{ permission: IosRemindersPermission }>
  requestAccess(): Promise<{ permission: IosRemindersPermission }>
  add(options: { title: string; at: number; repeat: ReminderRepeat; notes?: string }): Promise<{ id: string }>
}

const BrainReminders = registerPlugin<BrainRemindersPlugin>("BrainReminders")

export const IOS_REMINDERS_DENIED = "Allow Reminders for BRAIN2 in iPhone Settings"
export const IOS_REMINDERS_UNAVAILABLE = "Only the iPhone app can add to Reminders"

/** True inside the iOS app build that carries the plugin. */
export function iosRemindersAvailable(): boolean {
  return Capacitor.getPlatform() === "ios" && Capacitor.isPluginAvailable("BrainReminders")
}

/** Ask for Reminders access if needed, then add the item. Never throws. */
export async function addIosReminder(input: IosReminderInput): Promise<IosReminderResult> {
  if (!iosRemindersAvailable()) return { ok: false, error: IOS_REMINDERS_UNAVAILABLE }
  try {
    let { permission } = await BrainReminders.getStatus()
    if (permission === "notDetermined") ({ permission } = await BrainReminders.requestAccess())
    if (permission !== "granted") return { ok: false, error: IOS_REMINDERS_DENIED }
    const { id } = await BrainReminders.add({
      title: input.title.trim(),
      at: input.at.getTime(),
      repeat: input.repeat,
    })
    return { ok: true, id }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not add to Reminders" }
  }
}
