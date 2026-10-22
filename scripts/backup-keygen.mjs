#!/usr/bin/env node
/**
 * Make the backup key pair. The nightly job reads only the PUBLIC key
 * (~/.brain2/backup-public.key). The PRIVATE key opens the backups: keep a copy
 * offline (password manager, USB stick), never next to the backups themselves.
 */
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { generateKeyPair } from "./sealed-box.mjs"

const dir = path.join(os.homedir(), ".brain2")
const pubFile = path.join(dir, "backup-public.key")
const privFile = path.join(dir, "backup-private.key")
for (const f of [pubFile, privFile]) {
  if (fs.existsSync(f)) {
    console.error(`Refusing to overwrite ${f}. Move it first if you really want a new key.`)
    process.exit(1)
  }
}
fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
const { publicKey, privateKey } = generateKeyPair()
fs.writeFileSync(privFile, privateKey + "\n", { mode: 0o600 })
fs.writeFileSync(pubFile, publicKey + "\n", { mode: 0o644 })
console.log(`Public key written to ${pubFile}. Nightly backups are encrypted from now on.`)
console.log(`Private key written to ${privFile}.`)
console.log("Copy the private key somewhere offline now. Without it no encrypted backup can be opened.")
