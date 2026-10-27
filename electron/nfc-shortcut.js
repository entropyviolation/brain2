/**
 * electron/nfc-shortcut.js — Sign one saved NFC tag into a .shortcut file
 *
 * Settings → NFC tags asks for this after a tag is saved. The workflow is
 * built in scripts/build-iphone-phone-shortcuts.mjs (the id is already in the
 * text; a dose still asks how many). `shortcuts sign --mode anyone` is what
 * makes the iPhone accept the file. The signed bytes land in Downloads.
 */
const { app, ipcMain, shell } = require("electron")
const { execFile } = require("node:child_process")
const { accessSync, constants } = require("node:fs")
const { mkdtemp, readFile, rm, writeFile } = require("node:fs/promises")
const { tmpdir } = require("node:os")
const path = require("node:path")

/** MUST match electron/preload.js and electron/ipc/channels.js. */
const NFC_SIGN_SHORTCUT_IPC_CHANNEL = "cogs:nfc:signShortcut"

function macBin(name) {
  const candidate = path.join("/usr/bin", name)
  try {
    accessSync(candidate, constants.X_OK)
    return candidate
  } catch {
    return name
  }
}

function execFileAsync(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 25000 }, (err, _stdout, stderr) => {
      if (!err) {
        resolve()
        return
      }
      const detail = String(stderr || err.message || "")
        .replace(/\/Users\/\S+/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180)
      const wrapped = new Error(detail || "sign failed")
      wrapped.code = err.code
      reject(wrapped)
    })
  })
}

function signError(err) {
  const detail = err && err.message ? String(err.message) : ""
  if (err && err.code === "ENOENT") return "This Mac could not find the Shortcuts command."
  if (/timed out/i.test(detail)) return "Signing the shortcut timed out. Open the Shortcuts app once, then try again."
  return detail ? `Could not sign the shortcut. ${detail}` : "Could not sign the shortcut on this Mac."
}

function readSpec(raw) {
  if (!raw || typeof raw !== "object") return null
  const id = String(raw.id || "")
    .trim()
    .toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) return null
  const name = String(raw.name || id)
    .replace(/[\u0000-\u001f]/g, " ")
    .trim()
    .slice(0, 80) || id
  return { id, name, askQuantity: raw.askQuantity === true }
}

async function signBoundShortcut(spec) {
  if (process.platform !== "darwin") {
    return { ok: false, error: "Signing a Shortcut needs this Mac." }
  }
  const { buildBoundNfcWorkflow, nfcShortcutDownloadName } = await import(
    "../scripts/build-iphone-phone-shortcuts.mjs"
  )
  const workflow = buildBoundNfcWorkflow(spec)
  const filename = path.basename(nfcShortcutDownloadName(spec.name, spec.id))
  if (!workflow || !filename.endsWith(".shortcut") || filename.includes("..")) {
    return { ok: false, error: "That tag cannot be a shortcut." }
  }

  const dir = await mkdtemp(path.join(tmpdir(), "brain2-nfc-"))
  const jsonPath = path.join(dir, "workflow.json")
  const unsignedPath = path.join(dir, "unsigned.shortcut")
  const signedPath = path.join(dir, "signed.shortcut")
  try {
    await writeFile(jsonPath, JSON.stringify(workflow))
    await execFileAsync(macBin("plutil"), ["-convert", "binary1", "-o", unsignedPath, jsonPath])
    await execFileAsync(macBin("shortcuts"), [
      "sign",
      "--mode",
      "anyone",
      "--input",
      unsignedPath,
      "--output",
      signedPath,
    ])
    const bytes = await readFile(signedPath)
    if (!bytes.length) return { ok: false, error: "The signed shortcut was empty." }
    const dest = path.join(app.getPath("downloads"), filename)
    await writeFile(dest, bytes)
    shell.showItemInFolder(dest)
    return { ok: true, filename }
  } catch (err) {
    console.warn("[brain2] NFC shortcut sign failed:", err && err.message)
    return { ok: false, error: signError(err) }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

function registerNfcShortcutIpc() {
  ipcMain.handle(NFC_SIGN_SHORTCUT_IPC_CHANNEL, (_event, raw) => {
    const spec = readSpec(raw)
    if (!spec) return { ok: false, error: "That tag cannot be a shortcut." }
    return signBoundShortcut(spec)
  })
}

module.exports = { NFC_SIGN_SHORTCUT_IPC_CHANNEL, registerNfcShortcutIpc, readSpec }
