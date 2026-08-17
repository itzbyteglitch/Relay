import { Hono } from 'hono'
import { createKVHelpers } from '../kv'
import { resolveTransport } from '../providers/router'
import { encodeSSE, SSEEvent } from '../core/sse'

const messages = new Hono<{ Bindings: { RELAY_KV: KVNamespace }; Variables: { kvHelpers: ReturnType<typeof createKVHelpers>; deviceUuid: string } }>()

messages.post('/', async (c) => {
  const body = await c.req.json()
  const { model, stream } = body

  if (!model) {
    return c.json({ error: 'Missing model' }, 400)
  }

  const kvHelpers = c.get('kvHelpers')
  const deviceUuid = c.get('deviceUuid')

  const transport = await resolveTransport(model, kvHelpers)
  if (!transport) {
    return c.json({ error: 'Model not found or provider not configured' }, 404)
  }

  if (stream) {
    return streamResponse(c, transport, body)
  } else {
    try {
      const response = await transport.send(body)
      return c.json(response)
    } catch (e: any) {
      return c.json({ error: 'Upstream error', details: e.message }, 502)
    }
  }
})

async function streamResponse(c: any, transport: any, body: any) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const messageId = `msg_${crypto.randomUUID()}`
      let firstEvent = true

      try {
        for await (const event of transport.stream(body)) {
          if (firstEvent) {
            controller.enqueue(encoder.encode(encodeSSE({
              event: 'message_start',
              data: JSON.stringify({
                type: 'message_start',
                message: {
                  id: messageId,
                  type: 'message',
                  role: 'assistant',
                  content: [],
                  model: body.model,
                  stop_reason: null,
                  stop_sequence: null,
                  usage: { input_tokens: 0, output_tokens: 0 }
                }
              })
            })))
            firstEvent = false
          }
          controller.enqueue(encoder.encode(encodeSSE(event)))
        }
        controller.close()
      } catch (e) {
        controller.enqueue(encoder.encode(encodeSSE({
          event: 'error',
          data: JSON.stringify({ type: 'error', error: { type: 'api_error', message: 'Stream error' } })
        })))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}

messages.post('/count_tokens', async (c) => {
  return c.json({
    input_tokens: 0,
    output_tokens: 0
  })
})

export default messages