import { InferenceApiMessage } from '../types';

/**
 * Splits message content into actual content and reasoning content by parsing think tags.
 *
 * @param content - The text to parse
 * @returns An object mapping content and reasoning
 */
export const splitMessageContent = (content: string | null) => {
  if (content == null || content.trim().length === 0) return { content };

  const REGEX_THINK_OPEN = /<think>|<\|channel\|>analysis<\|message\|>/;
  const REGEX_THINK_CLOSE =
    /<\/think>|<\|start\|>assistant<\|channel\|>final<\|message\|>/;

  let actualContent = '';
  let thought = '';
  let thinkSplit = content.split(REGEX_THINK_OPEN, 2);
  actualContent += thinkSplit[0];
  while (thinkSplit[1] !== undefined) {
    // <think> tag found
    thinkSplit = thinkSplit[1].split(REGEX_THINK_CLOSE, 2);
    thought += thinkSplit[0];
    if (thinkSplit[1] !== undefined) {
      // </think> closing tag found
      thinkSplit = thinkSplit[1].split(REGEX_THINK_OPEN, 2);
      actualContent += thinkSplit[0];
    }
  }
  return { content: actualContent, reasoning_content: thought };
};

/**
 * Filters out thinking process content from assistant messages.
 * Specifically removes content between <think> and </think> tags for DeepsSeek-R1 model compatibility.
 *
 * @param messages - API-formatted messages to process
 * @returns Messages with thinking process content removed from assistant responses
 *
 * @remarks
 * In development mode, this function logs the original messages for debugging purposes. [[7]]
 */
export function filterThoughtFromMsgs(
  messages: InferenceApiMessage[]
): InferenceApiMessage[] {
  return messages.map((msg) => {
    if (msg.role !== 'assistant') {
      return msg;
    }
    // assistant message is always a string
    const splittedMessage = splitMessageContent(msg.content as string);
    return {
      role: msg.role,
      content: splittedMessage.content || '',
    };
  });
}
