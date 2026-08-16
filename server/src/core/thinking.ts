export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
  signature: string
}

export function normalizeThinkingBlock(block: unknown): ThinkingBlock | null {
  if (!block || typeof block !== 'object') return null
  const b = block as Record<string, unknown>
  if (b.type !== 'thinking') return null
  if (typeof b.thinking !== 'string' || typeof b.signature !== 'string') return null
  return {
    type: 'thinking',
    thinking: b.thinking,
    signature: b.signature
  }
}

export function extractThinkingFromOpenAI(response: unknown): ThinkingBlock[] {
  // OpenAI doesn't have native thinking blocks; this is a placeholder
  // for providers that might add thinking-like metadata
  return []
}