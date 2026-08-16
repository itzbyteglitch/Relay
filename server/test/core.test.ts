import { describe, it, expect } from 'vitest'
import { encodeSSE, parseSSE, createMessageStartEvent, createContentBlockStartEvent, createContentBlockDeltaEvent, createContentBlockStopEvent, createMessageDeltaEvent, createMessageStopEvent, createErrorEvent } from '../src/core/sse'
import { normalizeThinkingBlock, extractThinkingFromOpenAI } from '../src/core/thinking'
import { normalizeToolUseBlock, convertOpenAIToolCalls } from '../src/core/tools'
import { normalizeUsage, mergeUsage } from '../src/core/usage'

describe('SSE encoding/decoding', () => {
  it('encodes and parses a simple event', () => {
    const event = { event: 'test', data: '{"key":"value"}' }
    const encoded = encodeSSE(event)
    expect(encoded).toContain('event: test')
    expect(encoded).toContain('data: {"key":"value"}')
    expect(encoded.endsWith('\n\n')).toBe(true)

    const parsed = parseSSE(encoded)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toEqual(event)
  })

  it('parses multiple events', () => {
    const events = [
      { event: 'a', data: '1' },
      { event: 'b', data: '2' }
    ]
    const encoded = events.map(encodeSSE).join('')
    const parsed = parseSSE(encoded)
    expect(parsed).toEqual(events)
  })
})

describe('SSE event creators', () => {
  it('creates message_start event', () => {
    const event = createMessageStartEvent('msg_123')
    expect(event.event).toBe('message_start')
    const data = JSON.parse(event.data)
    expect(data.type).toBe('message_start')
    expect(data.message.id).toBe('msg_123')
  })

  it('creates content_block_start event', () => {
    const event = createContentBlockStartEvent(0, 'text')
    expect(event.event).toBe('content_block_start')
    const data = JSON.parse(event.data)
    expect(data.index).toBe(0)
    expect(data.content_block.type).toBe('text')
  })

  it('creates content_block_delta event for text', () => {
    const event = createContentBlockDeltaEvent(0, { type: 'text_delta', text: 'hello' })
    expect(event.event).toBe('content_block_delta')
    const data = JSON.parse(event.data)
    expect(data.delta.type).toBe('text_delta')
    expect(data.delta.text).toBe('hello')
  })

  it('creates content_block_stop event', () => {
    const event = createContentBlockStopEvent(0)
    expect(event.event).toBe('content_block_stop')
  })

  it('creates message_delta event', () => {
    const event = createMessageDeltaEvent({ stop_reason: 'end_turn', stop_sequence: null }, { output_tokens: 10 })
    expect(event.event).toBe('message_delta')
  })

  it('creates message_stop event', () => {
    const event = createMessageStopEvent()
    expect(event.event).toBe('message_stop')
  })

  it('creates error event', () => {
    const event = createErrorEvent({ type: 'api_error', message: 'Something went wrong' })
    expect(event.event).toBe('error')
  })
})

describe('thinking block normalization', () => {
  it('normalizes valid thinking block', () => {
    const block = { type: 'thinking', thinking: 'some thought', signature: 'sig123' }
    const result = normalizeThinkingBlock(block)
    expect(result).toEqual(block)
  })

  it('rejects non-thinking block', () => {
    const block = { type: 'text', text: 'hello' }
    expect(normalizeThinkingBlock(block)).toBeNull()
  })

  it('rejects invalid thinking block', () => {
    const block = { type: 'thinking', thinking: 123, signature: 'sig' }
    expect(normalizeThinkingBlock(block)).toBeNull()
  })
})

describe('tool use normalization', () => {
  it('normalizes valid tool use block', () => {
    const block = { type: 'tool_use', id: 'toolu_123', name: 'get_weather', input: { location: 'NYC' } }
    const result = normalizeToolUseBlock(block)
    expect(result).toEqual(block)
  })

  it('rejects invalid tool use block', () => {
    const block = { type: 'tool_use', id: 123, name: 'get_weather' }
    expect(normalizeToolUseBlock(block)).toBeNull()
  })

  it('converts OpenAI tool calls', () => {
    const openAITools = [
      {
        id: 'call_123',
        type: 'function',
        function: { name: 'get_weather', arguments: '{"location":"NYC"}' }
      }
    ]
    const result = convertOpenAIToolCalls(openAITools)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('tool_use')
    expect(result[0].name).toBe('get_weather')
    expect(result[0].input).toEqual({ location: 'NYC' })
  })

  it('handles malformed OpenAI tool calls', () => {
    const openAITools = [
      { id: 'call_123', type: 'function', function: { name: 'get_weather', arguments: 'invalid json' } }
    ]
    const result = convertOpenAIToolCalls(openAITools)
    expect(result).toHaveLength(0)
  })
})

describe('usage normalization', () => {
  it('normalizes OpenAI usage', () => {
    const usage = { prompt_tokens: 10, completion_tokens: 20 }
    const result = normalizeUsage(usage)
    expect(result).toEqual({ input_tokens: 10, output_tokens: 20 })
  })

  it('normalizes Anthropic usage', () => {
    const usage = { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 5, cache_read_input_tokens: 3 }
    const result = normalizeUsage(usage)
    expect(result).toEqual({ input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 5, cache_read_input_tokens: 3 })
  })

  it('handles missing usage', () => {
    const result = normalizeUsage(null)
    expect(result).toEqual({ input_tokens: 0, output_tokens: 0 })
  })

  it('merges usage correctly', () => {
    const a = { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 5, cache_read_input_tokens: 3 }
    const b = { input_tokens: 5, output_tokens: 10, cache_creation_input_tokens: 2, cache_read_input_tokens: 1 }
    const result = mergeUsage(a, b)
    expect(result).toEqual({ input_tokens: 15, output_tokens: 30, cache_creation_input_tokens: 7, cache_read_input_tokens: 4 })
  })
})