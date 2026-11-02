//
//  AppViewController.swift — The Capacitor bridge, plus Brain2's app-local plugins
//
//  Main.storyboard uses this class instead of CAPBridgeViewController.
//  Capacitor 7 finds npm plugins on its own; plugins that live in this app
//  target are registered here.
//
//  BrainKeyboard lives here too. While the keycap deck is up, the bottom edge
//  is deferred, so iOS stops holding taps on the bottom row while it checks
//  for a home swipe. Home then takes a second swipe, the same as a game.
//  JS side: lib/mobile/keyboard-bridge.ts.
//

import Capacitor
import UIKit

/// Serves the Next static export by its folders. Capacitor's own router sends
/// every path without an extension to the root `index.html`, so
/// `capacitor://localhost/mobile/` painted the desktop page and the phone shell
/// (and its Mac vault load) never ran.
struct StaticExportRouter: Router {
    var basePath: String = ""

    func route(for path: String) -> String {
        let pathUrl = URL(fileURLWithPath: path)
        guard pathUrl.pathExtension.isEmpty else { return basePath + path }
        let trimmed = path.hasSuffix("/") ? String(path.dropLast()) : path
        if !trimmed.isEmpty {
            for candidate in [trimmed + "/index.html", trimmed + ".html"] {
                if FileManager.default.fileExists(atPath: basePath + candidate) {
                    return basePath + candidate
                }
            }
        }
        return basePath + "/index.html"
    }
}

class AppViewController: CAPBridgeViewController {
    var deckOpen = false {
        didSet {
            guard deckOpen != oldValue else { return }
            setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
        }
    }

    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        deckOpen ? .bottom : []
    }

    override func router() -> Router {
        StaticExportRouter()
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LocationPlugin())
        bridge?.registerPluginInstance(NfcPlugin())
        bridge?.registerPluginInstance(HealthPlugin())
        bridge?.registerPluginInstance(SpeechPlugin())
        bridge?.registerPluginInstance(KeyboardPlugin())
    }
}

@objc(KeyboardPlugin)
public class KeyboardPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "KeyboardPlugin"
    public let jsName = "BrainKeyboard"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setDeck", returnType: CAPPluginReturnPromise),
    ]

    @objc func setDeck(_ call: CAPPluginCall) {
        let open = call.getBool("open") ?? false
        DispatchQueue.main.async {
            (self.bridge?.viewController as? AppViewController)?.deckOpen = open
            call.resolve()
        }
    }
}
