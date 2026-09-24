/**
 * electron/user-data-path.js — Stable Electron userData folder
 *
 * Electron derives `userData` from package.json `name` (dev) or
 * electron-builder `productName` (packaged). Renaming the product to BRAIN2
 * created `~/Library/Application Support/brain2` and left the live vault in
 * `cogs`. Pin the historical folder so a brand rename cannot orphan lists,
 * habits, tracking, or notes.
 *
 * The git/checkout folder name is independent. The checkout is `brain2`
 * (it was `cogs copy`). That rename does not move this vault. Never point
 * userData at the repo directory.
 */
const path = require("path")

/** Historical Application Support folder. Never derive this from package.json. */
const ELECTRON_VAULT_DIR_NAME = "cogs"

function resolveElectronUserData(appDataDir) {
  return path.join(appDataDir, ELECTRON_VAULT_DIR_NAME)
}

module.exports = { ELECTRON_VAULT_DIR_NAME, resolveElectronUserData }
