import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Capacitor config for packaging the /mobile Home shell as a native iOS app.
 *
 * Build flow:
 *   npm run mobile:ios
 *   builds the static site beside `npm run dev`, syncs ios/, and launches
 *   an iPhone Simulator. A physical iPhone is Xcode → Signing → Run.
 */
const config: CapacitorConfig = {
  appId: "com.cogs.mobile",
  appName: "BRAIN2",
  webDir: "out",
  server: {
    // Open the mobile Home shell (not the full desktop tab bar).
    appStartPath: "mobile/",
    androidScheme: "https",
    iosScheme: "capacitor",
  },
}

export default config
