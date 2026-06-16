import { configToCustomOptions } from '../api/config-mapper';
import {
  Configuration,
  InferenceApiMessage,
  InferenceProvider,
  PendingMessage,
} from '../types';
import { filterThoughtFromMsgs } from '../utils/message-parser';

export interface GenerateStreamParams {
  provider: InferenceProvider;
  config: Configuration;
  model: string;
  messages: InferenceApiMessage[];
  signal: AbortSignal;
  onUpdate: (msgUpdate: Partial<PendingMessage>) => void;
}

/**
 * Handles the inference API stream generation.
 * Yields partial updates to a PendingMessage via onUpdate.
 */
export const generateChatStream = async ({
  provider,
  config,
  model,
  messages,
  signal,
  onUpdate,
}: GenerateStreamParams): Promise<void> => {
  const { excludeThoughtOnReq } = config;

  const chunks = await provider.postChatCompletions(
    model,
    excludeThoughtOnReq ? filterThoughtFromMsgs(messages) : messages,
    signal,
    configToCustomOptions(config)
  );

  let content = '';
  let reasoning_content = '';

  for await (const chunk of chunks) {
    if (chunk.error) {
      throw new Error(chunk.error?.message || 'Unknown error');
    }
    if (!chunk.choices || !Array.isArray(chunk.choices)) {
      console.warn('Invalid chunk format received:', chunk);
      continue;
    }
    if (chunk.choices.length === 0) {
      console.warn('Empty choices array in chunk:', chunk);
      continue;
    }

    const choice = chunk.choices[0];
    const addedContent = choice.delta.content;
    const addedReasoning =
      choice.delta.reasoning_content || choice.delta.reasoning;

    const update: Partial<PendingMessage> = {};

    if (addedContent) {
      content += addedContent;
      update.content = content;
    }

    if (addedReasoning) {
      reasoning_content += addedReasoning;
      update.reasoning_content = reasoning_content;
    }

    if (chunk.timings) {
      update.timings = {
        prompt_n: chunk.timings.prompt_n,
        prompt_ms: chunk.timings.prompt_ms,
        predicted_n: chunk.timings.predicted_n,
        predicted_ms: chunk.timings.predicted_ms,
      };
    } else if (chunk.usage) {
      update.timings = {
        prompt_n: chunk.usage.prompt_tokens,
        predicted_n: chunk.usage.completion_tokens,
      };
    }

    if (Object.keys(update).length > 0) {
      onUpdate(update);
    }
  }
};
