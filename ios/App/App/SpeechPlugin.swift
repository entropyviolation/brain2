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
//  A late callback from an ended task is ignored, and an empty last result
//  never wipes the words heard.
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
    /// Bumps on every start, so a late callback from an older task is ignored.
    private var generation = 0
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
        // Set every time: other audio in the app may have changed the category,
        // and a mic with no valid input format crashes installTap.
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playAndRecord, mode: .measurement, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth])
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
        guard format.sampleRate > 0, format.channelCount > 0 else {
            self.request = nil
            throw NSError(domain: "BrainSpeech", code: 2, userInfo: [NSLocalizedDescriptionKey: "The microphone is busy. Try again in a moment."])
        }
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak request] buffer, _ in
            request?.append(buffer)
        }
        engine.prepare()
        try engine.start()

        generation += 1
        let mine = generation
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self, self.generation == mine else { return }
                if let result {
                    let next = result.bestTranscription.formattedString
                    // After stop the recognizer can report an empty last result.
                    // Never let it wipe words already heard.
                    if next.isEmpty && !self.heard.isEmpty {
                        if error != nil || result.isFinal { self.finish() }
                        return
                    }
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
        generation += 1
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
