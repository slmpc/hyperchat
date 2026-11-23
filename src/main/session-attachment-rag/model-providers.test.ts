import { beforeEach, describe, expect, test, vi } from 'vitest'

const createEmbeddingProviderFromModelStringMock = vi.fn()
const getSettingsMock = vi.fn()
const storeGetMock = vi.fn()

vi.mock('../knowledge-base/model-providers', () => ({
  createEmbeddingProviderFromModelString: createEmbeddingProviderFromModelStringMock,
}))

vi.mock('../store-node', () => ({
  getSettings: getSettingsMock,
  store: {
    get: storeGetMock,
  },
}))

vi.mock('../util', () => ({ getLogger: () => ({ debug: vi.fn(), error: vi.fn() }) }))

vi.mock('../adapters/sentry', () => ({
  sentry: {
    withScope: vi.fn(),
    captureException: vi.fn(),
  },
}))

describe('session attachment RAG model providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createEmbeddingProviderFromModelStringMock.mockResolvedValue({ provider: 'embedding-provider' })
    getSettingsMock.mockReturnValue({
      defaultEmbeddingModel: {
        provider: 'openai',
        model: 'text-embedding-3-large',
      },
    })
    storeGetMock.mockImplementation((key: string) => (key === 'settings.licenseKey' ? 'license-key' : undefined))
  })

  test('uses the configured third-party embedding model', async () => {
    const { getSessionAttachmentEmbeddingProviderWithResolution } = await import('./model-providers')

    const resolution = await getSessionAttachmentEmbeddingProviderWithResolution()

    expect(createEmbeddingProviderFromModelStringMock).toHaveBeenCalledWith('openai:text-embedding-3-large')
    expect(resolution).toMatchObject({
      modelString: 'openai:text-embedding-3-large',
      source: 'default-embedding-model',
    })
  })
})

test('does not select a hosted embedding model for an old license', async () => {
  const { getSessionAttachmentEmbeddingModelString } = await import('./model-providers')
  getSettingsMock.mockReturnValue({})
  storeGetMock.mockReturnValue('old-license')
  expect(getSessionAttachmentEmbeddingModelString()).toBeUndefined()
})
