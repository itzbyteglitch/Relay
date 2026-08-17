import { ProviderConfig, getProviderForModel, listEnabledProviders } from './catalog'
import { AnthropicMessagesTransport } from './transport-anthropic'
import { OpenAIChatTransport } from './transport-openai'
import { createKVHelpers } from '../kv'

export interface Transport {
  send(request: any): Promise<any>
  stream(request: any): AsyncGenerator<any>
}

export function createTransport(config: ProviderConfig & { apiKey: string }): Transport {
  switch (config.transport) {
    case 'anthropic':
      return new AnthropicMessagesTransport({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        modelPrefix: config.modelPrefix
      })
    case 'openai':
      return new OpenAIChatTransport({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        modelPrefix: config.modelPrefix
      })
    default:
      throw new Error(`Unknown transport: ${config.transport}`)
  }
}

async function getProviderForModelWithKV(model: string, kvHelpers: ReturnType<typeof createKVHelpers>): Promise<ProviderConfig | undefined> {
  console.log('getProviderForModelWithKV: looking for model:', model)
  // First check catalog
  const catalogProvider = getProviderForModel(model)
  console.log('getProviderForModelWithKV: catalogProvider:', catalogProvider?.name || 'none')
  if (catalogProvider && catalogProvider.enabled) {
    return catalogProvider
  }
  
  // Then check KV for providers not in catalog or with enabled: true
  const kvProviders = await kvHelpers.listProviders()
  console.log('getProviderForModelWithKV: KV providers:', JSON.stringify(kvProviders))
  for (const [name, record] of Object.entries(kvProviders)) {
    console.log('getProviderForModelWithKV: checking provider:', name, 'prefix:', record.model_prefix)
    if (record.enabled && model.startsWith(record.model_prefix)) {
      console.log('getProviderForModelWithKV: matched provider:', name)
      return {
        name,
        transport: record.transport,
        baseUrl: record.base_url,
        keyRef: record.key_ref,
        modelPrefix: record.model_prefix,
        enabled: true
      }
    }
  }
  
  return undefined
}

export async function resolveTransport(
  model: string,
  kvHelpers: ReturnType<typeof createKVHelpers>
): Promise<Transport | null> {
  // Strip "claude/" prefix if present (Claude Code gateway compatibility)
  const internalModel = model.startsWith('claude/') ? model.slice(7) : model
  console.log('resolveTransport: incoming model:', model, 'internal:', internalModel)
  
  const provider = await getProviderForModelWithKV(internalModel, kvHelpers)
  
  console.log('resolveTransport: Resolved provider:', provider ? provider.name : 'none')
  if (!provider || !provider.enabled) return null

  const apiKey = await kvHelpers.getProviderKey(provider.name)
  console.log('resolveTransport: API key found:', apiKey ? 'yes' : 'no')
  if (!apiKey) return null

  return createTransport({ ...provider, apiKey })
}