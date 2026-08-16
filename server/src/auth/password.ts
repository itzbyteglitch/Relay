const PBKDF2_ITERATIONS = 100000
const SALT_LENGTH = 16
const HASH_LENGTH = 32

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    HASH_LENGTH * 8
  )
  const hashArray = new Uint8Array(hash)
  return `${bufferToBase64(salt)}:${PBKDF2_ITERATIONS}:${bufferToBase64(hashArray)}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':')
  if (parts.length !== 3) return false

  const [saltB64, iterationsStr, hashB64] = parts
  const iterations = parseInt(iterationsStr, 10)
  if (isNaN(iterations)) return false

  const encoder = new TextEncoder()
  const salt = base64ToBuffer(saltB64)
  const expectedHash = base64ToBuffer(hashB64)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    expectedHash.length * 8
  )

  return timingSafeEqual(new Uint8Array(hash), expectedHash)
}

function bufferToBase64(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
}

function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64)
  const buffer = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    buffer[i] = binary.charCodeAt(i)
  }
  return buffer
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i]
  }
  return result === 0
}