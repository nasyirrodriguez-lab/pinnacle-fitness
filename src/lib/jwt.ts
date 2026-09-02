// Minimal HS256 JWT-ish signed token for short-lived stuff like unsubscribe
// links. Not a real JWT — just `<payload-base64>.<hmac-base64>` because we
// don't need header negotiation.

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

function getSecret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not set')
  return s
}

function b64url(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlDecode(s: string): Buffer {
  const pad = 4 - (s.length % 4)
  const padded = s + (pad === 4 ? '' : '='.repeat(pad))
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

export function signToken(payload: object): string {
  const json = JSON.stringify(payload)
  const body = b64url(Buffer.from(json, 'utf8'))
  const mac = b64url(createHmac('sha256', getSecret()).update(body).digest())
  return `${body}.${mac}`
}

export function verifyToken<T extends object = Record<string, unknown>>(
  token: string
): T | null {
  if (typeof token !== 'string') return null
  const [body, mac] = token.split('.')
  if (!body || !mac) return null
  const expected = createHmac('sha256', getSecret()).update(body).digest()
  let provided: Buffer
  try {
    provided = b64urlDecode(mac)
  } catch {
    return null
  }
  if (provided.length !== expected.length) return null
  if (!timingSafeEqual(provided, expected)) return null
  try {
    return JSON.parse(b64urlDecode(body).toString('utf8')) as T
  } catch {
    return null
  }
}

// Re-export randomBytes for callers who need a nonce.
export function randomNonce(bytes = 12): string {
  return b64url(randomBytes(bytes))
}
