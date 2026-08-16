import { Hono } from 'hono'
import { hashPassword, verifyPassword } from '../auth/password'
import { createToken, verifyToken, hashToken } from '../auth/tokens'
import { createKVHelpers, ProviderRecord } from '../kv'
import { PROVIDER_CATALOG } from '../providers/catalog'

const admin = new Hono<{ Bindings: { RELAY_KV: KVNamespace }; Variables: { kvHelpers: ReturnType<typeof createKVHelpers> } }>()

admin.use('/provider*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = authHeader.slice(7)
  const verified = await verifyToken(token)
  if (!verified) {
    return c.json({ error: 'Invalid admin token' }, 401)
  }

  const kvHelpers = c.get('kvHelpers')
  const adminHash = await kvHelpers.getAdminHash()
  if (!adminHash) {
    return c.json({ error: 'Admin not configured' }, 500)
  }

  const valid = await verifyPassword(verified.deviceUuid, adminHash)
  if (!valid) {
    return c.json({ error: 'Invalid admin token' }, 401)
  }

  await next()
})

admin.post('/provider', async (c) => {
  const body = await c.req.json<{
    name: string
    transport?: 'anthropic' | 'openai'
    base_url?: string
    key: string
    model_prefix?: string
    enabled?: boolean
  }>()

  const { name, key, ...rest } = body

  if (!name || !key) {
    return c.json({ error: 'Missing name or key' }, 400)
  }

  if (!PROVIDER_CATALOG[name] && (!rest.transport || !rest.base_url || !rest.model_prefix)) {
    return c.json({ error: 'Custom provider requires transport, base_url, and model_prefix' }, 400)
  }

  const kvHelpers = c.get('kvHelpers')

  const catalogEntry = PROVIDER_CATALOG[name]
  const record: ProviderRecord = {
    transport: rest.transport || catalogEntry!.transport,
    base_url: rest.base_url || catalogEntry!.baseUrl,
    key_ref: catalogEntry?.keyRef || `${name.toUpperCase()}_API_KEY`,
    model_prefix: rest.model_prefix || catalogEntry!.modelPrefix,
    enabled: rest.enabled ?? true
  }

  await kvHelpers.putProvider(name, record)
  await kvHelpers.putProviderKey(name, key)

  return c.json({ success: true, provider: { ...record, key: '***' } })
})

admin.get('/provider', async (c) => {
  const kvHelpers = c.get('kvHelpers')
  const providers = await kvHelpers.listProviders()

  const result = Object.entries(providers).map(([name, record]) => ({
    name,
    ...record,
    key: '***'
  }))

  return c.json({ providers: result })
})

admin.delete('/provider/:name', async (c) => {
  const name = c.req.param('name')
  const kvHelpers = c.get('kvHelpers')

  await kvHelpers.deleteProvider(name)

  return c.json({ success: true })
})

admin.post('/auth/admin-token', async (c) => {
  const body = await c.req.json<{ password: string }>()
  const { password } = body

  if (!password) {
    return c.json({ error: 'Missing password' }, 400)
  }

  const kvHelpers = c.get('kvHelpers')
  const adminHash = await kvHelpers.getAdminHash()
  if (!adminHash) {
    return c.json({ error: 'Admin not configured' }, 500)
  }

  const valid = await verifyPassword(password, adminHash)
  if (!valid) {
    return c.json({ error: 'Invalid admin password' }, 401)
  }

  const adminToken = await createToken('admin')
  return c.json({ token: adminToken })
})

export default admin