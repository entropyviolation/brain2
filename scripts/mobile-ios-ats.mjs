#!/usr/bin/env node
/**
 * Ensure the Capacitor iOS app can reach the LAN sync server over HTTP.
 * Idempotent — safe to run on every mobile:ios build.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const infoPlist = path.join(root, "ios", "App", "App", "Info.plist")

if (!fs.existsSync(infoPlist)) {
  console.log("[mobile-ios-ats] ios/ not present yet — skip (run mobile:ios:init first)")
  process.exit(0)
}

let plist = fs.readFileSync(infoPlist, "utf8")
if (plist.includes("NSAllowsLocalNetworking")) {
  console.log("[mobile-ios-ats] ATS local networking already enabled")
  process.exit(0)
}

const atsBlock = `	<key>NSAppTransportSecurity</key>
	<dict>
		<key>NSAllowsLocalNetworking</key>
		<true/>
		<key>NSAllowsArbitraryLoadsInWebContent</key>
		<true/>
	</dict>
`

if (!plist.includes("</dict>\n</plist>")) {
  console.warn("[mobile-ios-ats] unexpected Info.plist shape — patch skipped")
  process.exit(0)
}

plist = plist.replace("</dict>\n</plist>", `${atsBlock}</dict>\n</plist>`)
fs.writeFileSync(infoPlist, plist, "utf8")
console.log("[mobile-ios-ats] enabled NSAllowsLocalNetworking in Info.plist")
