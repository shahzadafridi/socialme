/** Minimal SSE reader. Yields the `data:` payload of each event. */

export async function* readSSE(res: Response): AsyncGenerator<string> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

      let index: number;
      while ((index = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        for (const line of block.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') continue;
          yield data;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Pull text out of a streamed JSON chunk, tolerating shape variations. */
export function pickText(payload: any): string {
  if (!payload || typeof payload !== 'object') return '';

  // OpenAI / DeepSeek / OpenRouter / compatible
  const choice = payload.choices?.[0];
  if (choice) {
    const delta = choice.delta ?? choice.message;
    const content = delta?.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content
        .map((part: any) => (typeof part === 'string' ? part : part?.text ?? ''))
        .join('');
    }
  }

  // Anthropic
  if (payload.type === 'content_block_delta' && payload.delta?.type === 'text_delta') {
    return payload.delta.text ?? '';
  }

  // Gemini
  const parts = payload.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) {
    return parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('');
  }

  return '';
}
