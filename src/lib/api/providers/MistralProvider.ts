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

    const modalities: Modality[] = [];
    if (model.capabilities.completion_chat) modalities.push('text');
    if (model.capabilities.vision) modalities.push('image');
    if (model.capabilities.audio) modalities.push('audio');

    return {
      id: model.id,
      name: model.name,
      description: model.description,
      created: model.created,
      modalities,
    };
  }
}
