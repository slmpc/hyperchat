// @vitest-environment jsdom

import NiceModal from '@ebay/nice-modal-react'
import { MantineProvider } from '@mantine/core'
import { type ButtonHTMLAttributes, cloneElement, type ReactElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@/test-utils'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn(
    (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })
  ),
})

Object.defineProperty(globalThis, 'ResizeObserver', {
  writable: true,
  value: class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
})

const { mockNavigateToSettings, mockOpenLink, mockPlatform, mockSettingsState } = vi.hoisted(() => ({
  mockNavigateToSettings: vi.fn(),
  mockOpenLink: vi.fn(),
  mockPlatform: { type: 'desktop', isDesktopLike: true },
  mockSettingsState: { licenseDetail: undefined as { plan: string } | undefined },
}))

vi.mock('react-i18next', () => ({
  Trans: ({ i18nKey, components }: { i18nKey: string; components?: Record<string, ReactElement> }) => {
    const openSettingLabel = i18nKey.match(/<OpenSettingButton>(.*?)<\/OpenSettingButton>/)?.[1]
    const documentParserLabel = i18nKey.match(
      /<OpenDocumentParserSettingButton>(.*?)<\/OpenDocumentParserSettingButton>/
    )?.[1]
    const deepSeekProviderLabel = i18nKey.match(
      /<OpenDeepSeekProviderSettingButton>(.*?)<\/OpenDeepSeekProviderSettingButton>/
    )?.[1]
    return (
      <span>
        {i18nKey}
        {components?.OpenDeepSeekProviderSettingButton && deepSeekProviderLabel
          ? cloneElement(components.OpenDeepSeekProviderSettingButton, {}, deepSeekProviderLabel)
          : null}
        {components?.OpenSettingButton && openSettingLabel
          ? cloneElement(components.OpenSettingButton, {}, openSettingLabel)
          : null}
        {components?.OpenDocumentParserSettingButton && documentParserLabel
          ? cloneElement(components.OpenDocumentParserSettingButton, {}, documentParserLabel)
          : null}
      </span>
    )
  },
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/hooks/useScreenChange', () => ({
  useIsSmallScreen: () => false,
}))

vi.mock('@/components/common/AdaptiveModal', () => {
  const AdaptiveModal = ({ children, title }: { children: ReactNode; title?: ReactNode }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  )
  AdaptiveModal.Actions = ({ children }: { children: ReactNode }) => <div>{children}</div>
  AdaptiveModal.CloseButton = (props: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {props.children ?? 'Cancel'}
    </button>
  )
  return { AdaptiveModal }
})

vi.mock('@/modals/settings-navigation', () => ({
  navigateToSettings: mockNavigateToSettings,
}))

vi.mock('@/packages/event', () => ({
  trackingEvent: vi.fn(),
}))

vi.mock('@/packages/remote', () => ({
  buildChatboxUrl: (path: string) => path,
}))

vi.mock('@/platform', () => ({
  default: Object.assign(mockPlatform, {
    openLink: mockOpenLink,
  }),
}))

vi.mock('@/stores/settingActions', () => ({
  getLanguage: () => 'en',
}))

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: <T,>(selector: (state: typeof mockSettingsState) => T) => selector(mockSettingsState),
}))

import FileParseError from './FileParseError'

const modalId = 'file-parse-error-test'
NiceModal.register(modalId, FileParseError)

function showFileParseError(errorCode: string, fileName?: string) {
  render(
    <MantineProvider>
      <NiceModal.Provider />
    </MantineProvider>
  )
  act(() => {
    void NiceModal.show(modalId, { errorCode, fileName })
  })
}

describe('FileParseError', () => {
  beforeEach(() => {
    mockNavigateToSettings.mockReset()
    mockOpenLink.mockReset()
    mockPlatform.type = 'desktop'
    mockPlatform.isDesktopLike = true
    mockSettingsState.licenseDetail = undefined
  })

  test('sends a missing DeepSeek parser key to the DeepSeek model provider settings', async () => {
    showFileParseError('deepseek_parser_api_key_required', 'scan.pdf')

    expect(await screen.findByText('File: scan.pdf')).toBeTruthy()
    fireEvent.click(screen.getByText('add it in the DeepSeek model provider settings'))

    expect(mockNavigateToSettings).toHaveBeenCalledWith('/provider/deepseek')
  })
})
