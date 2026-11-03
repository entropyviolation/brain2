//
//  RemindersPlugin.swift — BrainReminders: add a timed item to the iPhone Reminders app
//
//  The Reminders popup can ask for a copy in Apple Reminders. add creates one
//  EKReminder in the default Reminders list, due at `at` (epoch ms), with an
//  alarm at that time so the phone rings, and a repeat rule for daily,
//  weekdays, weekly, monthly, and yearly. Moon repeats are one-time here; the
//  app moves its own row to the next lunation.
//  getStatus reports the permission without asking. requestAccess asks once.
//  This only writes new reminders. It never reads or edits the ones already there.
//
//  Needs NSRemindersFullAccessUsageDescription (iOS 17+) and
//  NSRemindersUsageDescription (older iOS) in Info.plist.
//
//  JS side: lib/mobile/reminders-bridge.ts. Registered in AppViewController.swift.
//

import Capacitor
import EventKit
import Foundation

@objc(RemindersPlugin)
public class RemindersPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RemindersPlugin"
    public let jsName = "BrainReminders"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "add", returnType: CAPPluginReturnPromise),
    ]

    private let store = EKEventStore()

    private static func permissionName(_ status: EKAuthorizationStatus) -> String {
        switch status {
        case .notDetermined: return "notDetermined"
        case .restricted: return "restricted"
        case .denied: return "denied"
        default:
            // 3 is .authorized before iOS 17 and .fullAccess after it; neither has one name on both.
            return status.rawValue == 3 ? "granted" : "unknown"
        }
    }

    private func canWrite() -> Bool {
        Self.permissionName(EKEventStore.authorizationStatus(for: .reminder)) == "granted"
    }

    @objc func getStatus(_ call: CAPPluginCall) {
        call.resolve(["permission": Self.permissionName(EKEventStore.authorizationStatus(for: .reminder))])
    }

    @objc func requestAccess(_ call: CAPPluginCall) {
        let done: (Bool, Error?) -> Void = { [weak self] _, _ in
            let status = EKEventStore.authorizationStatus(for: .reminder)
            call.resolve(["permission": Self.permissionName(status)])
            _ = self
        }
        if #available(iOS 17.0, *) {
            store.requestFullAccessToReminders(completion: done)
        } else {
            store.requestAccess(to: .reminder, completion: done)
        }
    }

    @objc func add(_ call: CAPPluginCall) {
        guard let title = call.getString("title")?.trimmingCharacters(in: .whitespacesAndNewlines), !title.isEmpty,
              let atMs = call.getDouble("at") else {
            call.reject("title and at are required")
            return
        }
        guard canWrite() else {
            call.reject("Reminders access is not allowed")
            return
        }
        guard let calendar = store.defaultCalendarForNewReminders() else {
            call.reject("No default Reminders list")
            return
        }

        let due = Date(timeIntervalSince1970: atMs / 1000)
        let reminder = EKReminder(eventStore: store)
        reminder.calendar = calendar
        reminder.title = title
        reminder.notes = call.getString("notes")
        reminder.dueDateComponents = Calendar.current.dateComponents(
            [.year, .month, .day, .hour, .minute], from: due
        )
        reminder.addAlarm(EKAlarm(absoluteDate: due))
        if let rule = Self.recurrence(call.getString("repeat") ?? "once") {
            reminder.addRecurrenceRule(rule)
        }

        do {
            try store.save(reminder, commit: true)
            call.resolve(["id": reminder.calendarItemIdentifier])
        } catch {
            call.reject("Could not save the reminder: \(error.localizedDescription)")
        }
    }

    private static func recurrence(_ repeatName: String) -> EKRecurrenceRule? {
        switch repeatName {
        case "daily":
            return EKRecurrenceRule(recurrenceWith: .daily, interval: 1, end: nil)
        case "weekdays":
            let days = [EKWeekday.monday, .tuesday, .wednesday, .thursday, .friday].map { EKRecurrenceDayOfWeek($0) }
            return EKRecurrenceRule(
                recurrenceWith: .weekly, interval: 1, daysOfTheWeek: days, daysOfTheMonth: nil,
                monthsOfTheYear: nil, weeksOfTheYear: nil, daysOfTheYear: nil, setPositions: nil, end: nil
            )
        case "weekly":
            return EKRecurrenceRule(recurrenceWith: .weekly, interval: 1, end: nil)
        case "monthly":
            return EKRecurrenceRule(recurrenceWith: .monthly, interval: 1, end: nil)
        case "yearly":
            return EKRecurrenceRule(recurrenceWith: .yearly, interval: 1, end: nil)
        default:
            return nil
        }
    }
}
