export interface ProviderConfig {
  name: string
  transport: 'anthropic' | 'openai'
  baseUrl: string
  keyRef: string
  modelPrefix: string
  enabled: boolean
  apiKey?: string
}

export const PROVIDER_CATALOG: Record<string, ProviderConfig> = {
  nvidia_nim: {
    name: 'nvidia_nim',
    transport: 'openai',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    keyRef: 'NVIDIA_NIM_API_KEY',
    modelPrefix: 'nvidia_nim/',
    enabled: false
  },
  gemini: {
    name: 'gemini',
    transport: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    keyRef: 'GEMINI_API_KEY',
    modelPrefix: 'gemini/',
    enabled: false
  },
  opencode: {
    name: 'opencode',
    transport: 'openai',
    baseUrl: 'https://opencode.ai/zen/v1',
    keyRef: 'OPENCODE_API_KEY',
    modelPrefix: 'opencode/',
    enabled: false
  },
  requesty: {
    name: 'requesty',
    transport: 'anthropic',
    baseUrl: 'https://router.requesty.ai/v1',
    keyRef: 'REQUESTY_API_KEY',
    modelPrefix: 'requesty/',
    enabled: false
  },
  cerebras: {
    name: 'cerebras',
    transport: 'openai',
    baseUrl: 'https://api.cerebras.ai/v1',
    keyRef: 'CEREBRAS_API_KEY',
    modelPrefix: 'cerebras/',
    enabled: false
  }
}

export function getProviderConfig(name: string): ProviderConfig | undefined {
  return PROVIDER_CATALOG[name]
}

export function listEnabledProviders(): ProviderConfig[] {
  return Object.values(PROVIDER_CATALOG).filter(p => p.enabled)
}

export function getProviderForModel(model: string): ProviderConfig | undefined {
  for (const provider of Object.values(PROVIDER_CATALOG)) {
    if (model.startsWith(provider.modelPrefix)) {
      return provider
    }
  }
  return undefined
}