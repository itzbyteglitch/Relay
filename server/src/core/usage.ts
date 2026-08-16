export interface Usage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

export function normalizeUsage(usage: unknown): Usage {
  if (!usage || typeof usage !== 'object') {
    return { input_tokens: 0, output_tokens: 0 }
  }
  const u = usage as Record<string, unknown>
  return {
    input_tokens: typeof u.prompt_tokens === 'number' ? u.prompt_tokens : (typeof u.input_tokens === 'number' ? u.input_tokens : 0),
    output_tokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : (typeof u.output_tokens === 'number' ? u.output_tokens : 0),
    cache_creation_input_tokens: typeof u.cache_creation_input_tokens === 'number' ? u.cache_creation_input_tokens : undefined,
    cache_read_input_tokens: typeof u.cache_read_input_tokens === 'number' ? u.cache_read_input_tokens : undefined
  }
}

export function mergeUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_creation_input_tokens: (a.cache_creation_input_tokens ?? 0) + (b.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens: (a.cache_read_input_tokens ?? 0) + (b.cache_read_input_tokens ?? 0)
  }
}