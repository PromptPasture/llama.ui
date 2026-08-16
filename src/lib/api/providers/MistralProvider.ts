import { InferenceApiModel, Modality } from '../../types';
import { CloudOpenAIProvider } from './CloudOpenAIProvider';

export interface MistralModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  capabilities: Capabilities;
  name: string;
  description: string;
  max_context_length: number;
  aliases: string[];
  default_model_temperature?: number;
  type: string;
}

export interface Capabilities {
  completion_chat: boolean;
  function_calling: boolean;
  completion_fim: boolean;
  fine_tuning: boolean;
  vision: boolean;
  ocr: boolean;
  classification: boolean;
  moderation: boolean;
  audio: boolean;
}

export class MistralProvider extends CloudOpenAIProvider {
  static new(baseUrl?: string, apiKey: string = ''): MistralProvider {
    return new MistralProvider(baseUrl, apiKey);
  }

  /** @inheritdoc */
  protected jsonToModels(data: unknown[]): InferenceApiModel[] {
    const res = super.jsonToModels(data);
    return res.filter(
      (obj, index, self) => index === self.findIndex((t) => t.id === obj.id)
    );
  }

  /** @inheritdoc */
  protected jsonToModel(m: unknown): InferenceApiModel {
    const model = m as MistralModel;

    // A model that lists no capabilities used to throw here, and the throw
    // came out of the whole fetch: one entry short of a field and the picker
    // showed nothing at all.
    const can = model.capabilities ?? ({} as MistralModel['capabilities']);
    const modalities: Modality[] = [];
    if (can.completion_chat) modalities.push('text');
    if (can.vision) modalities.push('image');
    if (can.audio) modalities.push('audio');

    return {
      id: model.id,
      name: model.name || model.id,
      description: model.description,
      created: model.created,
      modalities,
    };
  }
}
