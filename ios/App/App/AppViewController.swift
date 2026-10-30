//
//  AppViewController.swift — The Capacitor bridge, plus Brain2's app-local plugins
//
//  Main.storyboard uses this class instead of CAPBridgeViewController.
//  Capacitor 7 finds npm plugins on its own; plugins that live in this app
//  target are registered here.
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
    override func router() -> Router {
        StaticExportRouter()
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LocationPlugin())
        bridge?.registerPluginInstance(NfcPlugin())
        bridge?.registerPluginInstance(HealthPlugin())
    }
}
