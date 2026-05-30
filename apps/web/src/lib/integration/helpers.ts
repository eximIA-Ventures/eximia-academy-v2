import {
  createHash,
  randomBytes,
  createHmac,
  createCipheriv,
  createDecipheriv,
  scryptSync,
  timingSafeEqual,
} from "crypto"

const DEFAULT_SECRET = "eximia-academy-default-secret-change-me"
const ENC_VERSION = "v2"
const ENC_ALGO = "aes-256-gcm"
const IV_LENGTH = 12 // 96-bit IV recommended for GCM
const TAG_LENGTH = 16

/** Derive a 32-byte AES key from the configured secret via scrypt */
function deriveEncryptKey(): Buffer {
  const secret = process.env.INTEGRATION_ENCRYPT_SECRET
  if (!secret || secret === DEFAULT_SECRET) {
    throw new Error(
      "INTEGRATION_ENCRYPT_SECRET is not configured (missing or using the insecure default). Refusing to encrypt/decrypt integration keys.",
    )
  }
  // Fixed salt: deterministic key derivation so previously-encrypted values stay decryptable.
  return scryptSync(secret, "eximia-integration-enc", 32)
}

/** Legacy XOR decryption (compatibility for values stored before the v2 format) */
function decryptKeyLegacy(encrypted: string): string {
  const secret = process.env.INTEGRATION_ENCRYPT_SECRET ?? DEFAULT_SECRET
  const buf = Buffer.from(encrypted, "base64")
  const secretBuf = Buffer.from(secret, "utf-8")
  const decrypted = Buffer.alloc(buf.length)
  for (let i = 0; i < buf.length; i++) {
    decrypted[i] = buf[i] ^ secretBuf[i % secretBuf.length]
  }
  return decrypted.toString("utf-8")
}

/** Generate a new API key with prefix */
export function generateKey(appSlug: string): { raw: string; prefix: string; hash: string } {
  const random = randomBytes(32).toString("hex")
  const raw = `eximia_${appSlug}_${random}`
  const prefix = raw.slice(0, 16)
  const hash = hashKey(raw)
  return { raw, prefix, hash }
}

/** SHA-256 hash of an API key */
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

/**
 * Encrypt outbound keys with AES-256-GCM.
 * Format: "v2:" + base64(iv | authTag | ciphertext). A fresh random IV is used per call.
 * Refuses to operate when the encryption secret is missing or the insecure default.
 */
export function encryptKey(key: string): string {
  const encKey = deriveEncryptKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ENC_ALGO, encKey, iv)
  const ciphertext = Buffer.concat([cipher.update(key, "utf-8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${ENC_VERSION}:` + Buffer.concat([iv, tag, ciphertext]).toString("base64")
}

/**
 * Decrypt outbound key.
 * v2 values are decrypted with AES-256-GCM; legacy (unprefixed) values fall back to the
 * old XOR scheme for backward compatibility.
 */
export function decryptKey(encrypted: string): string {
  if (!encrypted.startsWith(`${ENC_VERSION}:`)) {
    return decryptKeyLegacy(encrypted)
  }
  const encKey = deriveEncryptKey()
  const payload = Buffer.from(encrypted.slice(ENC_VERSION.length + 1), "base64")
  const iv = payload.subarray(0, IV_LENGTH)
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = payload.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ENC_ALGO, encKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8")
}

/** HMAC-SHA256 signature for webhooks */
export function signPayload(secret: string, payload: string): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex")
}

/** Verify webhook signature using a constant-time comparison */
export function verifySignature(secret: string, payload: string, signature: string): boolean {
  const expected = signPayload(secret, payload)
  const expectedBuf = Buffer.from(expected, "utf-8")
  const signatureBuf = Buffer.from(signature, "utf-8")
  // Length guard: timingSafeEqual requires equal-length buffers.
  if (expectedBuf.length !== signatureBuf.length) return false
  return timingSafeEqual(expectedBuf, signatureBuf)
}
