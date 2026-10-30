//
//  NfcPlugin.swift — BrainNfc: scan a sticker, or read and write one text record
//
//  scan returns the hardware id. The logging card uses that id and leaves the
//  chip blank. read and write use one NDEF text record for the phone's testing
//  settings (hub URL, token, sync URL). Same plugin, no second stack.
//
//  Core NFC needs the NFC Tag Reading capability on com.cogs.mobile, plus
//  NFCReaderUsageDescription. The Simulator cannot scan. A free provisioning
//  profile cannot either, and App.entitlements leaves that key out so a
//  personal team can still install the app.
//
//  JS side: lib/mobile/nfc-bridge.ts. Registered in AppViewController.swift.
//

import Capacitor
import CoreNFC
import Foundation

@objc(NfcPlugin)
public class NfcPlugin: CAPPlugin, CAPBridgedPlugin, NFCTagReaderSessionDelegate, NFCNDEFReaderSessionDelegate {
    public let identifier = "NfcPlugin"
    public let jsName = "BrainNfc"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
    ]

    private var session: NFCTagReaderSession?
    private var pending: CAPPluginCall?
    /// The tag session we just invalidated on purpose. Its callback must not fail the new call.
    private var dropping = false

    private enum NdefJob {
        case read
        case write(String)
    }

    private var ndefSession: NFCNDEFReaderSession?
    private var ndefJob: NdefJob?
    /// An NDEF session closed so a new one can start. Its callback must not fail the new call.
    private var retiredNdef: NFCNDEFReaderSession?

    @objc func scan(_ call: CAPPluginCall) {
        guard NFCTagReaderSession.readingAvailable else {
            call.reject("NFC reading is not available on this device.")
            return
        }
        DispatchQueue.main.async {
            self.beginTagScan(call)
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        guard NFCNDEFReaderSession.readingAvailable else {
            call.reject("NFC reading is not available on this device.")
            return
        }
        DispatchQueue.main.async {
            self.beginNdef(.read, call: call, alert: "Hold the phone on the sticker to read it.")
        }
    }

    @objc func write(_ call: CAPPluginCall) {
        let text = call.getString("text")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        guard !text.isEmpty else {
            call.reject("Nothing to write.")
            return
        }
        guard NFCNDEFReaderSession.readingAvailable else {
            call.reject("NFC reading is not available on this device.")
            return
        }
        DispatchQueue.main.async {
            self.beginNdef(.write(text), call: call, alert: "Hold the phone on the sticker to write settings.")
        }
    }

    private func beginTagScan(_ call: CAPPluginCall) {
        let busy = session != nil || ndefSession != nil
        if session != nil {
            dropping = true
            session?.invalidate()
        }
        retireNdef()
        if busy {
            pending?.reject("Canceled")
            pending = nil
        }
        let next = NFCTagReaderSession(pollingOption: [.iso14443, .iso15693, .iso18092], delegate: self, queue: nil)
        next?.alertMessage = "Hold the phone on the sticker."
        pending = call
        session = next
        next?.begin()
    }

    private func beginNdef(_ job: NdefJob, call: CAPPluginCall, alert: String) {
        let busy = session != nil || ndefSession != nil
        if session != nil {
            dropping = true
            session?.invalidate()
        }
        retireNdef()
        if busy {
            pending?.reject("Canceled")
            pending = nil
        }
        let next = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: false)
        next.alertMessage = alert
        ndefJob = job
        pending = call
        ndefSession = next
        next.begin()
    }

    private func retireNdef() {
        guard let live = ndefSession else { return }
        retiredNdef = live
        ndefSession = nil
        ndefJob = nil
        live.invalidate()
    }

    public func tagReaderSessionDidBecomeActive(_ session: NFCTagReaderSession) {}

    public func tagReaderSession(_ session: NFCTagReaderSession, didInvalidateWithError error: Error) {
        if dropping {
            dropping = false
            if self.session === session { self.session = nil }
            return
        }
        let code = (error as? NFCReaderError)?.code
        if code == .readerSessionInvalidationErrorUserCanceled {
            finish(error: "Canceled")
        } else if pending != nil {
            finish(error: error.localizedDescription)
        }
        if self.session === session { self.session = nil }
    }

    public func tagReaderSession(_ session: NFCTagReaderSession, didDetect tags: [NFCTag]) {
        guard tags.count == 1, let tag = tags.first else {
            session.restartPolling()
            return
        }
        session.connect(to: tag) { error in
            if let error {
                session.invalidate(errorMessage: error.localizedDescription)
                self.finish(error: error.localizedDescription)
                return
            }
            let id = Self.identifierHex(tag)
            guard !id.isEmpty else {
                session.invalidate(errorMessage: "This sticker has no id.")
                self.finish(error: "This sticker has no id.")
                return
            }
            session.alertMessage = "Got it."
            self.finish(id: id)
            session.invalidate()
        }
    }

    public func readerSessionDidBecomeActive(_ session: NFCNDEFReaderSession) {}

    public func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        if session === retiredNdef {
            retiredNdef = nil
            return
        }
        if ndefSession === session {
            ndefSession = nil
            ndefJob = nil
        }
        guard pending != nil else { return }
        let code = (error as? NFCReaderError)?.code
        if code == .readerSessionInvalidationErrorUserCanceled {
            finish(error: "Canceled")
        } else {
            finish(error: error.localizedDescription)
        }
    }

    public func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {}

    public func readerSession(_ session: NFCNDEFReaderSession, didDetect tags: [NFCNDEFTag]) {
        guard tags.count == 1, let tag = tags.first else {
            session.alertMessage = "Hold still on one sticker."
            session.restartPolling()
            return
        }
        session.connect(to: tag) { error in
            if let error {
                session.invalidate(errorMessage: error.localizedDescription)
                self.finish(error: error.localizedDescription)
                return
            }
            tag.queryNDEFStatus { status, capacity, error in
                if let error {
                    session.invalidate(errorMessage: error.localizedDescription)
                    self.finish(error: error.localizedDescription)
                    return
                }
                switch self.ndefJob {
                case .read:
                    self.readText(session, tag: tag, status: status)
                case .write(let text):
                    self.writeText(session, tag: tag, status: status, capacity: capacity, text: text)
                case nil:
                    session.invalidate(errorMessage: "Nothing to do.")
                    self.finish(error: "Nothing to do.")
                }
            }
        }
    }

    private func readText(_ session: NFCNDEFReaderSession, tag: NFCNDEFTag, status: NFCNDEFStatus) {
        if status == .notSupported {
            session.alertMessage = "This sticker has no message."
            finishRead(text: "")
            session.invalidate()
            return
        }
        tag.readNDEF { message, error in
            if let error {
                if Self.isBlank(error) {
                    session.alertMessage = "Blank sticker."
                    self.finishRead(text: "")
                    session.invalidate()
                    return
                }
                session.invalidate(errorMessage: error.localizedDescription)
                self.finish(error: error.localizedDescription)
                return
            }
            let text = Self.text(from: message)
            session.alertMessage = text.isEmpty ? "Blank sticker." : "Read."
            self.finishRead(text: text)
            session.invalidate()
        }
    }

    private func writeText(_ session: NFCNDEFReaderSession, tag: NFCNDEFTag, status: NFCNDEFStatus, capacity: Int, text: String) {
        if status == .notSupported {
            session.invalidate(errorMessage: "This sticker cannot hold a message.")
            finish(error: "This sticker cannot hold a message.")
            return
        }
        if status == .readOnly {
            session.invalidate(errorMessage: "This sticker is locked.")
            finish(error: "This sticker is locked.")
            return
        }
        guard let payload = NFCNDEFPayload.wellKnownTypeTextPayload(string: text, locale: Locale(identifier: "en")) else {
            session.invalidate(errorMessage: "Could not encode that text.")
            finish(error: "Could not encode that text.")
            return
        }
        let message = NFCNDEFMessage(records: [payload])
        if capacity > 0 && message.length > capacity {
            session.invalidate(errorMessage: "This sticker is too small for these settings.")
            finish(error: "This sticker is too small for these settings.")
            return
        }
        tag.writeNDEF(message) { error in
            if let error {
                session.invalidate(errorMessage: error.localizedDescription)
                self.finish(error: error.localizedDescription)
                return
            }
            session.alertMessage = "Written."
            self.finishWrite()
            session.invalidate()
        }
    }

    /// Hardware id, lowercase hex, no separators. Empty when the tag has none.
    static func identifierHex(_ tag: NFCTag) -> String {
        let data: Data
        switch tag {
        case .miFare(let tag):
            data = tag.identifier
        case .iso15693(let tag):
            data = tag.identifier
        case .iso7816(let tag):
            data = tag.identifier
        case .feliCa(let tag):
            data = tag.currentIDm
        @unknown default:
            data = Data()
        }
        return data.map { String(format: "%02x", $0) }.joined()
    }

    private static func isBlank(_ error: Error) -> Bool {
        (error as? NFCReaderError)?.code == .ndefReaderSessionErrorZeroLengthMessage
    }

    private static func text(from message: NFCNDEFMessage?) -> String {
        guard let message else { return "" }
        let parts = message.records.compactMap { record -> String? in
            guard record.typeNameFormat == .nfcWellKnown else { return nil }
            let (text, _) = record.wellKnownTypeTextPayload()
            let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return trimmed.isEmpty ? nil : trimmed
        }
        return parts.joined(separator: "\n")
    }

    private func finish(id: String) {
        pending?.resolve(["id": id])
        pending = nil
    }

    private func finishRead(text: String) {
        pending?.resolve(["text": text])
        pending = nil
        ndefJob = nil
    }

    private func finishWrite() {
        pending?.resolve()
        pending = nil
        ndefJob = nil
    }

    private func finish(error: String) {
        pending?.reject(error)
        pending = nil
        ndefJob = nil
    }
}
