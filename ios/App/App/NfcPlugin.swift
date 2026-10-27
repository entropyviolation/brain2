//
//  NfcPlugin.swift — Read a blank sticker's hardware id (jsName "BrainNfc")
//
//  Shortcuts binds that id in a Personal Automation. This session reads the
//  same id and hands it to JS. The sticker stays blank: there is no NDEF
//  text to parse, and this plugin does not write the chip.
//
//  Core NFC needs the NFC Tag Reading capability on com.cogs.mobile, plus
//  NFCReaderUsageDescription. The Simulator cannot scan. A free provisioning
//  profile cannot either.
//
//  JS side: lib/mobile/nfc-bridge.ts. Registered in AppViewController.swift.
//

import Capacitor
import CoreNFC
import Foundation

@objc(NfcPlugin)
public class NfcPlugin: CAPPlugin, CAPBridgedPlugin, NFCTagReaderSessionDelegate {
    public let identifier = "NfcPlugin"
    public let jsName = "BrainNfc"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
    ]

    private var session: NFCTagReaderSession?
    private var pending: CAPPluginCall?
    /// The session we just invalidated on purpose. Its callback must not fail the new scan.
    private var dropping = false

    @objc func scan(_ call: CAPPluginCall) {
        guard NFCTagReaderSession.readingAvailable else {
            call.reject("NFC reading is not available on this device.")
            return
        }
        DispatchQueue.main.async {
            if self.session != nil {
                self.dropping = true
                self.pending?.reject("Canceled")
                self.pending = nil
                self.session?.invalidate()
            }
            let next = NFCTagReaderSession(pollingOption: [.iso14443, .iso15693, .iso18092], delegate: self, queue: nil)
            next?.alertMessage = "Hold the phone on the sticker."
            self.pending = call
            self.session = next
            next?.begin()
        }
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

    private func finish(id: String) {
        pending?.resolve(["id": id])
        pending = nil
    }

    private func finish(error: String) {
        pending?.reject(error)
        pending = nil
    }
}
