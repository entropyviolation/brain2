#!/usr/bin/env node
// Decrypt one encrypted backup back to a .tar.gz next to it.
// Usage: node scripts/backup-open.mjs <brain2-data-….tar.gz.b2enc> [privateKeyFile]
// Key: argv 2, else COGS_BACKUP_PRIVATE_KEY, else ~/.brain2/backup-private.key
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { ENCRYPTED_SUFFIX, decryptFile } from "./backup-crypt.mjs"

const input = process.argv[2]
if (!input || !input.endsWith(ENCRYPTED_SUFFIX)) {
  console.error(`Usage: node scripts/backup-open.mjs <file${ENCRYPTED_SUFFIX}> [privateKeyFile]`)
  process.exit(1)
}
const keyFile = process.argv[3] || path.join(os.homedir(), ".brain2", "backup-private.key")
const key = (process.env.COGS_BACKUP_PRIVATE_KEY || "").trim() || (fs.existsSync(keyFile) ? fs.readFileSync(keyFile, "utf8").trim() : "")
if (!key) {
  console.error(`No private key. Pass the key file, or put it at ${keyFile}.`)
  process.exit(1)
}
const output = input.slice(0, -ENCRYPTED_SUFFIX.length)
if (fs.existsSync(output)) {
  console.error(`Refusing to overwrite ${output}.`)
  process.exit(1)
}
try {
  decryptFile(key, input, output)
} catch (e) {
  console.error(`Could not open ${input}: ${e.message}. Wrong key, or the file is damaged.`)
  process.exit(1)
}
console.log(`Opened -> ${output}`)
