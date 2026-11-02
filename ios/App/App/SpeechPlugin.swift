//
//  SpeechPlugin.swift — BrainSpeech: dictation for the keycap keyboard
//
//  The keycap deck replaces the system keyboard, and with it the system mic.
//  start listens through the microphone and sends "partial" events with the
//  words heard so far, and "end" when listening stops on its own or by stop.
//  stop ends listening and resolves the final words.
//  Recognition prefers the phone itself (on-device) when the model is there.
//
//  After a pause iOS starts a fresh transcript, and `formattedString` holds
//  only the new words. The words before the pause are kept in `committed`, so
//  "hello", a pause, then "world" reads "hello world", not "world".
//  Once both permissions are granted, start skips asking and begins at once,
//  and the audio session is set up only the first time.
//
//  Needs NSMicrophoneUsageDescription and NSSpeechRecognitionUsageDescription.
//
//  JS side: lib/mobile/speech-bridge.ts. Registered in AppViewController.swift.
//

import AVFoundation
import Capacitor
import Foundation
import Speech

@objc(SpeechPlugin)
public class SpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechPlugin"
    public let jsName = "BrainSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let engine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var heard = ""
    /// Words from transcripts that ended at a pause.
    private var committed = ""
    /// The transcript iOS is still revising.
    private var segment = ""
    private var lastPartial = Date.distantPast
    private var sessionReady = false
    private var stopping: CAPPluginCall?

    @objc func start(_ call: CAPPluginCall) {
        if SFSpeechRecognizer.authorizationStatus() == .authorized && micGranted() {
            DispatchQueue.main.async { self.beginNow(call) }
            return
        }
        SFSpeechRecognizer.requestAuthorization { status in
            guard status == .authorized else {
                call.reject("Speech recognition is off for BRAIN2 in Settings.")
                return
            }
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                DispatchQueue.main.async {
                    guard granted else {
                        call.reject("The microphone is off for BRAIN2 in Settings.")
                        return
                    }
                    self.beginNow(call)
                }
            }
        }
    }

    private func beginNow(_ call: CAPPluginCall) {
        do {
            try begin()
            call.resolve()
        } catch {
            finish()
            call.reject(error.localizedDescription)
        }
    }

    private func micGranted() -> Bool {
        if #available(iOS 17.0, *) {
            return AVAudioApplication.shared.recordPermission == .granted
        }
        return AVAudioSession.sharedInstance().recordPermission == .granted
    }

    /// A pause ended the last transcript when a partial arrives after a gap and
    /// starts on a different word. A revision keeps its first word.
    private func startsNewTranscript(_ next: String, gap: TimeInterval) -> Bool {
        guard !segment.isEmpty, !next.isEmpty, gap >= 0.7 else { return false }
        return firstWord(next) != firstWord(segment)
    }

    private func firstWord(_ text: String) -> String {
        let word = text.split(whereSeparator: { $0.isWhitespace }).first.map(String.init) ?? ""
        return word.lowercased().trimmingCharacters(in: .punctuationCharacters)
    }

    private func joined(_ head: String, _ tail: String) -> String {
        if head.isEmpty { return tail }
        if tail.isEmpty { return head }
        return head + " " + tail
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.task != nil else {
                call.resolve(["text": self.heard])
                return
            }
            self.stopping = call
            self.engine.stop()
            self.engine.inputNode.removeTap(onBus: 0)
            self.request?.endAudio()
            // The final result usually lands within a moment. Do not wait forever.
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                if self.stopping === call { self.finish() }
            }
        }
    }

    private func begin() throws {
        finish()
        guard let recognizer = SFSpeechRecognizer(locale: Locale.current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US")),
              recognizer.isAvailable else {
            throw NSError(domain: "BrainSpeech", code: 1, userInfo: [NSLocalizedDescriptionKey: "Dictation is not available right now."])
        }
        let session = AVAudioSession.sharedInstance()
        if !sessionReady {
            try session.setCategory(.playAndRecord, mode: .measurement, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth])
            sessionReady = true
        }
        try session.setActive(true)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
        self.request = request
        heard = ""
        committed = ""
        segment = ""
        lastPartial = Date()

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak request] buffer, _ in
            request?.append(buffer)
        }
        engine.prepare()
        try engine.start()

        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self else { return }
                if let result {
                    let next = result.bestTranscription.formattedString
                    let now = Date()
                    if self.startsNewTranscript(next, gap: now.timeIntervalSince(self.lastPartial)) {
                        self.committed = self.joined(self.committed, self.segment)
                    }
                    self.lastPartial = now
                    self.segment = next
                    self.heard = self.joined(self.committed, next)
                    self.notifyListeners("partial", data: ["text": self.heard])
                }
                if error != nil || result?.isFinal == true { self.finish() }
            }
        }
    }

    /// Ends listening and settles a pending stop with the words heard.
    private func finish() {
        if engine.isRunning { engine.stop() }
        engine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        let wasListening = task != nil
        task?.cancel()
        task = nil
        request = nil
        if wasListening { notifyListeners("end", data: ["text": heard]) }
        if let call = stopping {
            stopping = nil
            call.resolve(["text": heard])
        }
    }
}
