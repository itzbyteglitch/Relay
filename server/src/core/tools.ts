export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export function normalizeToolUseBlock(block: unknown): ToolUseBlock | null {
  if (!block || typeof block !== 'object') return null
  const b = block as Record<string, unknown>
  if (b.type !== 'tool_use') return null
  if (typeof b.id !== 'string' || typeof b.name !== 'string' || typeof b.input !== 'object') return null
  return {
    type: 'tool_use',
    id: b.id,
    name: b.name,
    input: b.input as Record<string, unknown>
  }
}

export function convertOpenAIToolCalls(toolCalls: unknown[]): ToolUseBlock[] {
  return toolCalls
    .map((tc: unknown) => {
      if (!tc || typeof tc !== 'object') return null
      const t = tc as Record<string, unknown>
      if (t.type !== 'function') return null
      const fn = t.function as Record<string, unknown>
      if (typeof fn.name !== 'string' || typeof fn.arguments !== 'string') return null
      try {
        return {
          type: 'tool_use' as const,
          id: typeof t.id === 'string' ? t.id : `toolu_${crypto.randomUUID()}`,
          name: fn.name,
          input: JSON.parse(fn.arguments)
        }
      } catch {
        return null
      }
    })
    .filter((t): t is ToolUseBlock => t !== null)
}