import { AnthropicMessageRequest, AnthropicMessageResponse, AnthropicStreamEvent } from '../types/anthropic'
import { encodeSSE, SSEEvent } from '../core/sse'
import { normalizeToolUseBlock, convertOpenAIToolCalls } from '../core/tools'
import { normalizeUsage } from '../core/usage'

export interface ProviderConfig {
  baseUrl: string
  apiKey: string
  modelPrefix: string
}

export interface OpenAIMessageRequest {
  model: string
  messages: OpenAIMessage[]
  stream?: boolean
  tools?: OpenAITool[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  temperature?: number
  max_tokens?: number
}

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | OpenAIContentBlock[]
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
  name?: string
}

export interface OpenAIContentBlock {
  type: 'text' | 'image_url'
  text?: string
  image_url?: { url: string }
}

export interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface OpenAIToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface OpenAIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: OpenAIChoice[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
  }
}

export interface OpenAIChoice {
  index: number
  message: OpenAIMessage
  finish_reason: string | null
}

export interface OpenAIStreamEvent {
  id: string
  object: string
  created: number
  model: string
  choices: OpenAIStreamChoice[]
}

export interface OpenAIStreamChoice {
  index: number
  delta: {
    role?: string
    content?: string | null
    tool_calls?: OpenAIStreamToolCall[]
  }
  finish_reason: string | null
}

export interface OpenAIStreamToolCall {
  index: number
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export class OpenAIChatTransport {
  constructor(private config: ProviderConfig) {}

  private convertToOpenAI(request: AnthropicMessageRequest): OpenAIMessageRequest {
    const messages: OpenAIMessage[] = []

    if (request.system) {
      if (typeof request.system === 'string') {
        messages.push({ role: 'system', content: request.system })
      } else {
        for (const block of request.system) {
          if (block.type === 'text' && block.text) {
            messages.push({ role: 'system', content: block.text })
          }
        }
      }
    }

    for (const msg of request.messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        if (typeof msg.content === 'string') {
          messages.push({ role: msg.role, content: msg.content })
        } else {
          const content: OpenAIContentBlock[] = []
          for (const block of msg.content) {
            if (block.type === 'text') {
              content.push({ type: 'text', text: block.text })
            } else if (block.type === 'image') {
              if (block.source?.data) {
                content.push({ type: 'image_url', image_url: { url: block.source.data } })
              }
            } else if (block.type === 'tool_result') {
              messages.push({
                role: 'tool',
                content: JSON.stringify(block.content),
                tool_call_id: block.tool_use_id
              })
            }
          }
          if (content.length > 0) {
            messages.push({ role: msg.role, content })
          }
        }
      }
    }

    const tools: OpenAITool[] = []
    if (request.tools) {
      for (const tool of request.tools) {
        tools.push({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description || '',
            parameters: tool.input_schema
          }
        })
      }
    }

    // Strip claude/ gateway prefix if present
    const modelForUpstream = request.model.startsWith('claude/')
      ? request.model.slice(7)
      : request.model

    return {
      model: modelForUpstream.replace(this.config.modelPrefix, ''),
      messages,
      stream: request.stream,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: request.tool_choice === 'auto' ? 'auto' : request.tool_choice === 'none' ? 'none' : undefined,
      temperature: request.temperature,
      max_tokens: request.max_tokens
    }
  }

  private convertFromOpenAI(response: OpenAIResponse): AnthropicMessageResponse {
    const choice = response.choices[0]
    const content: AnthropicMessageResponse['content'] = []

    if (choice.message.content) {
      if (typeof choice.message.content === 'string') {
        content.push({ type: 'text', text: choice.message.content })
      } else {
        for (const block of choice.message.content) {
          if (block.type === 'text') {
            content.push({ type: 'text', text: block.text })
          }
        }
      }
    }

    if (choice.message.tool_calls) {
      for (const tc of convertOpenAIToolCalls(choice.message.tool_calls)) {
        content.push(tc)
      }
    }

    return {
      id: response.id,
      type: 'message',
      role: 'assistant',
      content,
      model: response.model,
      stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn',
      stop_sequence: null,
      usage: normalizeUsage(response.usage)
    }
  }

  private convertStreamEvent(event: OpenAIStreamEvent): SSEEvent[] {
    const choice = event.choices[0]
    const events: SSEEvent[] = []

    if (choice.delta.role) {
      const sseEvent: SSEEvent = {
        event: 'message_start' as string,
        data: JSON.stringify({
          type: 'message_start',
          message: {
            id: event.id,
            type: 'message',
            role: 'assistant',
            content: [],
            model: event.model,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 }
          }
        })
      }
      events.push(sseEvent)
    }

    if (choice.delta.content) {
      const startEvent: SSEEvent = {
        event: 'content_block_start',
        data: JSON.stringify({
          type: 'content_block_start',
          index: 0,
          content_block: { type: 'text' }
        })
      }
      events.push(startEvent)
      const deltaEvent: SSEEvent = {
        event: 'content_block_delta',
        data: JSON.stringify({
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'text_delta', text: choice.delta.content }
        })
      }
      events.push(deltaEvent)
    }

    if (choice.delta.tool_calls) {
      for (const tc of choice.delta.tool_calls) {
        if (tc.index === 0) {
          const startEvent: SSEEvent = {
            event: 'content_block_start',
            data: JSON.stringify({
              type: 'content_block_start',
              index: 0,
              content_block: { type: 'tool_use', id: tc.id, name: tc.function.name, input: {} }
            })
          }
          events.push(startEvent)
        }
        if (tc.function.arguments) {
          const deltaEvent: SSEEvent = {
            event: 'content_block_delta',
            data: JSON.stringify({
              type: 'content_block_delta',
              index: tc.index,
              delta: { type: 'input_json_delta', partial_json: tc.function.arguments }
            })
          }
          events.push(deltaEvent)
        }
      }
    }

    if (choice.finish_reason) {
      const stopEvent: SSEEvent = {
        event: 'content_block_stop',
        data: JSON.stringify({ type: 'content_block_stop', index: 0 })
      }
      events.push(stopEvent)
      const deltaEvent: SSEEvent = {
        event: 'message_delta',
        data: JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: choice.finish_reason === 'tool_calls' ? 'tool_use' : choice.finish_reason === 'length' ? 'max_tokens' : 'end_turn', stop_sequence: null },
          usage: { output_tokens: 0 }
        })
      }
      events.push(deltaEvent)
      const stopMsgEvent: SSEEvent = {
        event: 'message_stop',
        data: JSON.stringify({ type: 'message_stop' })
      }
      events.push(stopMsgEvent)
    }

    return events
  }

  async send(request: AnthropicMessageRequest): Promise<AnthropicMessageResponse> {
    const openAIRequest = this.convertToOpenAI(request)

    console.log('OpenAI request model:', openAIRequest.model)
    console.log('OpenAI request baseUrl:', this.config.baseUrl)
    console.log('OpenAI request apiKey prefix:', this.config.apiKey?.substring(0, 10) + '...')

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(openAIRequest)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Upstream error:', response.status, errorText)
      // Return error details in response for debugging
      throw new Error(`OpenAI transport error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as OpenAIResponse
    return this.convertFromOpenAI(data)
  }

  async *stream(request: AnthropicMessageRequest): AsyncGenerator<string> {
    const openAIRequest = this.convertToOpenAI(request)

    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({ ...openAIRequest, stream: true })
    })

    if (!response.ok) {
      throw new Error(`OpenAI transport error: ${response.status}`)
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
            const event = JSON.parse(data) as OpenAIStreamEvent
            for (const sseEvent of this.convertStreamEvent(event)) {
              yield encodeSSE(sseEvent)
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  }
}