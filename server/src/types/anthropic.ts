export interface AnthropicMessageRequest {
  model: string
  messages: AnthropicMessage[]
  system?: string | AnthropicContentBlock[]
  stream?: boolean
  tools?: AnthropicTool[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  temperature?: number
  max_tokens?: number
}

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

export interface AnthropicContentBlock {
  type: 'text' | 'image' | 'tool_use' | 'tool_result'
  text?: string
  source?: { type: 'base64'; media_type: string; data: string }
  id?: string
  name?: string
  input?: Record<string, unknown>
  tool_use_id?: string
  content?: unknown
}

export interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

export interface AnthropicMessageResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: AnthropicContentBlock[]
  model: string
  stop_reason: string | null
  stop_sequence: string | null
  usage: {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
}

export interface AnthropicStreamEvent {
  type: string
  message?: AnthropicMessageResponse
  index?: number
  content_block?: AnthropicContentBlock
  delta?: { type: string; text?: string; partial_json?: string }
  usage?: { output_tokens: number }
}

export interface AnthropicModelsResponse {
  data: AnthropicModel[]
  has_more: boolean
  first_id: string
  last_id: string
}

export interface AnthropicModel {
  id: string
  type: 'model'
  display_name: string
  created_at: string
}