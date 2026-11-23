import { v4 as uuidv4 } from 'uuid'
import platform from '@/platform'
import { getParseLinkProvider } from './web-search'

export async function parseTextFile(file: File, options: { maxLength?: number } = {}) {
  let text = await file.text()
  if (options.maxLength) {
    text = text.trim().slice(0, options.maxLength)
  }
  const key = `parseFile-` + uuidv4()
  await platform.setStoreBlob(key, text)
  return { key }
}

export async function parseUrl(url: string) {
  const provider = getParseLinkProvider()
  const result = await provider?.parseLink(url)
  if (!result) throw new Error('parse_link_not_supported')
  const key = 'parseUrl-' + uuidv4()
  await platform.setStoreBlob(key, result.content)
  return { key, title: result.title }
}
