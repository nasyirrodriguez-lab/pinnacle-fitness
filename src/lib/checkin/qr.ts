import { signToken, verifyToken } from '@/lib/jwt'

export interface CheckinQrPayload {
  v: 1
  uid: string
  iat: number
  exp: number
}

const TTL_MS = 24 * 60 * 60 * 1000

export function issueCheckinToken(userId: string, now = Date.now()): string {
  const payload: CheckinQrPayload = {
    v: 1,
    uid: userId,
    iat: Math.floor(now / 1000),
    exp: Math.floor((now + TTL_MS) / 1000),
  }
  return signToken(payload)
}

export function verifyCheckinToken(
  token: string,
  now = Date.now()
): CheckinQrPayload | null {
  const decoded = verifyToken<CheckinQrPayload>(token)
  if (!decoded) return null
  if (decoded.v !== 1) return null
  if (typeof decoded.uid !== 'string' || !decoded.uid) return null
  if (typeof decoded.exp !== 'number') return null
  if (decoded.exp * 1000 < now) return null
  return decoded
}
