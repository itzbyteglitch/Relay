export interface SSEEvent {
  event: string
  data: string
}

export function encodeSSE(event: SSEEvent): string {
  return `event: ${event.event}\ndata: ${event.data}\n\n`
}

export function parseSSE(data: string): SSEEvent[] {
  const events: SSEEvent[] = []
  const lines = data.split('\n')
  let currentEvent: Partial<SSEEvent> = {}

  for (const line of lines) {
    if (line.startsWith('event:')) {
      currentEvent.event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      currentEvent.data = line.slice(5).trim()
    } else if (line === '') {
      if (currentEvent.event && currentEvent.data) {
        events.push(currentEvent as SSEEvent)
        currentEvent = {}
      }
    }
  }

  return events
}

export function createMessageStartEvent(messageId: string): SSEEvent {
  return {
    event: 'message_start',
    data: JSON.stringify({
      type: 'message_start',
      message: {
        id: messageId,
        type: 'message',
        role: 'assistant',
        content: [],
        model: '',
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 0, output_tokens: 0 }
      }
    })
  }
}

export function createContentBlockStartEvent(index: number, blockType: 'text' | 'tool_use'): SSEEvent {
  return {
    event: 'content_block_start',
    data: JSON.stringify({
      type: 'content_block_start',
      index,
      content_block: { type: blockType }
    })
  }
}

export function createContentBlockDeltaEvent(index: number, delta: { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string }): SSEEvent {
  return {
    event: 'content_block_delta',
    data: JSON.stringify({
      type: 'content_block_delta',
      index,
      delta
    })
  }
}

export function createContentBlockStopEvent(index: number): SSEEvent {
  return {
    event: 'content_block_stop',
    data: JSON.stringify({
      type: 'content_block_stop',
      index
    })
  }
}

export function createMessageDeltaEvent(delta: { stop_reason: string | null; stop_sequence: string | null }, usage: { output_tokens: number }): SSEEvent {
  return {
    event: 'message_delta',
    data: JSON.stringify({
      type: 'message_delta',
      delta,
      usage
    })
  }
}

export function createMessageStopEvent(): SSEEvent {
  return {
    event: 'message_stop',
    data: JSON.stringify({ type: 'message_stop' })
  }
}

export function createErrorEvent(error: { type: string; message: string }): SSEEvent {
  return {
    event: 'error',
    data: JSON.stringify({ type: 'error', error })
  }
}