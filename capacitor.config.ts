import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor config for packaging the /mobile Home shell as a native iOS app.
 *
 * Build flow:
 *   1. npm run build
 *   2. npm run mobile:cap:sync
 *   3. npm run mobile:ios  (opens Xcode — Run on your device to sideload)
 */
const config: CapacitorConfig = {
  appId: "com.cogs.mobile",
  appName: "COGS Home",
  webDir: "out",
  server: {
    // Open the mobile Home shell (not the full desktop tab bar).
    appStartPath: "mobile/",
    androidScheme: "https",
    iosScheme: "capacitor",
  },
}

export default config
