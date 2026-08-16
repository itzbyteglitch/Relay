export interface DeviceToken {
  deviceUuid: string
  issuedAt: number
}

const TOKEN_SECRET_KEY = 'relay-token-secret'

async function getSigningKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(TOKEN_SECRET_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
  return keyMaterial
}

export async function createToken(deviceUuid: string): Promise<string> {
  const issuedAt = Date.now()
  const payload = `${deviceUuid}.${issuedAt}`
  const key = await getSigningKey()
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
  return `${payload}.${signatureB64}`
}

export async function verifyToken(token: string): Promise<DeviceToken | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [deviceUuid, issuedAtStr, signatureB64] = parts
  const issuedAt = parseInt(issuedAtStr, 10)
  if (isNaN(issuedAt)) return null

  const payload = `${deviceUuid}.${issuedAt}`
  const key = await getSigningKey()
  const signature = base64ToBuffer(signatureB64)

  const valid = await crypto.subtle.verify('HMAC', key, signature, new TextEncoder().encode(payload))
  if (!valid) return null

  return { deviceUuid, issuedAt }
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return buffer
}