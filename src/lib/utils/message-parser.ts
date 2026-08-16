import { InferenceApiMessage } from '../types';

/**
 * Splits message content into actual content and reasoning content by parsing think tags.
 *
 * @param content - The text to parse
 * @returns An object mapping content and reasoning
 */
/**
 * Splits text at the first match of `pattern` into the part before it and the
 * whole remainder. `String.split(pattern, 2)` cannot be used here: its limit
 * truncates the result array rather than keeping the tail, so anything past the
 * second delimiter would be discarded.
 *
 * @param text - The text to split
 * @param pattern - The delimiter to split on
 * @returns The leading part, plus the remainder when the pattern matched
 */
const splitOnce = (text: string, pattern: RegExp): [string, string?] => {
  const match = pattern.exec(text);
  if (!match) return [text];
  return [
    text.slice(0, match.index),
    text.slice(match.index + match[0].length),
  ];
};

export const splitMessageContent = (content: string | null) => {
  if (content == null || content.trim().length === 0) return { content };

  const REGEX_THINK_OPEN = /<think>|<\|channel\|>analysis<\|message\|>/;
  const REGEX_THINK_CLOSE =
    /<\/think>|<\|start\|>assistant<\|channel\|>final<\|message\|>/;

  let actualContent = '';
  let thought = '';
  let thinkSplit = splitOnce(content, REGEX_THINK_OPEN);
  actualContent += thinkSplit[0];
  while (thinkSplit[1] !== undefined) {
    // <think> tag found
    thinkSplit = splitOnce(thinkSplit[1], REGEX_THINK_CLOSE);
    thought += thinkSplit[0];
    if (thinkSplit[1] !== undefined) {
      // </think> closing tag found
      thinkSplit = splitOnce(thinkSplit[1], REGEX_THINK_OPEN);
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
