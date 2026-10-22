//
//  LocationPlugin.swift — Background location for Brain2 (docs/phone-sync/03-location.md)
//
//  Records significant moves (about 500 m or more) and visits (arrive / leave).
//  Not continuous GPS, so short trips and indoor moves can leave gaps.
//  Events wait in a queue file on the phone. Each upload seals a batch to the
//  capture public key (same format as scripts/sealed-box.mjs) and posts it to
//  the Oracle box's POST /upload. The box cannot read it.
//
//  Recording and upload live in LocationRecorder, not the plugin, because iOS
//  relaunches the app in the background for a location event with no web view.
//  AppDelegate calls LocationRecorder.shared.resumeIfEnabled() at launch.
//
//  JS side: lib/mobile/location-bridge.ts (jsName "BrainLocation").
//  Registered in AppViewController.swift.
//

import Capacitor
import CoreLocation
import CryptoKit
import Foundation
import UIKit

// MARK: - Sealing (matches scripts/sealed-box.mjs)

enum CaptureSealer {
    enum SealError: Error { case badPublicKey }

    private static let info = Data("brain2-capture-v1".utf8)
    /// DER prefix of an X25519 SubjectPublicKeyInfo; the raw 32-byte key follows.
    private static let spkiPrefix = Data([0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x03, 0x21, 0x00])

    /// Wire form `v1.<epk>.<iv>.<tag>.<ciphertext>`, each part base64url without padding.
    static func seal(publicKeyBase64: String, plaintext: Data) throws -> String {
        guard let recipientDer = Data(base64Encoded: publicKeyBase64.trimmingCharacters(in: .whitespacesAndNewlines)),
              recipientDer.count == 44,
              recipientDer.prefix(12) == spkiPrefix else {
            throw SealError.badPublicKey
        }
        let recipient = try Curve25519.KeyAgreement.PublicKey(rawRepresentation: recipientDer.suffix(32))
        let ephemeral = Curve25519.KeyAgreement.PrivateKey()
        let epkDer = spkiPrefix + ephemeral.publicKey.rawRepresentation
        let shared = try ephemeral.sharedSecretFromKeyAgreement(with: recipient)
        let key = shared.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: epkDer + recipientDer,
            sharedInfo: info,
            outputByteCount: 32
        )
        let nonce = AES.GCM.Nonce()
        let box = try AES.GCM.seal(plaintext, using: key, nonce: nonce, authenticating: info)
        return ["v1", b64u(epkDer), b64u(nonce.withUnsafeBytes { Data($0) }), b64u(box.tag), b64u(box.ciphertext)].joined(separator: ".")
    }

    private static func b64u(_ data: Data) -> String {
        data.base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }
}

// MARK: - Queue entries

/// One recorded event. `id` is local only, to remove it after upload.
/// The hub makes its own ids from the event, so a re-send writes nothing new.
struct QueuedLocationEvent: Codable {
    var id: String
    var type: String // "point" or "visit"
    var at: Double? // epoch ms, points
    var arriveAt: Double? // epoch ms, visits; nil when unknown
    var departAt: Double? // epoch ms, visits; nil while still there
    var lat: Double
    var lon: Double
    var acc: Double?
}

private struct LocationBatchBody: Codable {
    var v: Int
    var kind: String
    var device: String
    var sentAt: Double
    var events: [QueuedLocationEvent]
}

// MARK: - Recorder

final class LocationRecorder: NSObject, CLLocationManagerDelegate {
    static let shared = LocationRecorder()

    static let maxQueued = 5000
    static let batchSize = 200

    private enum Key {
        static let enabled = "brain2.location.enabled"
        static let uploadUrl = "brain2.location.uploadUrl"
        static let token = "brain2.location.token"
        static let publicKey = "brain2.location.publicKey"
        static let device = "brain2.location.device"
        static let lastUploadAt = "brain2.location.lastUploadAt"
        static let lastError = "brain2.location.lastError"
        static let dropped = "brain2.location.dropped"
    }

    private let manager = CLLocationManager()
    private let work = DispatchQueue(label: "brain2.location")
    private let defaults = UserDefaults.standard
    private var uploading = false
    private var permissionWaiters: [(String) -> Void] = []

    private override init() {
        super.init()
        manager.delegate = self
    }

    // MARK: Settings

    func configure(uploadUrl: String, token: String, publicKey: String) {
        defaults.set(uploadUrl, forKey: Key.uploadUrl)
        defaults.set(token, forKey: Key.token)
        defaults.set(publicKey, forKey: Key.publicKey)
    }

    private var isConfigured: Bool {
        guard let url = defaults.string(forKey: Key.uploadUrl), URL(string: url) != nil else { return false }
        return !(defaults.string(forKey: Key.token) ?? "").isEmpty && !(defaults.string(forKey: Key.publicKey) ?? "").isEmpty
    }

    private var deviceId: String {
        if let id = defaults.string(forKey: Key.device) { return id }
        let id = UUID().uuidString
        defaults.set(id, forKey: Key.device)
        return id
    }

    // MARK: Permission

    static func permissionName(_ status: CLAuthorizationStatus) -> String {
        switch status {
        case .authorizedAlways: return "always"
        case .authorizedWhenInUse: return "whenInUse"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    /// "While Using" first, then "Always". iOS may show the Always prompt later,
    /// so this answers on the next change or after 20 seconds, whichever is first.
    func requestPermission(_ done: @escaping (String) -> Void) {
        DispatchQueue.main.async {
            let status = self.manager.authorizationStatus
            switch status {
            case .authorizedAlways, .denied, .restricted:
                done(Self.permissionName(status))
                return
            case .notDetermined:
                self.manager.requestWhenInUseAuthorization()
            default:
                self.manager.requestAlwaysAuthorization()
            }
            self.permissionWaiters.append(done)
            DispatchQueue.main.asyncAfter(deadline: .now() + 20) { self.answerPermissionWaiters() }
        }
    }

    private func answerPermissionWaiters() {
        let waiters = permissionWaiters
        permissionWaiters = []
        let name = Self.permissionName(manager.authorizationStatus)
        waiters.forEach { $0(name) }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        // Got "While Using": ask for the upgrade now, while the person is here.
        if status == .authorizedWhenInUse && !permissionWaiters.isEmpty {
            manager.requestAlwaysAuthorization()
            return
        }
        if status != .notDetermined { answerPermissionWaiters() }
    }

    // MARK: Start / stop

    func start() {
        defaults.set(true, forKey: Key.enabled)
        DispatchQueue.main.async { self.beginMonitoring() }
    }

    func stop() {
        defaults.set(false, forKey: Key.enabled)
        DispatchQueue.main.async {
            self.manager.stopMonitoringSignificantLocationChanges()
            self.manager.stopMonitoringVisits()
        }
    }

    /// Call at every launch, including a background relaunch for a location event.
    func resumeIfEnabled() {
        guard defaults.bool(forKey: Key.enabled) else { return }
        DispatchQueue.main.async { self.beginMonitoring() }
    }

    private func beginMonitoring() {
        guard CLLocationManager.significantLocationChangeMonitoringAvailable() else {
            defaults.set("significant-change monitoring is not available on this device", forKey: Key.lastError)
            return
        }
        manager.allowsBackgroundLocationUpdates = true
        manager.pausesLocationUpdatesAutomatically = false
        manager.startMonitoringSignificantLocationChanges()
        manager.startMonitoringVisits()
    }

    // MARK: Events

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let events = locations
            .filter { $0.horizontalAccuracy >= 0 }
            .map { loc in
                QueuedLocationEvent(
                    id: UUID().uuidString,
                    type: "point",
                    at: Self.ms(loc.timestamp),
                    arriveAt: nil,
                    departAt: nil,
                    lat: loc.coordinate.latitude,
                    lon: loc.coordinate.longitude,
                    acc: loc.horizontalAccuracy
                )
            }
        enqueue(events)
    }

    func locationManager(_ manager: CLLocationManager, didVisit visit: CLVisit) {
        let arrive = visit.arrivalDate == Date.distantPast ? nil : Self.ms(visit.arrivalDate)
        let depart = visit.departureDate == Date.distantFuture ? nil : Self.ms(visit.departureDate)
        guard arrive != nil || depart != nil else { return }
        enqueue([QueuedLocationEvent(
            id: UUID().uuidString,
            type: "visit",
            at: nil,
            arriveAt: arrive,
            departAt: depart,
            lat: visit.coordinate.latitude,
            lon: visit.coordinate.longitude,
            acc: visit.horizontalAccuracy >= 0 ? visit.horizontalAccuracy : nil
        )])
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        defaults.set(error.localizedDescription, forKey: Key.lastError)
    }

    private static func ms(_ date: Date) -> Double {
        (date.timeIntervalSince1970 * 1000).rounded()
    }

    // MARK: Queue file

    private var queueURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("brain2-location-queue.json")
    }

    /// Events that arrived while the queue file could not be read (locked phone). Merged on the next write.
    private var pending: [QueuedLocationEvent] = []

    /// nil means the file is there but cannot be read now; callers must not overwrite it.
    /// A file that reads but will not decode is moved aside, so it is kept, not wiped.
    private func readQueue() -> [QueuedLocationEvent]? {
        let url = queueURL
        guard FileManager.default.fileExists(atPath: url.path) else { return [] }
        guard let data = try? Data(contentsOf: url) else { return nil }
        if let events = try? JSONDecoder().decode([QueuedLocationEvent].self, from: data) { return events }
        let aside = url.deletingLastPathComponent().appendingPathComponent("brain2-location-queue.bad-\(Self.ms(Date())).json")
        try? FileManager.default.moveItem(at: url, to: aside)
        return []
    }

    private func writeQueue(_ events: [QueuedLocationEvent]) {
        guard let data = try? JSONEncoder().encode(events) else { return }
        // Readable after the first unlock, so a background wake on a locked phone can still append.
        try? data.write(to: queueURL, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }

    private func enqueue(_ events: [QueuedLocationEvent]) {
        guard !events.isEmpty else { return }
        work.async {
            guard let existing = self.readQueue() else {
                self.pending += events
                if self.pending.count > Self.maxQueued { self.pending.removeFirst(self.pending.count - Self.maxQueued) }
                return
            }
            var queue = existing + self.pending + events
            self.pending = []
            if queue.count > Self.maxQueued {
                let over = queue.count - Self.maxQueued
                queue.removeFirst(over)
                self.defaults.set(self.defaults.integer(forKey: Key.dropped) + over, forKey: Key.dropped)
            }
            self.writeQueue(queue)
            self.flushOnWorkQueue(nil)
        }
    }

    // MARK: Upload

    func flush(_ done: ((Bool) -> Void)? = nil) {
        work.async { self.flushOnWorkQueue(done) }
    }

    /// Sends one batch. On success, sends the next until the queue is empty.
    private func flushOnWorkQueue(_ done: ((Bool) -> Void)?) {
        guard !uploading else { done?(false); return }
        guard let queue = readQueue() else { done?(false); return }
        guard !queue.isEmpty else { done?(true); return }
        guard isConfigured,
              let url = URL(string: defaults.string(forKey: Key.uploadUrl) ?? ""),
              let token = defaults.string(forKey: Key.token),
              let publicKey = defaults.string(forKey: Key.publicKey) else {
            done?(false)
            return
        }

        let batch = Array(queue.prefix(Self.batchSize))
        let request: URLRequest
        do {
            let body = LocationBatchBody(v: 1, kind: "location", device: deviceId, sentAt: Self.ms(Date()), events: batch)
            let sealed = try CaptureSealer.seal(publicKeyBase64: publicKey, plaintext: try JSONEncoder().encode(body))
            var req = URLRequest(url: url, timeoutInterval: 30)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            req.httpBody = try JSONSerialization.data(withJSONObject: ["kind": "location", "sealed": sealed])
            request = req
        } catch {
            defaults.set("could not seal: \(error)", forKey: Key.lastError)
            done?(false)
            return
        }

        uploading = true
        var task = UIBackgroundTaskIdentifier.invalid
        task = UIApplication.shared.beginBackgroundTask(withName: "brain2-location-upload") {
            UIApplication.shared.endBackgroundTask(task)
            task = .invalid
        }
        URLSession.shared.dataTask(with: request) { _, response, error in
            self.work.async {
                self.uploading = false
                let status = (response as? HTTPURLResponse)?.statusCode ?? 0
                let ok = (200..<300).contains(status)
                if ok {
                    let sent = Set(batch.map { $0.id })
                    // Unreadable now: leave the file; the sent events go again and the hub's ids dedupe them.
                    let rest = (self.readQueue() ?? []).filter { !sent.contains($0.id) }
                    if self.readQueue() != nil { self.writeQueue(rest) }
                    self.defaults.set(Self.ms(Date()), forKey: Key.lastUploadAt)
                    self.defaults.removeObject(forKey: Key.lastError)
                    if !rest.isEmpty { self.flushOnWorkQueue(nil) }
                } else {
                    let why = error?.localizedDescription ?? "HTTP \(status)"
                    self.defaults.set("upload failed: \(why)", forKey: Key.lastError)
                }
                done?(ok)
                if task != .invalid {
                    UIApplication.shared.endBackgroundTask(task)
                    task = .invalid
                }
            }
        }.resume()
    }

    // MARK: Status

    func status(_ done: @escaping ([String: Any]) -> Void) {
        DispatchQueue.main.async {
            let permission = Self.permissionName(self.manager.authorizationStatus)
            self.work.async {
                var out: [String: Any] = [
                    "permission": permission,
                    "recording": self.defaults.bool(forKey: Key.enabled),
                    "configured": self.isConfigured,
                    "queued": (self.readQueue()?.count ?? 0) + self.pending.count,
                    "dropped": self.defaults.integer(forKey: Key.dropped),
                ]
                let last = self.defaults.double(forKey: Key.lastUploadAt)
                if last > 0 { out["lastUploadAt"] = last }
                if let error = self.defaults.string(forKey: Key.lastError) { out["lastError"] = error }
                done(out)
            }
        }
    }
}

// MARK: - Capacitor plugin

@objc(LocationPlugin)
public class LocationPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LocationPlugin"
    public let jsName = "BrainLocation"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "flush", returnType: CAPPluginReturnPromise),
    ]

    @objc func getStatus(_ call: CAPPluginCall) {
        LocationRecorder.shared.status { call.resolve($0) }
    }

    @objc func configure(_ call: CAPPluginCall) {
        guard let url = call.getString("uploadUrl"), URL(string: url) != nil,
              let token = call.getString("token"), !token.isEmpty,
              let key = call.getString("publicKey"), !key.isEmpty else {
            call.reject("uploadUrl, token and publicKey are required")
            return
        }
        LocationRecorder.shared.configure(uploadUrl: url, token: token, publicKey: key)
        call.resolve()
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        LocationRecorder.shared.requestPermission { call.resolve(["permission": $0]) }
    }

    @objc func start(_ call: CAPPluginCall) {
        LocationRecorder.shared.start()
        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        LocationRecorder.shared.stop()
        call.resolve()
    }

    @objc func flush(_ call: CAPPluginCall) {
        LocationRecorder.shared.flush { call.resolve(["ok": $0]) }
    }
}
