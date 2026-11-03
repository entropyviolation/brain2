/**
 * electron/external-url.js — Which URLs the desktop shell may load or hand to the OS
 *
 * The app window keeps the preload bridge. A navigation or a child window must
 * stay on the app origin, or leave the process entirely (system browser, and
 * only for http/https). Login windows do not use this; they have their own
 * host lists and no preload.
 */

function isHttpUrl(target) {
  try {
    const parsed = new URL(target)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

/** `window.open("")` / print preview. Not an app document. */
function isBlankPopup(target) {
  return target == null || target === "" || target === "about:blank" || String(target).startsWith("about:blank")
}

/**
 * Top-level document the shell may stay on.
 * Dev: the Next server. Packaged: `app://local`.
 */
function isAppNavigationUrl(target, { isDev = false, devPort = "3000" } = {}) {
  let parsed
  try {
    parsed = new URL(target)
  } catch {
    return false
  }
  if (isDev) {
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false
    const host = parsed.hostname.toLowerCase()
    if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") return false
    const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80")
    return port === String(devPort)
  }
  return parsed.protocol === "app:" && parsed.hostname === "local"
}

/** Open http(s) in the system browser. Anything else is ignored. */
function openExternalWeb(shell, target) {
  if (!shell || typeof shell.openExternal !== "function" || !isHttpUrl(target)) return false
  try {
    shell.openExternal(new URL(target).href)
    return true
  } catch {
    return false
  }
}

module.exports = { isAppNavigationUrl, isBlankPopup, isHttpUrl, openExternalWeb }
