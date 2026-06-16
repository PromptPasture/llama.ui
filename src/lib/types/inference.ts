import { Message } from './chat';

/**
 * Specifies the supported modalities for input or output in the inference API.
 * This enum-like type defines the possible content formats that the model can process or generate.
 */
export type Modality = 'text' | 'image' | 'audio' | 'video';

/**
 * Represents a single content part in an API message, supporting multiple content types
 * including text, images, and audio inputs for multimodal interactions. [[9]]
 */
export type InferenceApiMessageContentPart =
  | {
      /** The content type identifier */
      type: 'text';
      /** The text content */
      text: string;
    }
  | {
      /** The content type identifier */
      type: 'image_url';
      /** Image URL details */
      image_url: { url: string };
    }
  | {
      /** The content type identifier */
      type: 'input_audio';
      /** Audio input details */
      input_audio: { data: string; format: 'wav' | 'mp3' };
    };

/**
 * Represents a message structure compatible with the API endpoint.
 * Can contain either a simple string or an array of content parts for multimodal support. [[4]]
 */
export type InferenceApiMessage = {
  /** The role of the message sender (system, user, assistant) */
  role: Message['role'];
  /** The message content, which can be a string or structured content parts */
  content: string | InferenceApiMessageContentPart[];
};

/**
 * Represents model information returned by the API's models endpoint.
 * Contains basic model metadata that clients might need for display or selection.
 *
 * @example
 * {
 *   id: 'gpt-4-vision',
 *   name: 'GPT-4 Vision',
 *   description: 'Multimodal model supporting text and images',
 *   created: 1690000000000,
 *   modalities: ['text', 'image'],
 *   output_modalities: ['text']
 * }
 */
export type InferenceApiModel = {
  /** Unique model identifier, used for API requests to specify the model */
  id: string;
  /** User-friendly model name (optional) */
  name: string;
  /** A brief description of the model's capabilities or usage (optional) */
  description?: string;
  /** Timestamp of model creation in Unix milliseconds (optional) */
  created?: number;
  /** Array of supported input modalities for the model (optional) */
  modalities?: Modality[];
  /** Array of supported output modalities for the model (optional) */
  output_modalities?: Modality[];
};
