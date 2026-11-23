import type { ImageModelOption } from '@chatbox/core/application/image-generation'
import { fetchOpenRouterImageModels } from '@shared/providers/definitions/models/openrouter-image-api'
import { isGeminiImageModel } from '@shared/providers/definitions/image-models'
import { ModelProviderEnum } from '@shared/types'

export type { ImageModelOption } from '@chatbox/core/application/image-generation'

import { createModelDependencies } from '@/adapters'
import { getProviderDefinition } from '@shared/providers'
export interface ImageModelCatalogOptions {
  apiKey?: string
  language?: string
}

export async function loadProviderImageModels(
  provider: ModelProviderEnum,
  options: ImageModelCatalogOptions = {}
): Promise<ImageModelOption[]> {
  if (provider === ModelProviderEnum.OpenRouter && options.apiKey) {
    try {
      const dependencies = await createModelDependencies()
      const models = await fetchOpenRouterImageModels(options.apiKey, dependencies)
      return models.map((model) => ({
        modelId: model.modelId,
        displayName: model.nickname,
        ...(model.description ? { description: model.description } : {}),
        capabilities: model.capabilities,
      }))
    } catch {
      // Use the built-in catalog when OpenRouter is unreachable.
    }
  }

  if (provider === ModelProviderEnum.OpenAI) {
    return [
      { modelId: 'gpt-image-1.5', displayName: 'GPT Image 1.5' },
      { modelId: 'gpt-image-1', displayName: 'GPT Image 1' },
      { modelId: 'gpt-image-1-mini', displayName: 'GPT Image 1 Mini' },
    ]
  }

  return (getProviderDefinition(provider)?.defaultSettings?.models ?? [])
    .filter(
      (model) => model.type === 'image' || (provider === ModelProviderEnum.Gemini && isGeminiImageModel(model.modelId))
    )
    .map((model) => ({ modelId: model.modelId, displayName: model.nickname || model.modelId }))
}
