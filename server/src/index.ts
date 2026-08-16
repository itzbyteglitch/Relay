import { Hono } from 'hono'
import authRoutes from './routes/auth'
import modelsRoutes from './routes/models'
import messagesRoutes from './routes/messages'
import adminRoutes from './routes/admin'
import { createKVHelpers } from './kv'
import { verifyToken } from './auth/tokens'
import { getProviderForModel, listEnabledProviders } from './providers/catalog'
import { resolveTransport } from './providers/router'
import { encodeSSE } from './core/sse'

type Bindings = {
  RELAY_KV: KVNamespace
}

type Variables = {
  deviceUuid: string
  kvHelpers: ReturnType<typeof createKVHelpers>
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use('*', async (c, next) => {
  const kvHelpers = createKVHelpers(c.env.RELAY_KV)
  c.set('kvHelpers', kvHelpers)
  await next()
})

app.use('/v1/*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const token = authHeader.slice(7)
  const verified = await verifyToken(token)
  if (!verified) {
    return c.json({ error: 'Invalid token' }, 401)
  }

  const kvHelpers = c.get('kvHelpers')
  const device = await kvHelpers.getDevice(verified.deviceUuid)
  if (!device || device.revoked) {
    return c.json({ error: 'Device revoked' }, 401)
  }

  if (device.token_hash !== await hashToken(token)) {
    return c.json({ error: 'Token mismatch' }, 401)
  }

  c.set('deviceUuid', verified.deviceUuid)
  await next()
})

async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder()
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(token))
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
}

app.route('/auth', authRoutes)
app.route('/v1/models', modelsRoutes)
app.route('/v1/messages', messagesRoutes)
app.route('/admin', adminRoutes)

app.get('/', (c) => c.text('Relay Server'))

export default app