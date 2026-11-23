// @vitest-environment jsdom
import { MantineProvider } from '@mantine/core'
import type { ImageGeneration } from '@shared/types'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@/test-utils'
import zhHans from '../../../../../packages/chatbox-i18n/src/locales/zh-Hans/translation.json'
import { ImageGenerationErrorTips } from './ImageGenerationErrorTips'

const mocks = vi.hoisted(() => ({ plan: 'pro', open: vi.fn(), localized: false }))
vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: (selector: (state: unknown) => unknown) => selector({ licenseDetail: { plan: mocks.plan } }),
}))
vi.mock('@/platform', () => ({ default: { openLink: mocks.open } }))
vi.mock('@/packages/remote', () => ({ buildChatboxUrl: (path: string) => `https://chatboxai.app${path}` }))
vi.mock('@/stores/settingActions', () => ({ getLanguage: () => 'zh-Hans' }))
vi.mock('@/modals/settings-navigation', () => ({ navigateToSettings: vi.fn() }))
vi.mock('@/packages/event', () => ({ trackingEvent: vi.fn() }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (mocks.localized ? (zhHans[key as keyof typeof zhHans] ?? key) : key),
    i18n: { language: 'zh-Hans' },
  }),
  Trans: ({ i18nKey }: { i18nKey: string }) => i18nKey,
}))
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })),
})
vi.mock('@/hooks/useCopied', () => ({ useCopied: () => ({ copied: false, copy: vi.fn() }) }))
vi.mock('@/components/ui/tooltip', () => ({ AppTooltip: ({ children }: { children: ReactNode }) => children }))
const record: ImageGeneration = {
  id: 'image',
  createdAt: 1,
  model: { provider: 'chatbox-ai', modelId: 'image' },
  prompt: 'cat',
  referenceImages: [],
  generatedImages: [],
  status: 'error',
  errorCode: 20049,
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.localized = false
})
describe('image generation error actions', () => {
  it('handles the polling error code and disables a retry already in progress', () => {
    mocks.plan = 'pro_plus'
    const retry = vi.fn()
    render(
      <MantineProvider>
        <ImageGenerationErrorTips record={{ ...record, errorCode: 'ai_provider_error' }} onRetry={retry} isRetrying />
      </MantineProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(retry).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('Generation Failed')
  })
})
