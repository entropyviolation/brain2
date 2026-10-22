/**
 * scripts/backup-crypt.mjs — Encrypt a backup file to a public key, decrypt it with the private one
 *
 * The nightly job holds only the PUBLIC key, so it needs no secret to run, and a
 * backup copied to iCloud or a drive is unreadable without the private key.
 * Same recipe as sealed-box.mjs (X25519 ephemeral key + HKDF-SHA256 + AES-256-GCM),
 * but streamed in chunks so a large vault never sits in memory.
 *
 * File form: "B2E1" | u16 epk length | epk (spki DER) | iv (12) | ciphertext | tag (16)
 */
import crypto from "node:crypto"
import fs from "node:fs"

export const MAGIC = Buffer.from("B2E1")
export const ENCRYPTED_SUFFIX = ".b2enc"
const INFO = Buffer.from("brain2-backup-v1")
const CHUNK = 1024 * 1024
const TAG_LEN = 16

const publicObject = (b64) => crypto.createPublicKey({ key: Buffer.from(b64.trim(), "base64"), format: "der", type: "spki" })
const privateObject = (b64) => crypto.createPrivateKey({ key: Buffer.from(b64.trim(), "base64"), format: "der", type: "pkcs8" })
const spki = (keyObject) => keyObject.export({ type: "spki", format: "der" })

function deriveKey(shared, epkDer, recipientDer) {
  return Buffer.from(crypto.hkdfSync("sha256", shared, Buffer.concat([epkDer, recipientDer]), INFO, 32))
}

/** Copy `len` bytes of `fd` from `start` through `fn`, chunk by chunk. */
function eachChunk(fd, start, len, fn) {
  const buf = Buffer.alloc(CHUNK)
  let pos = start
  const end = start + len
  while (pos < end) {
    const n = fs.readSync(fd, buf, 0, Math.min(CHUNK, end - pos), pos)
    if (n === 0) break
    fn(buf.subarray(0, n))
    pos += n
  }
}

/** Encrypt `inPath` to `outPath` for the holder of the private key. */
export function encryptFile(publicKeyB64, inPath, outPath) {
  const recipient = publicObject(publicKeyB64)
  const eph = crypto.generateKeyPairSync("x25519")
  const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: recipient })
  const epkDer = spki(eph.publicKey)
  const key = deriveKey(shared, epkDer, spki(recipient))
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  cipher.setAAD(INFO)

  const len = Buffer.alloc(2)
  len.writeUInt16BE(epkDer.length)
  const inFd = fs.openSync(inPath, "r")
  const outFd = fs.openSync(outPath, "w", 0o600)
  try {
    fs.writeSync(outFd, Buffer.concat([MAGIC, len, epkDer, iv]))
    eachChunk(inFd, 0, fs.fstatSync(inFd).size, (chunk) => fs.writeSync(outFd, cipher.update(chunk)))
    fs.writeSync(outFd, cipher.final())
    fs.writeSync(outFd, cipher.getAuthTag())
  } finally {
    fs.closeSync(inFd)
    fs.closeSync(outFd)
  }
}

/**
 * Decrypt `inPath` to `outPath`. Writes `outPath.partial` and renames only after the
 * tag checks, so a wrong key or a damaged file never leaves a plausible tar behind.
 * @throws on a wrong key, a damaged file, or a file that is not a Brain2 backup
 */
export function decryptFile(privateKeyB64, inPath, outPath) {
  const priv = privateObject(privateKeyB64)
  const inFd = fs.openSync(inPath, "r")
  const partial = `${outPath}.partial`
  let outFd = null
  try {
    const size = fs.fstatSync(inFd).size
    const head = Buffer.alloc(6)
    fs.readSync(inFd, head, 0, 6, 0)
    if (!head.subarray(0, 4).equals(MAGIC)) throw new Error("not an encrypted Brain2 backup")
    const epkLen = head.readUInt16BE(4)
    const bodyStart = 6 + epkLen + 12
    if (size < bodyStart + TAG_LEN) throw new Error("encrypted backup is truncated")
    const epkDer = Buffer.alloc(epkLen)
    fs.readSync(inFd, epkDer, 0, epkLen, 6)
    const iv = Buffer.alloc(12)
    fs.readSync(inFd, iv, 0, 12, 6 + epkLen)
    const tag = Buffer.alloc(TAG_LEN)
    fs.readSync(inFd, tag, 0, TAG_LEN, size - TAG_LEN)

    const epk = crypto.createPublicKey({ key: epkDer, format: "der", type: "spki" })
    const shared = crypto.diffieHellman({ privateKey: priv, publicKey: epk })
    const key = deriveKey(shared, epkDer, spki(crypto.createPublicKey(priv)))
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAAD(INFO)
    decipher.setAuthTag(tag)

    outFd = fs.openSync(partial, "w", 0o600)
    eachChunk(inFd, bodyStart, size - TAG_LEN - bodyStart, (chunk) => fs.writeSync(outFd, decipher.update(chunk)))
    fs.writeSync(outFd, decipher.final())
    fs.closeSync(outFd)
    outFd = null
    fs.renameSync(partial, outPath)
  } catch (e) {
    if (outFd !== null) fs.closeSync(outFd)
    fs.rmSync(partial, { force: true })
    throw e
  } finally {
    fs.closeSync(inFd)
  }
}
