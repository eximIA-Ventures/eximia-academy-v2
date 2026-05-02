import { createHash, randomBytes, createHmac } from "crypto"

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

/** Simple XOR-based encryption for storing outbound keys (use proper KMS in prod) */
export function encryptKey(key: string): string {
  const secret = process.env.INTEGRATION_ENCRYPT_SECRET ?? "eximia-academy-default-secret-change-me"
  const buf = Buffer.from(key, "utf-8")
  const secretBuf = Buffer.from(secret, "utf-8")
  const encrypted = Buffer.alloc(buf.length)
  for (let i = 0; i < buf.length; i++) {
    encrypted[i] = buf[i] ^ secretBuf[i % secretBuf.length]
  }
  return encrypted.toString("base64")
}

/** Decrypt outbound key */
export function decryptKey(encrypted: string): string {
  const secret = process.env.INTEGRATION_ENCRYPT_SECRET ?? "eximia-academy-default-secret-change-me"
  const buf = Buffer.from(encrypted, "base64")
  const secretBuf = Buffer.from(secret, "utf-8")
  const decrypted = Buffer.alloc(buf.length)
  for (let i = 0; i < buf.length; i++) {
    decrypted[i] = buf[i] ^ secretBuf[i % secretBuf.length]
  }
  return decrypted.toString("utf-8")
}

/** HMAC-SHA256 signature for webhooks */
export function signPayload(secret: string, payload: string): string {
  return "sha256=" + createHmac("sha256", secret).update(payload).digest("hex")
}

/** Verify webhook signature */
export function verifySignature(secret: string, payload: string, signature: string): boolean {
  const expected = signPayload(secret, payload)
  return expected === signature
}
