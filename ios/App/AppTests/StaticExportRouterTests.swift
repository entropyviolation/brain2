//
//  StaticExportRouterTests.swift — Path mapping for the Next static export
//
//  **Planned.** There is no XCTest target yet. To run this: in Xcode, File →
//  New → Target → Unit Testing Bundle, name it `AppTests`, host application
//  `App`, then add this file to it. Run with ⌘U on an iPhone Simulator.
//  See `docs/MOBILE_TEST_PLAN.md`.
//

import XCTest
@testable import App

final class StaticExportRouterTests: XCTestCase {
    private var root: URL!

    override func setUpWithError() throws {
        root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        for page in ["index.html", "mobile/index.html", "mobile/nfc/index.html", "mobile/hub/index.html", "about.html"] {
            let file = root.appendingPathComponent(page)
            try FileManager.default.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
            try Data("<html></html>".utf8).write(to: file)
        }
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: root)
    }

    private func route(_ path: String) -> String {
        StaticExportRouter(basePath: root.path).route(for: path)
    }

    func testFolderPagesGetTheirOwnIndex() {
        XCTAssertEqual(route("/mobile/"), root.path + "/mobile/index.html")
        XCTAssertEqual(route("/mobile"), root.path + "/mobile/index.html")
        XCTAssertEqual(route("/mobile/nfc/"), root.path + "/mobile/nfc/index.html")
        XCTAssertEqual(route("/mobile/hub/"), root.path + "/mobile/hub/index.html")
    }

    func testFlatHtmlPage() {
        XCTAssertEqual(route("/about"), root.path + "/about.html")
    }

    func testRootAndUnknownFallBackToTheDesk() {
        XCTAssertEqual(route("/"), root.path + "/index.html")
        XCTAssertEqual(route(""), root.path + "/index.html")
        XCTAssertEqual(route("/no-such-page/"), root.path + "/index.html")
    }

    func testFilesWithAnExtensionPassThrough() {
        XCTAssertEqual(route("/mobile-hub.json"), root.path + "/mobile-hub.json")
        XCTAssertEqual(route("/_next/static/chunks/app.js"), root.path + "/_next/static/chunks/app.js")
    }
}
