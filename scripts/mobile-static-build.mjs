#!/usr/bin/env node
/**
 * Static export for the iOS app, beside a running `npm run dev`.
 *
 * Writes the LAN hub hint, then runs the same staged `next build` as
 * `npm run build` (`scripts/static-export-build.mjs`). Next's
 * `output: "export"` always compiles into `.next` (a custom distDir becomes
 * the export folder, not the compile folder). The dev server already owns
 * `.next`. The stage is `.mobile-build`; `out/` is copied back for Capacitor
 * (`webDir: "out"`).
 */
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { staticExportBuild } from "./static-export-build.mjs"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const hint = spawnSync("node", ["scripts/mobile-hub-hint.mjs"], { cwd: root, stdio: "inherit" })
if (hint.status !== 0) process.exit(hint.status ?? 1)

process.exit(staticExportBuild())
