/**
 * scripts/sealed-box.mjs — Seal a message to a public key, open it with the private one
 *
 * The Oracle capture box holds only the PUBLIC key, so what it stores cannot be
 * read on that machine. X25519 (ephemeral sender key) + HKDF-SHA256 + AES-256-GCM,
 * Node built-ins only, so the VM needs no `npm install`.
 *
 * Wire form: `v1.<epk>.<iv>.<tag>.<ciphertext>`, each part base64url.
 */
import crypto from "node:crypto"

const INFO = Buffer.from("brain2-capture-v1")
const b64u = (buf) => Buffer.from(buf).toString("base64url")
const fromB64u = (s) => Buffer.from(s, "base64url")

export function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519")
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("base64"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("base64"),
  }
}

const publicObject = (b64) => crypto.createPublicKey({ key: Buffer.from(b64, "base64"), format: "der", type: "spki" })
const privateObject = (b64) => crypto.createPrivateKey({ key: Buffer.from(b64, "base64"), format: "der", type: "pkcs8" })
const derDer = (keyObject) => keyObject.export({ type: "spki", format: "der" })

function deriveKey(shared, epkDer, recipientDer) {
  return Buffer.from(crypto.hkdfSync("sha256", shared, Buffer.concat([epkDer, recipientDer]), INFO, 32))
}

/** @param {string} publicKeyB64 @param {string|Buffer} plaintext */
export function seal(publicKeyB64, plaintext) {
  const recipient = publicObject(publicKeyB64)
  const eph = crypto.generateKeyPairSync("x25519")
  const shared = crypto.diffieHellman({ privateKey: eph.privateKey, publicKey: recipient })
  const epkDer = derDer(eph.publicKey)
  const key = deriveKey(shared, epkDer, derDer(recipient))
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  cipher.setAAD(INFO)
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()])
  return ["v1", b64u(epkDer), b64u(iv), b64u(cipher.getAuthTag()), b64u(ct)].join(".")
}

/** @returns {Buffer} @throws on a wrong key or tampered data */
export function open(privateKeyB64, sealed) {
  const [v, epk, iv, tag, ct] = String(sealed).split(".")
  if (v !== "v1" || !epk || !iv || !tag || !ct) throw new Error("not a v1 sealed message")
  const priv = privateObject(privateKeyB64)
  const epkDer = fromB64u(epk)
  const shared = crypto.diffieHellman({ privateKey: priv, publicKey: crypto.createPublicKey({ key: epkDer, format: "der", type: "spki" }) })
  const key = deriveKey(shared, epkDer, derDer(crypto.createPublicKey(priv)))
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, fromB64u(iv))
  decipher.setAAD(INFO)
  decipher.setAuthTag(fromB64u(tag))
  return Buffer.concat([decipher.update(fromB64u(ct)), decipher.final()])
}
