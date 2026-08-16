import { Hono } from 'hono'
import { hashPassword, verifyPassword } from '../auth/password'
import { createToken, hashToken } from '../auth/tokens'
import { createKVHelpers, DeviceRecord } from '../kv'

const auth = new Hono<{ Bindings: { RELAY_KV: KVNamespace }; Variables: { kvHelpers: ReturnType<typeof createKVHelpers> } }>()

auth.post('/register', async (c) => {
  const body = await c.req.json<{ password: string; device_name: string; device_uuid: string }>()
  const { password, device_name, device_uuid } = body

  if (!password || !device_name || !device_uuid) {
    return c.json({ error: 'Missing required fields' }, 400)
  }

  const kvHelpers = c.get('kvHelpers')

  const rateLimit = await kvHelpers.incrementRateLimit(c.req.header('CF-Connecting-IP') || 'unknown', 3600000)
  if (rateLimit > 5) {
    return c.json({ error: 'Rate limited' }, 429)
  }

  const storedHash = await kvHelpers.getPasswordHash()
  if (!storedHash) {
    return c.json({ error: 'Server not configured' }, 500)
  }

  const valid = await verifyPassword(password, storedHash)
  if (!valid) {
    return c.json({ error: 'Invalid password' }, 401)
  }

  const existingDevice = await kvHelpers.getDevice(device_uuid)
  if (existingDevice && !existingDevice.revoked) {
    return c.json({ error: 'Device already registered' }, 409)
  }

  const token = await createToken(device_uuid)
  const tokenHash = await hashToken(token)

  const deviceRecord: DeviceRecord = {
    name: device_name,
    token_hash: tokenHash,
    created_at: Date.now(),
    revoked: false
  }

  await kvHelpers.putDevice(device_uuid, deviceRecord)

  return c.json({ token })
})

export default auth