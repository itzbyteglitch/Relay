export interface DeviceRecord {
  name: string
  token_hash: string
  created_at: number
  revoked: boolean
}

export interface ProviderRecord {
  transport: 'anthropic' | 'openai'
  base_url: string
  key_ref: string
  model_prefix: string
  enabled: boolean
}

export interface KVNamespace {
  get(key: string, type?: 'text' | 'json'): Promise<string | null>
  put(key: string, value: string): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>
}

export function createKVHelpers(kv: KVNamespace) {
  return {
    async getDevice(uuid: string): Promise<DeviceRecord | null> {
      const data = await kv.get(`device:${uuid}`, 'json')
      return data as unknown as DeviceRecord | null
    },

    async putDevice(uuid: string, record: DeviceRecord): Promise<void> {
      await kv.put(`device:${uuid}`, JSON.stringify(record))
    },

    async deleteDevice(uuid: string): Promise<void> {
      await kv.delete(`device:${uuid}`)
    },

    async listDevices(): Promise<DeviceRecord[]> {
      const { keys } = await kv.list({ prefix: 'device:' })
      const devices: DeviceRecord[] = []
      for (const key of keys) {
        const data = await kv.get(key.name, 'json')
        if (data) devices.push(data as unknown as DeviceRecord)
      }
      return devices
    },

    async getProvider(name: string): Promise<ProviderRecord | null> {
      const data = await kv.get(`provider:${name}`, 'json')
      return data as unknown as ProviderRecord | null
    },

    async putProvider(name: string, record: ProviderRecord): Promise<void> {
      await kv.put(`provider:${name}`, JSON.stringify(record))
    },

    async deleteProvider(name: string): Promise<void> {
      await kv.delete(`provider:${name}`)
      await kv.delete(`provider_key:${name}`)
    },

    async listProviders(): Promise<Record<string, ProviderRecord>> {
      const { keys } = await kv.list({ prefix: 'provider:' })
      const providers: Record<string, ProviderRecord> = {}
      for (const key of keys) {
        const name = key.name.replace('provider:', '')
        const data = await kv.get(key.name, 'json')
        if (data) providers[name] = data as unknown as ProviderRecord
      }
      return providers
    },

    async getProviderKey(name: string): Promise<string | null> {
      return kv.get(`provider_key:${name}`, 'text')
    },

    async putProviderKey(name: string, key: string): Promise<void> {
      await kv.put(`provider_key:${name}`, key)
    },

    async getPasswordHash(): Promise<string | null> {
      return kv.get('auth:password_hash', 'text')
    },

    async setPasswordHash(hash: string): Promise<void> {
      await kv.put('auth:password_hash', hash)
    },

    async getAdminHash(): Promise<string | null> {
      return kv.get('auth:admin_hash', 'text')
    },

    async setAdminHash(hash: string): Promise<void> {
      await kv.put('auth:admin_hash', hash)
    },

    async getRateLimit(ip: string): Promise<number> {
      const data = await kv.get(`ratelimit:${ip}`, 'json')
      return (data as { count: number; reset: number } | null)?.count || 0
    },

    async incrementRateLimit(ip: string, windowMs: number): Promise<number> {
      const now = Date.now()
      const existing = await kv.get(`ratelimit:${ip}`, 'json') as { count: number; reset: number } | null
      if (existing && now < existing.reset) {
        const next = { count: existing.count + 1, reset: existing.reset }
        await kv.put(`ratelimit:${ip}`, JSON.stringify(next))
        return next.count
      } else {
        const next = { count: 1, reset: now + windowMs }
        await kv.put(`ratelimit:${ip}`, JSON.stringify(next))
        return 1
      }
    }
  }
}