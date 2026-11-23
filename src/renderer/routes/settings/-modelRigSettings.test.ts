import type { Settings } from '@shared/types'
import { ModelProviderEnum } from '@shared/types'
import { describe, expect, test } from 'vitest'
import {
  applyAllPresetsExtension,
  applyAllPresetsSettings,
  customParserTypes,
  effectiveParserType,
  getSlotModelRef,
  isSlotPresetOn,
  PARSER_CUSTOM_FALLBACK,
  SEARCH_CUSTOM_FALLBACK,
  settingsPatchForModelSlot,
} from './-modelRigSettings'
import { runSlotTest } from './-modelRigTest'

function settings(overrides: Partial<Settings> = {}): Settings {
  return {
    extension: {
      webSearch: {
        provider: 'bing',
      },
    },
    ...overrides,
  } as Settings
}

describe('model rig slot settings', () => {
  test('treats an unset chat model as the default preset', () => {
    expect(isSlotPresetOn('llm', settings())).toBe(true)
  })

  test('treats a third-party chat model as a custom part', () => {
    expect(isSlotPresetOn('llm', settings({ defaultChatModel: { provider: 'openai', model: 'gpt-4.1' } }))).toBe(false)
  })

  test('fast model preset follows the title model', () => {
    expect(isSlotPresetOn('fast', settings())).toBe(true)
    expect(
      isSlotPresetOn(
        'fast',
        settings({
          threadNamingModel: { provider: 'openai', model: 'gpt-4.1-mini' },
          searchTermConstructionModel: { provider: 'openai', model: 'gpt-4.1-mini' },
        })
      )
    ).toBe(false)
  })

  test('writes the fast model into the title model setting', () => {
    expect(settingsPatchForModelSlot('fast', { provider: 'openai', model: 'gpt-4.1-mini' })).toEqual({
      threadNamingModel: { provider: 'openai', model: 'gpt-4.1-mini' },
    })
  })

  test('reads the fast model from the title model setting', () => {
    expect(
      getSlotModelRef(
        'fast',
        settings({
          threadNamingModel: { provider: 'openai', model: 'naming' },
          searchTermConstructionModel: { provider: 'deepseek', model: 'search' },
        })
      )
    ).toEqual({ provider: 'openai', model: 'naming' })
  })

  test('ignores a saved search model when the fast model is automatic', () => {
    const saved = settings({ searchTermConstructionModel: { provider: 'openai', model: 'search' } })
    expect(isSlotPresetOn('fast', saved)).toBe(true)
    expect(getSlotModelRef('fast', saved)).toBeUndefined()
  })

  test('defaults to local parsing and Bing search', () => {
    expect(isSlotPresetOn('parser', settings())).toBe(true)
    expect(isSlotPresetOn('search', settings())).toBe(true)
    expect(isSlotPresetOn('search', settings({ extension: { webSearch: { provider: 'tavily' } } }))).toBe(false)
  })

  test('unset parser type follows the platform default', () => {
    expect(effectiveParserType(settings(), 'chatbox-ai')).toBe('chatbox-ai')
    expect(effectiveParserType(settings(), 'local')).toBe('local')
    expect(customParserTypes({ isDesktopLike: false, isMobile: false })).toEqual(['local', 'deepseek'])
    expect(customParserTypes({ isDesktopLike: false, isMobile: true })).toEqual(['local', 'deepseek'])
    expect(customParserTypes({ isDesktopLike: true, isMobile: false })).toEqual(['local', 'mineru', 'deepseek'])
  })

  test('image preset follows a missing last-used picture model', () => {
    expect(isSlotPresetOn('image', settings())).toBe(true)
    expect(isSlotPresetOn('image', settings(), { provider: 'openai', modelId: 'gpt-image-1' })).toBe(false)
  })

  test('applying presets clears custom models and restores built-in parser and search', () => {
    const current = settings({
      defaultChatModel: { provider: 'openai', model: 'gpt-4.1' },
      extension: {
        webSearch: { provider: 'tavily', tavilyApiKey: 'secret' },
        documentParser: { type: 'mineru' },
      },
    })
    expect(applyAllPresetsSettings()).toEqual({
      defaultChatModel: undefined,
      threadNamingModel: undefined,
      searchTermConstructionModel: undefined,
      ocrModel: undefined,
      defaultEmbeddingModel: undefined,
      defaultRerankModel: undefined,
    })
    expect(applyAllPresetsExtension(current).webSearch.provider).toBe('bing')
    expect(applyAllPresetsExtension(current).documentParser?.type).toBe('local')
    expect(applyAllPresetsExtension(current).webSearch.tavilyApiKey).toBe('secret')
  })

  test('coming-soon slots stay off the preset', () => {
    expect(isSlotPresetOn('asr', settings())).toBe(false)
    expect(isSlotPresetOn('tts', settings())).toBe(false)
  })

  test('custom fallbacks for parser and search do not require extra keys', () => {
    expect(PARSER_CUSTOM_FALLBACK).toBe('local')
    expect(SEARCH_CUSTOM_FALLBACK).toBe('bing')
  })
})

describe('model rig slot tests', () => {
  test('future slots fail immediately with a coming-soon hint', async () => {
    const result = await runSlotTest('asr', {
      settings: settings(),
      configuredProviderIds: new Set(),
      isDesktopLike: true,
      pingChat: async () => undefined,
      testMineru: async () => true,
      searchWeb: async () => undefined,
    })
    expect(result.status).toBe('fail')
    expect(result.error).toMatch(/not available/i)
  })

  test('fast helper auto mode passes without a network ping', async () => {
    const result = await runSlotTest('fast', {
      settings: settings(),
      configuredProviderIds: new Set(),
      isDesktopLike: true,
      pingChat: () => Promise.reject(new Error('should not ping')),
      testMineru: async () => true,
      searchWeb: async () => undefined,
    })
    expect(result).toEqual({ status: 'ok', latencyMs: 0 })
  })

  test('automatic chat selection checks configuration without testing an unrelated model', async () => {
    const result = await runSlotTest('llm', {
      settings: settings(),
      configuredProviderIds: new Set(),
      isDesktopLike: true,
      pingChat: () => Promise.reject(new Error('should not ping')),
      testMineru: async () => true,
      searchWeb: async () => undefined,
    })
    expect(result).toEqual({ status: 'ok', latencyMs: 0 })
  })

  test('chat slot pings the selected model', async () => {
    const pinged: string[] = []
    const result = await runSlotTest('llm', {
      settings: settings({ defaultChatModel: { provider: 'openai', model: 'gpt-4.1' } }),
      configuredProviderIds: new Set(),
      isDesktopLike: true,
      pingChat: (provider, model) => {
        pinged.push(`${provider}/${model}`)
        return Promise.resolve()
      },
      testMineru: async () => true,
      searchWeb: async () => undefined,
    })
    expect(result.status).toBe('ok')
    expect(pinged).toEqual(['openai/gpt-4.1'])
  })

  test('Bing search works without a license', async () => {
    const result = await runSlotTest('search', {
      settings: settings(),
      configuredProviderIds: new Set(),
      isDesktopLike: true,
      pingChat: async () => undefined,
      testMineru: async () => true,
      searchWeb: async () => undefined,
    })
    expect(result.status).toBe('ok')
  })

  test('local document parser passes without a network call', async () => {
    const result = await runSlotTest('parser', {
      settings: settings({
        extension: { webSearch: { provider: 'bing' }, documentParser: { type: 'local' } },
      }),
      configuredProviderIds: new Set(),
      isDesktopLike: true,
      pingChat: () => Promise.reject(new Error('should not ping')),
      testMineru: async () => true,
      searchWeb: async () => undefined,
    })
    expect(result).toEqual({ status: 'ok', latencyMs: 0 })
  })
})

describe('DeepSeek document parser', () => {
  function parserDeps(apiKey: string) {
    return {
      settings: settings({
        extension: { webSearch: { provider: 'bing' }, documentParser: { type: 'deepseek' } },
        providers: { [ModelProviderEnum.DeepSeek]: { apiKey } },
      }),
      configuredProviderIds: new Set<string>(),
      isDesktopLike: true,
      pingChat: () => Promise.reject(new Error('should not ping')),
      testMineru: () => Promise.reject(new Error('should not test MinerU')),
      searchWeb: async () => undefined,
    }
  }

  test('requires the DeepSeek model provider key', async () => {
    const result = await runSlotTest('parser', parserDeps(' '))
    expect(result.status).toBe('fail')
    expect(result.error).toBe('DeepSeek API key is missing')
    expect(result.fix).toBe('Add a DeepSeek API key in DeepSeek model provider settings.')
  })

  test('passes with the DeepSeek key without a billed request', async () => {
    expect(await runSlotTest('parser', parserDeps('ds-key'))).toEqual({ status: 'ok', latencyMs: 0 })
  })
})

describe('model configuration availability', () => {
  test.each(['embedding', 'rerank', 'image'] as const)(
    '%s requires a configured provider despite saved models',
    async (slotId) => {
      const ref = { provider: 'openai', model: 'saved-model' }
      const deps = {
        settings: settings({
          providers: { openai: { apiKey: '', models: [{ modelId: 'saved-model' }] } },
          defaultEmbeddingModel: ref,
          defaultRerankModel: ref,
        }),
        picture: { provider: 'openai', modelId: 'saved-model' },
        configuredProviderIds: new Set<string>(),
        isDesktopLike: true,
        pingChat: async () => undefined,
        testMineru: async () => true,
        searchWeb: async () => undefined,
      }
      expect((await runSlotTest(slotId, deps)).status).toBe('fail')
      deps.configuredProviderIds.add('openai')
      expect((await runSlotTest(slotId, deps)).status).toBe('ok')
    }
  )
})

describe('helper model connections', () => {
  test.each([
    [undefined, { provider: 'openai', model: 'search' }, []],
    [{ provider: 'openai', model: 'titles' }, { provider: 'openai', model: 'search' }, ['titles']],
    [{ provider: 'openai', model: 'same' }, { provider: 'openai', model: 'same' }, ['same']],
  ])('tests only the selected fast model', async (threadNamingModel, searchTermConstructionModel, expected) => {
    const pinged: string[] = []
    await runSlotTest('fast', {
      settings: settings({ threadNamingModel, searchTermConstructionModel }),
      configuredProviderIds: new Set(['openai']),
      isDesktopLike: true,
      pingChat: async (_provider, model) => {
        pinged.push(model)
      },
      testMineru: async () => true,
      searchWeb: async () => undefined,
    })
    expect(pinged).toEqual(expected)
  })
})
