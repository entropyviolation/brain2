//
//  HealthPlugin.swift — Read Apple Health into Brain2 (docs/phone-sync/04-health.md)
//
//  Read only. The JS side (`lib/mobile/health-bridge.ts`, jsName "BrainHealth")
//  asks for one time window at a time, from the oldest sample through now.
//  This file does not cap history to a recent week. A page is statistics for
//  the days in that window, plus the sleep samples and workouts that overlap it.
//
//  Types: steps, walking + running distance, flights, active energy, heart rate,
//  sleep, workouts. Nothing here is written back to HealthKit.
//

import Capacitor
import HealthKit

private func healthMillis(_ date: Date) -> Double {
    date.timeIntervalSince1970 * 1000
}

private func healthDenied(_ error: Error?) -> Bool {
    guard let code = (error as? HKError)?.code else { return false }
    return code == .errorAuthorizationDenied || code == .errorAuthorizationNotDetermined
}

private enum HealthReader {
    static let store = HKHealthStore()

    static var quantityIds: [HKQuantityTypeIdentifier] {
        [.stepCount, .distanceWalkingRunning, .flightsClimbed, .activeEnergyBurned, .heartRate]
    }

    static var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()
        for id in quantityIds {
            if let type = HKObjectType.quantityType(forIdentifier: id) { types.insert(type) }
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        types.insert(HKObjectType.workoutType())
        return types
    }

    static var sampleTypes: [HKSampleType] {
        var types: [HKSampleType] = []
        for id in quantityIds {
            if let type = HKObjectType.quantityType(forIdentifier: id) { types.append(type) }
        }
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) { types.append(sleep) }
        types.append(HKObjectType.workoutType())
        return types
    }

    static func requestAccess(_ done: @escaping ([String: Any]) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else {
            done(["ok": false, "error": "Health data is not available on this iPhone."])
            return
        }
        store.requestAuthorization(toShare: nil, read: readTypes) { ok, error in
            DispatchQueue.main.async {
                if healthDenied(error) {
                    done(["ok": false, "denied": true, "error": error?.localizedDescription ?? "Health access is off."])
                    return
                }
                if let error = error {
                    done(["ok": false, "error": error.localizedDescription])
                    return
                }
                done(["ok": ok])
            }
        }
    }

    static func earliest(_ done: @escaping ([String: Any]) -> Void) {
        let group = DispatchGroup()
        let lock = NSLock()
        var oldest: Date?
        var denied = false
        var message: String?
        for type in sampleTypes {
            group.enter()
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
            let query = HKSampleQuery(sampleType: type, predicate: nil, limit: 1, sortDescriptors: [sort]) { _, samples, error in
                lock.lock()
                if healthDenied(error) { denied = true }
                else if let error = error, message == nil { message = error.localizedDescription }
                if let date = samples?.first?.startDate, oldest == nil || date < oldest! {
                    oldest = date
                }
                lock.unlock()
                group.leave()
            }
            store.execute(query)
        }
        group.notify(queue: .main) {
            if let oldest = oldest {
                done(["at": healthMillis(oldest)])
            } else if denied {
                done(["at": NSNull(), "denied": true])
            } else if let message = message {
                done(["at": NSNull(), "error": message])
            } else {
                done(["at": NSNull()])
            }
        }
    }

    static func readPage(startMs: Double, endMs: Double, done: @escaping ([String: Any]) -> Void) {
        let start = Date(timeIntervalSince1970: startMs / 1000)
        let end = Date(timeIntervalSince1970: endMs / 1000)
        guard end > start else {
            done(["days": [], "sleeps": [], "workouts": []])
            return
        }
        let calendar = Calendar.current
        let from = calendar.startOfDay(for: start)
        let group = DispatchGroup()
        let lock = NSLock()
        var days: [String: [String: Any]] = [:]
        var sleeps: [[String: Any]] = []
        var workouts: [[String: Any]] = []
        var denied = false
        var message: String?

        func note(_ error: Error?) {
            lock.lock()
            if healthDenied(error) { denied = true }
            else if let error = error, message == nil { message = error.localizedDescription }
            lock.unlock()
        }

        func put(_ date: Date, _ key: String, _ value: Double) {
            let day = dayKey(date)
            lock.lock()
            var row = days[day] ?? ["date": day]
            row[key] = value
            days[day] = row
            lock.unlock()
        }

        let cumulative: [(HKQuantityTypeIdentifier, HKUnit, String)] = [
            (.stepCount, .count(), "steps"),
            (.distanceWalkingRunning, .meter(), "distanceM"),
            (.flightsClimbed, .count(), "flights"),
            (.activeEnergyBurned, .kilocalorie(), "activeKcal"),
        ]
        for (id, unit, key) in cumulative {
            guard let type = HKObjectType.quantityType(forIdentifier: id) else { continue }
            group.enter()
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: nil,
                options: .cumulativeSum,
                anchorDate: from,
                intervalComponents: DateComponents(day: 1)
            )
            query.initialResultsHandler = { _, collection, error in
                note(error)
                collection?.enumerateStatistics(from: from, to: end) { stats, _ in
                    guard stats.startDate >= from, stats.startDate < end else { return }
                    if let qty = stats.sumQuantity() {
                        let value = qty.doubleValue(for: unit)
                        if value >= 0 { put(stats.startDate, key, value) }
                    }
                }
                group.leave()
            }
            store.execute(query)
        }

        if let heart = HKObjectType.quantityType(forIdentifier: .heartRate) {
            group.enter()
            let bpm = HKUnit.count().unitDivided(by: .minute())
            let query = HKStatisticsCollectionQuery(
                quantityType: heart,
                quantitySamplePredicate: nil,
                options: [.discreteAverage, .discreteMin, .discreteMax],
                anchorDate: from,
                intervalComponents: DateComponents(day: 1)
            )
            query.initialResultsHandler = { _, collection, error in
                note(error)
                collection?.enumerateStatistics(from: from, to: end) { stats, _ in
                    guard stats.startDate >= from, stats.startDate < end else { return }
                    if let avg = stats.averageQuantity() { put(stats.startDate, "heartAvg", avg.doubleValue(for: bpm)) }
                    if let min = stats.minimumQuantity() { put(stats.startDate, "heartMin", min.doubleValue(for: bpm)) }
                    if let max = stats.maximumQuantity() { put(stats.startDate, "heartMax", max.doubleValue(for: bpm)) }
                }
                group.leave()
            }
            store.execute(query)
        }

        let overlap = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        if let sleep = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            group.enter()
            let query = HKSampleQuery(sampleType: sleep, predicate: overlap, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
                note(error)
                var rows: [[String: Any]] = []
                for sample in samples ?? [] {
                    guard let cat = sample as? HKCategorySample else { continue }
                    let stage: String
                    switch cat.value {
                    case HKCategoryValueSleepAnalysis.inBed.rawValue: stage = "inBed"
                    case HKCategoryValueSleepAnalysis.awake.rawValue: continue
                    default: stage = "asleep"
                    }
                    rows.append([
                        "id": cat.uuid.uuidString,
                        "startMs": healthMillis(cat.startDate),
                        "endMs": healthMillis(cat.endDate),
                        "stage": stage,
                    ])
                }
                lock.lock()
                sleeps = rows
                lock.unlock()
                group.leave()
            }
            store.execute(query)
        }

        group.enter()
        let workoutsQuery = HKSampleQuery(sampleType: .workoutType(), predicate: overlap, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
            note(error)
            var rows: [[String: Any]] = []
            for sample in samples ?? [] {
                guard let workout = sample as? HKWorkout else { continue }
                rows.append([
                    "id": workout.uuid.uuidString,
                    "activity": activityName(workout.workoutActivityType),
                    "startMs": healthMillis(workout.startDate),
                    "endMs": healthMillis(workout.endDate),
                ])
            }
            lock.lock()
            workouts = rows
            lock.unlock()
            group.leave()
        }
        store.execute(workoutsQuery)

        group.notify(queue: .main) {
            // One type can be off while the others return rows. Denied with no rows is the permission failure.
            if denied && days.isEmpty && sleeps.isEmpty && workouts.isEmpty {
                done(["denied": true, "error": "Health access is off."])
                return
            }
            var out: [String: Any] = [
                "days": days.values.sorted { ($0["date"] as? String ?? "") < ($1["date"] as? String ?? "") },
                "sleeps": sleeps,
                "workouts": workouts,
            ]
            if let message = message, days.isEmpty && sleeps.isEmpty && workouts.isEmpty {
                out["error"] = message
            }
            done(out)
        }
    }

    static func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        DispatchQueue.main.async { UIApplication.shared.open(url) }
    }
}

private func dayKey(_ date: Date) -> String {
    let f = DateFormatter()
    f.calendar = Calendar.current
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone.current
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: date)
}

private func activityName(_ type: HKWorkoutActivityType) -> String {
    switch type {
    case .running: return "Running"
    case .walking: return "Walking"
    case .cycling: return "Cycling"
    case .swimming: return "Swimming"
    case .hiking: return "Hiking"
    case .yoga: return "Yoga"
    case .functionalStrengthTraining, .traditionalStrengthTraining: return "Strength"
    case .highIntensityIntervalTraining: return "HIIT"
    case .dance: return "Dance"
    case .elliptical: return "Elliptical"
    case .rowing: return "Rowing"
    case .stairClimbing: return "Stairs"
    case .mixedCardio: return "Cardio"
    case .mindAndBody: return "Mind and body"
    default: return "Workout"
    }
}

@objc(HealthPlugin)
public class HealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthPlugin"
    public let jsName = "BrainHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "earliest", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readPage", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openSettings", returnType: CAPPluginReturnPromise),
    ]

    @objc func requestAccess(_ call: CAPPluginCall) {
        HealthReader.requestAccess { call.resolve($0) }
    }

    @objc func earliest(_ call: CAPPluginCall) {
        HealthReader.earliest { call.resolve($0) }
    }

    @objc func readPage(_ call: CAPPluginCall) {
        guard let start = millis(call, "startMs"), let end = millis(call, "endMs"), end > start else {
            call.reject("startMs and endMs are required")
            return
        }
        HealthReader.readPage(startMs: start, endMs: end) { call.resolve($0) }
    }

    @objc func openSettings(_ call: CAPPluginCall) {
        HealthReader.openSettings()
        call.resolve()
    }

    private func millis(_ call: CAPPluginCall, _ key: String) -> Double? {
        if let n = call.options[key] as? NSNumber { return n.doubleValue }
        return nil
    }
}
