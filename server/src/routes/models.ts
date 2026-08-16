import { Hono } from 'hono'
import { createKVHelpers } from '../kv'
import { listEnabledProviders, PROVIDER_CATALOG } from '../providers/catalog'

const models = new Hono<{ Bindings: { RELAY_KV: KVNamespace }; Variables: { kvHelpers: ReturnType<typeof createKVHelpers> } }>()

models.get('/', async (c) => {
  const kvHelpers = c.get('kvHelpers')
  const catalogProviders = listEnabledProviders()
  
  // Merge with KV providers that have enabled: true
  const kvProviders = await kvHelpers.listProviders()
  const allProviders = [...catalogProviders]
  
  for (const [name, record] of Object.entries(kvProviders)) {
    if (record.enabled && !catalogProviders.find(p => p.name === name)) {
      allProviders.push({
        name,
        transport: record.transport,
        baseUrl: record.base_url,
        keyRef: record.key_ref,
        modelPrefix: record.model_prefix,
        enabled: true
      })
    }
  }

  const allModels = []

  for (const provider of allProviders) {
    const apiKey = await kvHelpers.getProviderKey(provider.name)
    if (!apiKey) continue

    const models = await fetchProviderModels(provider, apiKey)
    for (const model of models) {
      allModels.push({
        id: `${provider.modelPrefix}${model.id}`,
        type: 'model' as const,
        display_name: model.display_name || model.id,
        created_at: model.created_at || new Date().toISOString()
      })
    }
  }

  return c.json({
    data: allModels,
    has_more: false,
    first_id: allModels[0]?.id || '',
    last_id: allModels[allModels.length - 1]?.id || ''
  })
})

async function fetchProviderModels(provider: { name: string; transport: string; baseUrl: string; modelPrefix: string }, apiKey: string) {
  try {
    if (provider.transport === 'openai') {
      const response = await fetch(`${provider.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      if (!response.ok) return []
      const data = await response.json() as { data?: Array<{ id: string; created?: number }> }
      return (data.data || []).map((m) => ({
        id: m.id,
        display_name: m.id,
        created_at: m.created ? new Date(m.created * 1000).toISOString() : new Date().toISOString()
      }))
    } else if (provider.transport === 'anthropic') {
      const response = await fetch(`${provider.baseUrl}/v1/models`, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
      })
      if (!response.ok) return []
      const data = await response.json() as { data?: Array<{ id: string; display_name?: string; created_at?: string }> }
      return (data.data || []).map((m) => ({
        id: m.id,
        display_name: m.display_name || m.id,
        created_at: m.created_at || new Date().toISOString()
      }))
    }
  } catch {
    // Fallback to static known models
  }

  return getStaticModels(provider.name)
}

function getStaticModels(providerName: string) {
  const staticModels: Record<string, Array<{ id: string; display_name: string }>> = {
    nvidia_nim: [
      { id: 'nemotron-3-ultra', display_name: 'Nemotron 3 Ultra' },
      { id: 'nemotron-4-340b', display_name: 'Nemotron 4 340B' },
      { id: 'llama-3.1-405b', display_name: 'Llama 3.1 405B' },
      { id: 'llama-3.1-70b', display_name: 'Llama 3.1 70B' }
    ],
    gemini: [
      { id: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro' },
      { id: 'gemini-1.5-flash', display_name: 'Gemini 1.5 Flash' },
      { id: 'gemini-2.0-flash-exp', display_name: 'Gemini 2.0 Flash Experimental' }
    ],
    opencode: [
      { id: 'opencode-zen', display_name: 'OpenCode Zen' }
    ],
    requesty: [
      { id: 'router', display_name: 'Requesty Router' }
    ],
    cerebras: [
      { id: 'llama-3.1-70b', display_name: 'Llama 3.1 70B (Cerebras)' },
      { id: 'llama-3.1-8b', display_name: 'Llama 3.1 8B (Cerebras)' }
    ]
  }
  return (staticModels[providerName] || []).map(m => ({
    id: m.id,
    display_name: m.display_name,
    created_at: new Date().toISOString()
  }))
}

export default models