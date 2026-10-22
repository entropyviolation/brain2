//
//  AppViewController.swift — The Capacitor bridge, plus Brain2's app-local plugins
//
//  Main.storyboard uses this class instead of CAPBridgeViewController.
//  Capacitor 7 finds npm plugins on its own; plugins that live in this app
//  target are registered here.
//

import Capacitor
import UIKit

class AppViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(LocationPlugin())
    }
}
