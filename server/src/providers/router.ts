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
  // First check catalog
  const catalogProvider = getProviderForModel(model)
  if (catalogProvider && catalogProvider.enabled) {
    return catalogProvider
  }
  
  // Then check KV for providers not in catalog or with enabled: true
  const kvProviders = await kvHelpers.listProviders()
  console.log('KV Providers:', JSON.stringify(kvProviders))
  console.log('Looking for model:', model)
  for (const [name, record] of Object.entries(kvProviders)) {
    console.log('Checking provider:', name, 'model_prefix:', record.model_prefix, 'enabled:', record.enabled)
    if (record.enabled && model.startsWith(record.model_prefix)) {
      console.log('Matched provider:', name)
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
  const provider = await getProviderForModelWithKV(model, kvHelpers)
  
  console.log('Resolved provider:', provider ? provider.name : 'none')
  if (!provider || !provider.enabled) return null

  const apiKey = await kvHelpers.getProviderKey(provider.name)
  console.log('API key found:', apiKey ? 'yes' : 'no')
  if (!apiKey) return null

  return createTransport({ ...provider, apiKey })
}