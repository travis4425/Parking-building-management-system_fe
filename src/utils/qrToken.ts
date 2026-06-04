// Tiện ích tạo và giải mã QR token định dạng PKG — dùng cho luồng check-in/check-out
// Format: PKG-{sessionId không có dấu gạch}-{timestamp hex}-{checksum 6 ký tự}

// Checksum đơn giản: polynomial hash của rawId + ts
function computeChecksum(rawId: string, ts: string): string {
  let n = 0
  for (const c of rawId + ts) n = ((n << 5) - n + c.charCodeAt(0)) & 0xffffff
  return (n >>> 0).toString(16).toUpperCase().padStart(6, '0')
}

// Tạo PKG token từ sessionId (UUID) và checkInTime (ISO string)
export function generateToken(sessionId: string, checkInTime: string): string {
  const rawId = sessionId.replace(/-/g, '')                         // 32-char hex
  const ts    = new Date(checkInTime).getTime().toString(16).toUpperCase()
  const check = computeChecksum(rawId, ts)
  return `PKG-${rawId}-${ts}-${check}`
}

export type TokenResult =
  | { ok: true;  sessionId: string; timestamp: number }
  | { ok: false; reason: 'invalid_format' | 'invalid_checksum' }

// Giải mã và xác thực PKG token, trả về sessionId nếu hợp lệ
export function decodeToken(token: string): TokenResult {
  if (typeof token !== 'string' || !token.startsWith('PKG-'))
    return { ok: false, reason: 'invalid_format' }

  const parts = token.split('-')
  if (parts.length !== 4) return { ok: false, reason: 'invalid_format' }

  const [, rawId, ts, checksum] = parts
  if (!rawId || rawId.length !== 32 || !/^[0-9a-fA-F]{32}$/.test(rawId))
    return { ok: false, reason: 'invalid_format' }

  if (computeChecksum(rawId, ts) !== checksum)
    return { ok: false, reason: 'invalid_checksum' }

  // Tái tạo UUID từ 32 hex chars
  const sessionId = [
    rawId.slice(0, 8),
    rawId.slice(8, 12),
    rawId.slice(12, 16),
    rawId.slice(16, 20),
    rawId.slice(20),
  ].join('-')

  return { ok: true, sessionId, timestamp: parseInt(ts, 16) }
}
