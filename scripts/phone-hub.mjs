#!/usr/bin/env node
/**
 * Node entry for `npm run phone:hub`. Loads the TypeScript hub via jiti so
 * `@/` aliases match the app. Polyfill first so Zustand persist can hydrate.
 */
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { installPhoneHubGlobals } from "./phone-hub-polyfill.mjs"

installPhoneHubGlobals()

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(here, "..")
const require = createRequire(import.meta.url)
const jiti = require("jiti")(path.join(here, "phone-hub.ts"), {
  alias: { "@": root },
  interopDefault: true,
  esmResolve: true,
})
jiti(path.join(here, "phone-hub.ts"))
