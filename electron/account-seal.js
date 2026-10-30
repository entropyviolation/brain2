/**
 * electron/account-seal.js — Login-host check and sealed account file.
 *
 * Instagram and Spotify each keep their own host list, file name, and IPC
 * channels. This is the part that matched: which host a login window may stay
 * on, and how a secret is sealed, opened, and written (mode 600, rename over
 * a temp file).
 */
const fs = require("fs")
const path = require("path")

function hostAllowed(url, hosts) {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return hosts.some((h) => host === h || host.endsWith(`.${h}`))
  } catch {
    return false
  }
}

function sealedAccountFile({ dir, fileName, cipher }) {
  const file = path.join(dir, fileName)

  function write(data) {
    fs.mkdirSync(dir, { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: "utf8", mode: 0o600 })
    fs.renameSync(tmp, file)
  }

  function seal(text) {
    if (!cipher.available()) throw new Error("No OS keychain encryption on this computer, so Brain2 will not store a login.")
    return cipher.encrypt(String(text)).toString("base64")
  }

  function open(sealed) {
    if (!sealed || !cipher.available()) return null
    try {
      return cipher.decrypt(Buffer.from(sealed, "base64"))
    } catch {
      return null
    }
  }

  return { file, write, seal, open }
}

module.exports = { hostAllowed, sealedAccountFile }
