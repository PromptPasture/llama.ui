import {
  InferenceApiMessage,
  InferenceApiMessageContentPart,
  Message,
} from '../types';

/**
 * Converts application message format to API-compatible message structure.
 * Processes extra content (context, files) and formats them according to API requirements.
 *
 * @param messages - Array of messages in application format to normalize
 * @returns Array of messages formatted for API consumption
 *
 * @remarks
 * This function processes extra content first, followed by the user message,
 * which allows for better cache prefix utilization with long context windows. [[3]]
 */
export function normalizeMsgsForAPI(
  messages: Readonly<Message[]>
): InferenceApiMessage[] {
  return messages.map((msg) => {
    if (msg.role !== 'user' || !msg.extra) {
      return {
        role: msg.role,
        content: msg.content,
      };
    }

    // extra content first, then user text message in the end
    // this allow re-using the same cache prefix for long context
    const contentArr: InferenceApiMessageContentPart[] = [];

    for (const extra of msg.extra ?? []) {
      if (extra.type === 'context') {
        contentArr.push({
          type: 'text',
          text: extra.content,
        });
      } else if (extra.type === 'textFile') {
        contentArr.push({
          type: 'text',
          text: `File: ${extra.name}\nContent:\n\n${extra.content}`,
        });
      } else if (extra.type === 'imageFile') {
        contentArr.push({
          type: 'image_url',
          image_url: { url: extra.base64Url },
        });
      } else if (extra.type === 'audioFile') {
        contentArr.push({
          type: 'input_audio',
          input_audio: {
            data: extra.base64Data,
            format: /wav/.test(extra.mimeType) ? 'wav' : 'mp3',
          },
        });
      } else {
        throw new Error('Unknown extra type');
      }
    }

    // add user message to the end
    contentArr.push({
      type: 'text',
      text: msg.content,
    });

    return {
      role: msg.role,
      content: contentArr,
    };
  });
}
