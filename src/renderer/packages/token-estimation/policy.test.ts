import { expect, it, vi } from 'vitest'
import { resolveTokenSandboxMode } from './policy'

const state = vi.hoisted(() => ({ available: true, cloud: false }))
vi.mock('@shared/providers', () => ({ getModel: vi.fn() }))
vi.mock('@/adapters', () => ({ createModelDependencies: vi.fn() }))
vi.mock('@/packages/model-registry', () => ({ getRegistry: vi.fn() }))
vi.mock('@/platform', () => ({ default: { getConfig: vi.fn() } }))
vi.mock('@/settings-runtime', () => ({ settingsService: { getSettings: vi.fn() } }))
vi.mock('@/sandbox', () => ({
  createSandboxProvider: () => ({
    type: state.cloud ? 'cloud' : 'local',
    setExtraWritableDirs: vi.fn(),
    checkAvailability: async () => ({ available: state.available }),
  }),
}))
it('checks work mode, model support and local sandbox availability', async () => {
  expect(await resolveTokenSandboxMode(false, true, {})).toBe(false)
  expect(await resolveTokenSandboxMode(true, false, {})).toBe(false)
  expect(await resolveTokenSandboxMode(true, true, {})).toBe(true)
  state.available = false
  expect(await resolveTokenSandboxMode(true, true, {})).toBe(false)
  state.available = true
  state.cloud = true
  expect(await resolveTokenSandboxMode(true, true, {})).toBe(false)
})
