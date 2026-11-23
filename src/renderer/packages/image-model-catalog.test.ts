import { settings as defaultSettings } from '@shared/defaults'
import { ModelProviderEnum, ModelProviderType, type Settings } from '@shared/types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createModelDependenciesMock, fetchOpenRouterImageModelsMock, getModelManifestMock } = vi.hoisted(() => ({
  createModelDependenciesMock: vi.fn(),
  fetchOpenRouterImageModelsMock: vi.fn(),
  getModelManifestMock: vi.fn(),
}))

vi.mock('@/adapters', () => ({ createModelDependencies: createModelDependenciesMock }))
vi.mock('@shared/providers/definitions/models/openrouter-image-api', () => ({
  fetchOpenRouterImageModels: fetchOpenRouterImageModelsMock,
}))
vi.mock('@/packages/remote', () => ({ getModelManifest: getModelManifestMock }))
vi.mock('@/platform', () => ({ default: { type: 'desktop' } }))
vi.mock('@/stores/settingsStore', async () => {
  const { createStore } = await import('zustand/vanilla')
  const { settings } = await import('@shared/defaults')
  return { settingsStore: createStore(() => settings()) }
})
vi.mock('@/lib/utils', () => ({ getLogger: () => ({ error: vi.fn() }) }))

vi.mock('@/stores/queryClient', async () => {
  const { QueryClient } = await import('@tanstack/react-query')
  return { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) }
})

import { queryClient } from '@/stores/queryClient'
import { settingsStore } from '@/stores/settingsStore'
import {
  getAvailableImageModels,
  getImageModelCapabilities,
  providerImageModelsQueryOptions,
} from './image-model-catalog'
import { loadProviderImageModels } from './image-model-provider'

function createSettings(): Settings {
  return defaultSettings()
}

describe('image model catalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    queryClient.clear()
    createModelDependenciesMock.mockResolvedValue({ request: {} })
  })

  it('preserves OpenRouter descriptions and accepts models that omit them', async () => {
    const capabilities = { aspectRatio: null, inputReferences: null }
    fetchOpenRouterImageModelsMock.mockResolvedValue([
      {
        modelId: 'described-image',
        nickname: 'Described Image',
        description: 'Generate images from text and reference images.',
        capabilities,
      },
      { modelId: 'legacy-image', nickname: 'Legacy Image', capabilities },
    ])

    await expect(loadProviderImageModels(ModelProviderEnum.OpenRouter, { apiKey: 'openrouter-key' })).resolves.toEqual([
      {
        modelId: 'described-image',
        displayName: 'Described Image',
        description: 'Generate images from text and reference images.',
        capabilities,
      },
      { modelId: 'legacy-image', displayName: 'Legacy Image', capabilities },
    ])
    expect(getModelManifestMock).not.toHaveBeenCalled()
  })

  it('ignores a saved Chatbox AI license when listing image models', async () => {
    const settings = createSettings()
    settings.licenseKey = 'license'
    await expect(getAvailableImageModels(settings)).resolves.toEqual([])
    expect(getModelManifestMock).not.toHaveBeenCalled()
  })

  it('merges built-in and manual models for configured built-in and custom providers', async () => {
    const settings = createSettings()
    settings.providers = {
      [ModelProviderEnum.Gemini]: {
        apiKey: 'gemini-key',
        models: [{ modelId: 'gemini-remote', type: 'image', nickname: 'Manual Gemini Name' }],
      },
      [ModelProviderEnum.OpenAI]: {
        apiKey: 'openai-key',
        models: [{ modelId: 'openai-manual', type: 'image', nickname: 'Manual OpenAI' }],
      },
      'custom-provider-gemini': {
        models: [{ modelId: 'custom-image', type: 'image', nickname: 'Custom Image' }],
      },
    }
    settings.customProviders = [
      {
        id: 'custom-provider-gemini',
        name: 'Custom Gemini',
        type: ModelProviderType.Gemini,
        isCustom: true,
      },
    ]
    const models = await getAvailableImageModels(settings)
    expect(models).toEqual(
      expect.arrayContaining([
        { provider: ModelProviderEnum.Gemini, modelId: 'gemini-remote', nickname: 'Manual Gemini Name' },
        { provider: 'custom-provider-gemini', modelId: 'gemini-3-pro-image', nickname: 'gemini-3-pro-image' },
        { provider: 'custom-provider-gemini', modelId: 'custom-image', nickname: 'Custom Image' },
        { provider: ModelProviderEnum.OpenAI, modelId: 'gpt-image-1.5', nickname: 'GPT Image 1.5' },
        { provider: ModelProviderEnum.OpenAI, modelId: 'openai-manual', nickname: 'Manual OpenAI' },
      ])
    )
    expect(getModelManifestMock).not.toHaveBeenCalled()
  })

  it('omits unconfigured providers', async () => {
    const settings = createSettings()

    await expect(getAvailableImageModels(settings)).resolves.toEqual([])
    expect(getModelManifestMock).not.toHaveBeenCalled()
  })

  it('keeps manually configured image models when a manifest request fails', async () => {
    const settings = createSettings()
    settings.providers = {
      [ModelProviderEnum.OpenAI]: {
        apiKey: 'openai-key',
        models: [{ modelId: 'manual-only', type: 'image', nickname: 'Manual Only' }],
      },
    }
    getModelManifestMock.mockRejectedValue(new Error('offline'))

    expect(await getAvailableImageModels(settings)).toContainEqual({
      provider: ModelProviderEnum.OpenAI,
      modelId: 'manual-only',
      nickname: 'Manual Only',
    })
  })

  it('omits OpenAI image models when OAuth is active', async () => {
    const settings = createSettings()
    settings.providers = {
      [ModelProviderEnum.OpenAI]: {
        apiKey: 'openai-key',
        activeAuthMode: 'oauth',
        oauth: { accessToken: 'oauth-token' },
        models: [{ modelId: 'gpt-image-2', type: 'image', nickname: 'GPT Image 2' }],
      },
    }

    await expect(getAvailableImageModels(settings)).resolves.toEqual([])
    expect(getModelManifestMock).not.toHaveBeenCalled()
  })

  it('includes OpenRouter remote and manual image models when the provider is configured', async () => {
    const settings = createSettings()
    settings.providers = {
      [ModelProviderEnum.OpenRouter]: {
        apiKey: 'openrouter-key',
        models: [{ modelId: 'google/gemini-3-pro-image', type: 'image', nickname: 'Gemini Image' }],
      },
    }
    fetchOpenRouterImageModelsMock.mockResolvedValue([
      {
        modelId: 'openai/gpt-image-1',
        nickname: 'GPT Image 1',
        capabilities: {
          aspectRatio: { values: ['1:1'] },
          inputReferences: { min: 0, max: 4 },
        },
      },
    ])

    await expect(getAvailableImageModels(settings)).resolves.toEqual([
      {
        provider: ModelProviderEnum.OpenRouter,
        modelId: 'openai/gpt-image-1',
        nickname: 'GPT Image 1',
        capabilities: {
          aspectRatio: { values: ['1:1'] },
          inputReferences: { min: 0, max: 4 },
        },
      },
      { provider: ModelProviderEnum.OpenRouter, modelId: 'google/gemini-3-pro-image', nickname: 'Gemini Image' },
    ])
    expect(fetchOpenRouterImageModelsMock).toHaveBeenCalledWith('openrouter-key', { request: {} })
    expect(getModelManifestMock).not.toHaveBeenCalled()
  })

  it('falls back to manually configured models when OpenRouter image model discovery fails', async () => {
    const settings = createSettings()
    settings.providers = {
      [ModelProviderEnum.OpenRouter]: {
        apiKey: 'openrouter-key',
        models: [{ modelId: 'manual-image', type: 'image', nickname: 'Manual Image' }],
      },
    }
    fetchOpenRouterImageModelsMock.mockRejectedValue(new Error('offline'))

    await expect(getAvailableImageModels(settings)).resolves.toEqual([
      { provider: ModelProviderEnum.OpenRouter, modelId: 'manual-image', nickname: 'Manual Image' },
    ])
    expect(getModelManifestMock).not.toHaveBeenCalled()
  })

  it('includes manually marked image models from custom OpenAI-compatible providers', async () => {
    const settings = createSettings()
    settings.providers = {
      'custom-openai': {
        apiKey: 'custom-key',
        models: [
          { modelId: 'local-chat', type: 'chat' },
          { modelId: 'flux-local', type: 'image', nickname: 'Flux Local' },
        ],
      },
      'custom-responses': {
        models: [{ modelId: 'gpt-image-1', type: 'image', nickname: 'Responses Image' }],
      },
    }
    settings.customProviders = [
      {
        id: 'custom-openai',
        name: 'Local OpenAI',
        type: ModelProviderType.OpenAI,
        isCustom: true,
      },
      {
        id: 'custom-responses',
        name: 'Custom Responses',
        type: ModelProviderType.OpenAIResponses,
        isCustom: true,
      },
    ]

    await expect(getAvailableImageModels(settings)).resolves.toEqual([
      { provider: 'custom-openai', modelId: 'flux-local', nickname: 'Flux Local' },
      { provider: 'custom-responses', modelId: 'gpt-image-1', nickname: 'Responses Image' },
    ])
    expect(getModelManifestMock).not.toHaveBeenCalled()
  })

  it('keeps OpenAI image models when OAuth credentials are stored but API key mode is active', async () => {
    const settings = createSettings()
    settings.providers = {
      [ModelProviderEnum.OpenAI]: {
        apiKey: 'openai-key',
        activeAuthMode: 'apikey',
        oauth: { accessToken: 'oauth-token' },
      },
    }
    expect(await getAvailableImageModels(settings)).toContainEqual({
      provider: ModelProviderEnum.OpenAI,
      modelId: 'gpt-image-1.5',
      nickname: 'GPT Image 1.5',
    })
  })
})

describe('targeted image capabilities', () => {
  it('rotates the cache identity on logout and relogin between catalog consumers', () => {
    const providers = { openrouter: { apiKey: 'relogin-key' } }
    settingsStore.setState({ providers })
    const options = { apiKey: providers.openrouter.apiKey, language: 'en' }
    const first = providerImageModelsQueryOptions(ModelProviderEnum.OpenRouter, options).queryKey
    settingsStore.setState({ providers: {} })
    settingsStore.setState({ providers })
    const second = providerImageModelsQueryOptions(ModelProviderEnum.OpenRouter, options).queryKey
    expect(second).not.toEqual(first)
    expect(JSON.stringify([first, second])).not.toContain('relogin-key')
  })

  it('reuses a UI catalog query and never loads unrelated configured providers', async () => {
    queryClient.clear()
    vi.clearAllMocks()
    const settings = createSettings()
    settings.licenseKey = 'license'
    settings.providers = {
      openrouter: { apiKey: 'targeted-key' },
      openai: { apiKey: 'other-key' },
      gemini: { apiKey: 'other-key' },
    }
    const capabilities = { aspectRatio: { values: ['1:1'] }, inputReferences: null }
    fetchOpenRouterImageModelsMock.mockResolvedValue([{ modelId: 'target', nickname: 'Target', capabilities }])
    await queryClient.fetchQuery(
      providerImageModelsQueryOptions(ModelProviderEnum.OpenRouter, {
        apiKey: 'targeted-key',
        language: settings.language,
      })
    )
    await expect(getImageModelCapabilities({ provider: 'openrouter', modelId: 'target' }, settings)).resolves.toEqual(
      capabilities
    )
    expect(fetchOpenRouterImageModelsMock).toHaveBeenCalledTimes(1)
    expect(getModelManifestMock).not.toHaveBeenCalled()
  })

  it('cancels a generation lookup while preserving the shared catalog request', async () => {
    queryClient.clear()
    vi.clearAllMocks()
    const settings = createSettings()
    settings.providers = { openrouter: { apiKey: 'pending-key' } }
    const capabilities = { aspectRatio: null, inputReferences: { min: 1 } }
    let finish: ((models: unknown[]) => void) | undefined
    fetchOpenRouterImageModelsMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const controller = new AbortController()
    const cancelled = getImageModelCapabilities(
      { provider: 'openrouter', modelId: 'target' },
      settings,
      controller.signal
    )
    const otherConsumer = getImageModelCapabilities({ provider: 'openrouter', modelId: 'target' }, settings)
    await vi.waitFor(() => expect(fetchOpenRouterImageModelsMock).toHaveBeenCalledOnce())
    const rejection = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejection
    finish?.([{ modelId: 'target', nickname: 'Target', capabilities }])
    await expect(otherConsumer).resolves.toEqual(capabilities)
    expect(fetchOpenRouterImageModelsMock).toHaveBeenCalledTimes(1)
    expect(getModelManifestMock).not.toHaveBeenCalled()
  })
})
