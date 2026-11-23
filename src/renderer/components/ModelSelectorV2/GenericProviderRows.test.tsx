import { ModelProviderEnum } from '@shared/types'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GenericProviderRows } from './GenericProviderRows'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}))
vi.mock('./ModelRow', () => ({
  ModelRow: ({ detail }: { detail: { name: string } }) => <button>{detail.name}</button>,
}))
vi.mock('./ProviderRowHeader', () => ({
  ProviderRowHeader: ({ provider }: { provider: { name: string } }) => <header>{provider.name}</header>,
}))

const provider = { id: ModelProviderEnum.OpenAI, name: 'OpenAI' }
const model = { modelId: 'cached-chat', nickname: 'Configured Chat' }
const noop = () => undefined

function renderRows(favoriteOnly: boolean) {
  return renderToStaticMarkup(
    <GenericProviderRows
      favoriteOnly={favoriteOnly}
      genericProviders={[{ ...provider, models: [model] }]}
      favoritedModels={[{ provider, model }]}
      collapsedProviders={{}}
      search=""
      isMobile={false}
      isFavorited={() => true}
      onToggleProvider={noop}
      onSelect={noop}
      onToggleFavorite={noop}
      onShowMobileDetail={noop}
      onDesktopDetailOpen={noop}
      onDesktopDetailClose={noop}
      onDisabledSelect={noop}
    />
  )
}

describe('configured provider rows', () => {
  it.each([false, true])('renders configured models, favoriteOnly=%s', (favoriteOnly) => {
    expect(renderRows(favoriteOnly)).toContain('Configured Chat')
  })
})
