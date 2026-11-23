// @vitest-environment jsdom

import type { SessionHeader } from '@chatbox/core/ports'
import { MantineProvider } from '@mantine/core'
import type { Message } from '@shared/types'
import { ModelProviderType } from '@shared/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { afterEach, expect, test, vi } from 'vitest'
import { settingsStore } from '@/stores/settingsStore'
import { fireEvent, render as renderWithProviders, screen, waitFor } from '@/test-utils'
import MessageErrTips from './MessageErrTips'

let queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
function render(ui: ReactElement) {
  return renderWithProviders(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}
const remoteMocks = vi.hoisted(() => ({ getLicenseDetailRealtime: vi.fn() }))
vi.mock('@/packages/remote', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/packages/remote')>()),
  ...remoteMocks,
}))

const translationMocks = vi.hoisted(() => ({ translateTexts: vi.fn<() => Promise<string[]>>() }))
vi.mock('@/packages/translation', () => translationMocks)

const platformMocks = vi.hoisted(() => ({
  openLink: vi.fn(),
}))
const trackingMocks = vi.hoisted(() => ({
  trackTokenExhaustedCard: vi.fn(),
  useSessionHeader: vi.fn<
    (sessionId: string | null) => { session?: Pick<SessionHeader, 'settings'>; isFetched: boolean }
  >(() => ({
    session: undefined,
    isFetched: false,
  })),
}))

vi.mock('@/platform', () => ({
  default: {
    type: 'desktop',
    isDesktopLike: true,
    openLink: platformMocks.openLink,
  },
}))

vi.mock('@/analytics/token-exhausted-card', () => ({
  trackTokenExhaustedCard: trackingMocks.trackTokenExhaustedCard,
}))

vi.mock('@/app/renderer-application', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/renderer-application')>()
  return {
    rendererApplication: {
      ...actual.rendererApplication,
      sessionHooks: {
        ...actual.rendererApplication.sessionHooks,
        useSessionHeader: trackingMocks.useSessionHeader,
      },
    },
  }
})

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

const initialSettings = settingsStore.getState()

afterEach(() => {
  queryClient.clear()
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  remoteMocks.getLicenseDetailRealtime.mockReset()
  translationMocks.translateTexts.mockReset()
  platformMocks.openLink.mockReset()
  trackingMocks.trackTokenExhaustedCard.mockReset()
  trackingMocks.useSessionHeader.mockReset()
  trackingMocks.useSessionHeader.mockReturnValue({ session: undefined, isFetched: false })
  settingsStore.setState(initialSettings)
})

test('keeps raw details copyable while collapsed and supports expanding them without retrying', () => {
  settingsStore.setState((state) => ({ ...state, language: 'en', licenseKey: 'test-license' }))
  const onRetry = vi.fn()
  const execCommand = vi.fn(() => true)
  Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand })
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const raw = `Invalid API key. ${'The provider returned diagnostic details. '.repeat(10)}`
  const msg = {
    id: 'detail-error',
    role: 'assistant',
    contentParts: [],
    error: 'API Error',
    errorCode: 10001,
    errorExtra: { httpStatusCode: 401, responseBody: raw, requestId: 'request-123' },
  } as Message
  render(
    <MantineProvider>
      <MessageErrTips msg={msg} onRetry={onRetry} />
    </MantineProvider>
  )
  expect(screen.queryByText(raw)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /^Copy$/ }))
  expect(writeText).toHaveBeenCalledWith(raw)
  fireEvent.click(screen.getByRole('button', { name: 'Show more' }))
  expect(screen.getByRole('alert').textContent).toContain(raw)
  expect(screen.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
  expect(screen.queryByText(raw)).toBeNull()
  expect(onRetry).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  Reflect.deleteProperty(navigator, 'clipboard')
  Reflect.deleteProperty(document, 'execCommand')
})

test('disables retry until the pending retry completes', async () => {
  let finishRetry: (() => void) | undefined
  const onRetry = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finishRetry = resolve
      })
  )
  const msg = { id: 'retry-error', role: 'assistant', contentParts: [], error: 'Expired', errorCode: 20002 } as Message
  render(
    <MantineProvider>
      <MessageErrTips msg={msg} onRetry={onRetry} />
    </MantineProvider>
  )
  const retry = screen.getByRole('button', { name: 'Retry' }) as HTMLButtonElement
  fireEvent.click(retry)
  expect(retry.disabled).toBe(true)
  fireEvent.click(retry)
  expect(onRetry).toHaveBeenCalledOnce()
  finishRetry?.()
  await waitFor(() => expect(retry.disabled).toBe(false))
})

test('shows translation progress and lets the user return to the original error', async () => {
  settingsStore.setState((state) => ({ ...state, language: 'zh-Hans', licenseKey: 'test-license' }))
  let finishTranslation: ((texts: string[]) => void) | undefined
  translationMocks.translateTexts.mockImplementation(
    () =>
      new Promise((resolve) => {
        finishTranslation = resolve
      })
  )
  const msg = {
    id: 'translate-error',
    role: 'assistant',
    contentParts: [],
    error: 'API Error',
    errorCode: 10001,
    errorExtra: { httpStatusCode: 401, responseBody: 'Provider authentication failed.' },
  } as Message
  render(
    <MantineProvider>
      <MessageErrTips msg={msg} />
    </MantineProvider>
  )
  const translate = screen.getByRole('button', { name: 'Translate' }) as HTMLButtonElement
  fireEvent.click(translate)
  await waitFor(() =>
    expect((screen.getByRole('button', { name: 'Translate' }) as HTMLButtonElement).disabled).toBe(true)
  )
  finishTranslation?.(['服务商身份验证失败。'])
  await waitFor(() => expect(screen.getByText('服务商身份验证失败。')).not.toBeNull())
  fireEvent.click(screen.getByRole('button', { name: 'Show original' }))
  expect(screen.getByText('Provider authentication failed.')).not.toBeNull()
})

const customApiError = {
  id: 'custom-api-error',
  role: 'assistant',
  contentParts: [],
  error: 'API Error',
  errorCode: 10001,
  aiProvider: 'custom-provider',
  errorExtra: { httpStatusCode: 401 },
} as Message

test('shows custom provider name, network advice after a network failure', () => {
  settingsStore.setState({
    licenseKey: undefined,
    language: 'en',
    customProviders: [{ id: 'custom-provider', name: 'My API', type: ModelProviderType.OpenAI, isCustom: true }],
  })
  render(
    <MantineProvider>
      <MessageErrTips
        msg={{
          ...customApiError,
          error: 'Network Error: connection refused',
          errorCode: 10002,
          errorExtra: { host: 'api.example.test' },
        }}
      />
    </MantineProvider>
  )
  const guidance = screen.getByRole('alert').textContent || ''
  expect(guidance).toContain('connection with api.example.test')
  expect(guidance).toContain('your configured My API')
  expect(guidance).not.toContain('Sign in to Chatbox AI')
})
