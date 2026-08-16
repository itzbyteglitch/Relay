import { AnthropicMessageRequest, AnthropicMessageResponse, AnthropicStreamEvent } from '../types/anthropic'

export interface ProviderConfig {
  baseUrl: string
  apiKey: string
  modelPrefix: string
}

export class AnthropicMessagesTransport {
  constructor(private config: ProviderConfig) {}

  async send(request: AnthropicMessageRequest): Promise<AnthropicMessageResponse> {
    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(request)
    })

    if (!response.ok) {
      throw new Error(`Anthropic transport error: ${response.status}`)
    }

    return response.json()
  }

  async *stream(request: AnthropicMessageRequest): AsyncGenerator<AnthropicStreamEvent> {
    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ ...request, stream: true })
    })

    if (!response.ok) {
      throw new Error(`Anthropic transport error: ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') return
          try {
            yield JSON.parse(data)
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}