import { describe, it, expect, beforeEach, vi } from 'vitest'
import { hashPassword, verifyPassword } from '../src/auth/password'
import { createToken, verifyToken, hashToken } from '../src/auth/tokens'

describe('password hashing', () => {
  it('hashes and verifies a password', async () => {
    const password = 'test-password-123'
    const hash = await hashPassword(password)
    expect(hash).toContain(':')
    const parts = hash.split(':')
    expect(parts.length).toBe(3)
    expect(await verifyPassword(password, hash)).toBe(true)
  })

  it('rejects wrong password', async () => {
    const password = 'correct-password'
    const hash = await hashPassword(password)
    expect(await verifyPassword('wrong-password', hash)).toBe(false)
  })

  it('produces different hashes for same password', async () => {
    const password = 'same-password'
    const hash1 = await hashPassword(password)
    const hash2 = await hashPassword(password)
    expect(hash1).not.toBe(hash2)
    expect(await verifyPassword(password, hash1)).toBe(true)
    expect(await verifyPassword(password, hash2)).toBe(true)
  })

  it('handles empty password', async () => {
    const password = ''
    const hash = await hashPassword(password)
    expect(await verifyPassword(password, hash)).toBe(true)
  })
})

describe('device tokens', () => {
  it('creates and verifies a token', async () => {
    const deviceUuid = 'test-device-uuid-123'
    const token = await createToken(deviceUuid)
    const parts = token.split('.')
    expect(parts.length).toBe(3)
    const verified = await verifyToken(token)
    expect(verified).not.toBeNull()
    expect(verified!.deviceUuid).toBe(deviceUuid)
    expect(verified!.issuedAt).toBeGreaterThan(0)
  })

  it('rejects tampered token', async () => {
    const deviceUuid = 'test-device-uuid-123'
    const token = await createToken(deviceUuid)
    const tampered = token.slice(0, -1) + 'x'
    const verified = await verifyToken(tampered)
    expect(verified).toBeNull()
  })

  it('rejects malformed token', async () => {
    const verified = await verifyToken('not.a.valid.token')
    expect(verified).toBeNull()
  })

  it('hashes token consistently', async () => {
    const token = 'test-token'
    const hash1 = await hashToken(token)
    const hash2 = await hashToken(token)
    expect(hash1).toBe(hash2)
  })
})