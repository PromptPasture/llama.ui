import { SSEData, SSEMessage } from '../types';

/**
 * Process SSE stream from Response object and return async generator
 */
export async function* processSSEStream<T = SSEData>(
  response: Response
): AsyncGenerator<T, void, undefined> {
  if (!response.body) {
    throw new Error('Response body is empty');
  }

  // Create a reader for the response body
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      // Split buffer into lines
      const lines = buffer.split('\n');
      // Keep the last incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;

        const sseMessage = parseSSELine(line);
        if (sseMessage) {
          if (sseMessage.type === 'data') {
            if (sseMessage.value === '[DONE]') {
              return; // End the stream
            }
            try {
              const parsedData = JSON.parse(sseMessage.value) as T;
              yield parsedData;
            } catch (error) {
              console.warn(
                'Failed to parse SSE data:',
                sseMessage.value,
                error
              );
              // Optionally throw error or continue
              continue;
            }
          } else if (sseMessage.type === 'error') {
            try {
              const errorData = JSON.parse(sseMessage.value);
              throw new Error(errorData.message || 'SSE Error occurred');
            } catch {
              throw new Error(sseMessage.value);
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse individual SSE line
 */
function parseSSELine(line: string): SSEMessage | null {
  // Skip comment lines (lines starting with :)
  if (line.startsWith(':')) {
    return null;
  }

  // Find the first colon to separate field from value
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    return null;
  }

  const field = line.substring(0, colonIndex).trim();
  const value = line.substring(colonIndex + 1).trim();

  // If the line starts with a colon (field is empty), it's a comment
  if (field === '') {
    return null;
  }

  switch (field.toLowerCase()) {
    case 'data':
      return { type: 'data', value };
    case 'event':
      return { type: 'event', value };
    case 'id':
      return { type: 'id', value };
    case 'retry':
      return { type: 'retry', value };
    case 'error':
      return { type: 'error', value };
    default:
      return null;
  }
}
