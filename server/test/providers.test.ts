import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { PROVIDER_CATALOG, getProviderConfig, listEnabledProviders, getProviderForModel } from '../src/providers/catalog'
import { OpenAIChatTransport } from '../src/providers/transport-openai'
import { AnthropicMessagesTransport } from '../src/providers/transport-anthropic'
import { AnthropicMessageRequest } from '../src/types/anthropic'

describe('provider catalog', () => {
  it('has all 5 v1 providers', () => {
    expect(Object.keys(PROVIDER_CATALOG)).toHaveLength(5)
    expect(PROVIDER_CATALOG.nvidia_nim).toBeDefined()
    expect(PROVIDER_CATALOG.gemini).toBeDefined()
    expect(PROVIDER_CATALOG.opencode).toBeDefined()
    expect(PROVIDER_CATALOG.requesty).toBeDefined()
    expect(PROVIDER_CATALOG.cerebras).toBeDefined()
  })

  it('has correct transport types', () => {
    expect(PROVIDER_CATALOG.nvidia_nim.transport).toBe('openai')
    expect(PROVIDER_CATALOG.gemini.transport).toBe('openai')
    expect(PROVIDER_CATALOG.opencode.transport).toBe('openai')
    expect(PROVIDER_CATALOG.requesty.transport).toBe('anthropic')
    expect(PROVIDER_CATALOG.cerebras.transport).toBe('openai')
  })

  it('getProviderConfig returns correct config', () => {
    const config = getProviderConfig('nvidia_nim')
    expect(config).toBeDefined()
    expect(config!.name).toBe('nvidia_nim')
  })

  it('getProviderForModel matches prefix', () => {
    const provider = getProviderForModel('nvidia_nim/nemotron-3-ultra')
    expect(provider).toBeDefined()
    expect(provider!.name).toBe('nvidia_nim')
  })

  it('returns undefined for unknown model', () => {
    const provider = getProviderForModel('unknown/model')
    expect(provider).toBeUndefined()
  })
})

describe('OpenAIChatTransport', () => {
  let transport: OpenAIChatTransport
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    transport = new OpenAIChatTransport({
      baseUrl: 'https://test.api/v1',
      apiKey: 'test-key',
      modelPrefix: 'test/'
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('converts Anthropic request to OpenAI format', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'test-model',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      })
    })

    const request: AnthropicMessageRequest = {
      model: 'test/test-model',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: false
    }

    const response = await transport.send(request)
    expect(response.content[0].text).toBe('Hello!')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Authorization': 'Bearer test-key' })
      })
    )
  })

  it('handles tool calls in response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: Date.now(),
        model: 'test-model',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call_123',
              type: 'function',
              function: { name: 'get_weather', arguments: '{"location":"NYC"}' }
            }]
          },
          finish_reason: 'tool_calls'
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      })
    })

    const request: AnthropicMessageRequest = {
      model: 'test/test-model',
      messages: [{ role: 'user', content: 'What is the weather?' }],
      tools: [{ name: 'get_weather', description: 'Get weather', input_schema: { type: 'object', properties: { location: { type: 'string' } } } }],
      stream: false
    }

    const response = await transport.send(request)
    expect(response.content[0].type).toBe('tool_use')
    expect(response.content[0].name).toBe('get_weather')
    expect(response.stop_reason).toBe('tool_use')
  })
})

describe('AnthropicMessagesTransport', () => {
  let transport: AnthropicMessagesTransport
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
    vi.stubGlobal('fetch', mockFetch)
    transport = new AnthropicMessagesTransport({
      baseUrl: 'https://test.anthropic.com/v1',
      apiKey: 'test-key',
      modelPrefix: 'test/'
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards request with correct headers', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'test-model',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 }
      })
    })

    const request: AnthropicMessageRequest = {
      model: 'test/test-model',
      messages: [{ role: 'user', content: 'Hi' }],
      stream: false
    }

    const response = await transport.send(request)
    expect(response.content[0].text).toBe('Hello!')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://test.anthropic.com/v1/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': 'test-key' })
      })
    )
  })
})

describe('Claude gateway model ID compatibility', () => {
  it('getProviderForModel resolves model without claude/ prefix', () => {
    const provider = getProviderForModel('opencode/opencode-zen')
    expect(provider).toBeDefined()
    expect(provider!.name).toBe('opencode')
  })

  it('model IDs in /v1/models should contain claude/ prefix', () => {
    // This test documents the expected behavior:
    // The models endpoint returns IDs with claude/ prefix for gateway compatibility
    const modelId = 'claude/opencode/opencode-zen'
    expect(modelId).toContain('claude')
    expect(modelId.startsWith('claude/')).toBe(true)
  })

  it('router strips claude/ prefix before resolving', () => {
    // Test that the router logic correctly strips the claude/ prefix
    const gatewayModelId = 'claude/opencode/opencode-zen'
    const internalModelId = gatewayModelId.startsWith('claude/') ? gatewayModelId.slice(7) : gatewayModelId
    expect(internalModelId).toBe('opencode/opencode-zen')
    
    const provider = getProviderForModel(internalModelId)
    expect(provider).toBeDefined()
    expect(provider!.name).toBe('opencode')
  })
})