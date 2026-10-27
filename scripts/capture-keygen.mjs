#!/usr/bin/env node
/**
 * Make the capture-box key pair. The PRIVATE key goes in a file outside the repo
 * (mode 600) and never leaves your devices. Only the PUBLIC key goes to the VM.
 * Lose the private key and queued texts cannot be read: back it up (password manager).
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateKeyPair } from "./sealed-box.mjs"

const dir = path.join(os.homedir(), ".brain2")
const file = path.join(dir, "capture-private.key")
if (fs.existsSync(file)) {
  console.error(`Refusing to overwrite ${file}. Move it first if you really want a new key.`)
  process.exit(1)
}
fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
const { publicKey, privateKey } = generateKeyPair()
fs.writeFileSync(file, privateKey + "\n", { mode: 0o600 })
console.log(`Private key written to ${file} (keep it off the VM, back it up).`)
console.log(`\nPut this PUBLIC key on the VM as BRAIN2_CAPTURE_PUBLIC_KEY:\n${publicKey}`)
