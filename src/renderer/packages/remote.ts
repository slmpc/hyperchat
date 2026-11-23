import { ofetch } from 'ofetch'
import { z } from 'zod'
import platform from '@/platform'
import { CHATBOX_BUILD_CHANNEL, USE_BETA_CHATBOX, USE_LOCAL_CHATBOX } from '@/variables'
import * as chatboxaiAPI from '../../shared/request/chatboxai_pool'
import { createAfetch } from '../../shared/request/request'
import { reportNativeContent } from '../../shared/services/native-report'
import { type Config, type CopilotDetail, type Settings } from '../../shared/types'
import { getOS } from './navigator'

let _afetch: ReturnType<typeof createAfetch> | null = null
let afetchPromise: Promise<ReturnType<typeof createAfetch>> | null = null

async function initAfetch(): Promise<ReturnType<typeof createAfetch>> {
  if (afetchPromise) return afetchPromise

  afetchPromise = (async () => {
    _afetch = createAfetch({
      type: platform.type,
      platform: await platform.getPlatform(),
      os: getOS(),
      version: await platform.getVersion(),
    })
    return _afetch
  })()

  return afetchPromise
}

async function getAfetch() {
  if (!_afetch) {
    return await initAfetch()
  }
  return _afetch
}

// ========== API ORIGIN 根据可用性维护 ==========

// const RELEASE_ORIGIN = 'https://releases.chatboxai.app'
export function getAPIOrigin() {
  return chatboxaiAPI.getChatboxAPIOrigin()
}

export function getChatboxOrigin() {
  if (USE_LOCAL_CHATBOX) {
    return 'http://localhost:3002'
  } else if (USE_BETA_CHATBOX) {
    return 'https://beta.chatboxai.app'
  } else {
    return 'https://chatboxai.app'
  }
}

export function buildChatboxUrl(path: string) {
  return new URL(path, getChatboxOrigin()).toString()
}

const getChatboxHeaders = async () => {
  return {
    'CHATBOX-PLATFORM': await platform.getPlatform(),
    'CHATBOX-PLATFORM-TYPE': platform.type,
    'CHATBOX-CHANNEL': CHATBOX_BUILD_CHANNEL,
    'CHATBOX-VERSION': await platform.getVersion(),
    'CHATBOX-OS': getOS(),
  }
}

// ========== 各个接口方法 ==========

export async function checkNeedUpdate(version: string, os: string, config: Config, settings: Settings) {
  type Response = {
    need_update?: boolean
  }
  // const res = await ofetch<Response>(`${RELEASE_ORIGIN}/chatbox_need_update/${version}`, {
  const res = await ofetch<Response>(`${getAPIOrigin()}/chatbox_need_update/${version}`, {
    method: 'POST',
    retry: 3,
    body: {
      uuid: config.uuid,
      os: os,
      allowReportingAndTracking: settings.allowReportingAndTracking ? 1 : 0,
    },
  })
  return !!res.need_update
}

// export async function getSponsorAd(): Promise<null | SponsorAd> {
//     type Response = {
//         data: null | SponsorAd
//     }
//     // const res = await ofetch<Response>(`${RELEASE_ORIGIN}/sponsor_ad`, {
//     const res = await ofetch<Response>(`${API_ORIGIN}/sponsor_ad`, {
//         retry: 3,
//     })
//     return res['data'] || null
// }

// export async function listSponsorAboutBanner() {
//     type Response = {
//         data: SponsorAboutBanner[]
//     }
//     // const res = await ofetch<Response>(`${RELEASE_ORIGIN}/sponsor_about_banner`, {
//     const res = await ofetch<Response>(`${API_ORIGIN}/sponsor_ad`, {
//         retry: 3,
//     })
//     return res['data'] || []
// }

export async function listCopilotTags(lang: string) {
  type Response = {
    data: string[]
  }
  const res = await ofetch<Response>(`${getAPIOrigin()}/api/system_copilots/tags/${lang}`, {
    method: 'GET',
    retry: 3,
  })
  return res.data
}

export async function listCopilotsByCursor(
  lang: string,
  filters?: {
    limit?: number
    cursor?: string
    tag?: string
    search?: string
  }
) {
  type Response = {
    data: CopilotDetail[]
    next_cursor: string | null
  }
  const res = await ofetch<Response>(`${getAPIOrigin()}/api/system_copilots/list`, {
    method: 'POST',
    retry: 3,
    body: { lang, ...filters },
  })
  return res
}

export async function recordCopilotUsage(params: {
  id: string
  action: 'create_session' | 'create_thread' | 'create_message' | 'use_copilot'
}) {
  await ofetch(`${getAPIOrigin()}/api/system_copilots/record_usage`, {
    method: 'POST',
    body: {
      ...params,
      device_id: (await platform.getConfig()).uuid,
    },
  })
}

export async function recordCopilotShare(detail: CopilotDetail) {
  await ofetch(`${getAPIOrigin()}/api/copilots/share-record`, {
    method: 'POST',
    body: {
      detail: detail,
    },
  })
}

export interface DialogConfig {
  markdown: string
  buttons: { label: string; url: string }[]
}

const ClientNotificationSchema = z.object({
  cover_image_url: z.string().optional(),
  batch_id: z.string().uuid(),
  title: z.string().min(1).max(200),
  subtitle: z.string().max(400).optional(),
  body_markdown: z
    .string()
    .min(1)
    .max(32 * 1024),
  content_language: z.enum(['zh', 'en']),
})

const ClientNotificationResponseSchema = z.object({
  data: ClientNotificationSchema.nullable(),
})

export type ClientNotification = z.infer<typeof ClientNotificationSchema>

export async function getNextClientNotification(params: { locale: string; displayed_batch_ids: string[] }) {
  const response = await ofetch<unknown>(`${getAPIOrigin()}/api/client_notifications/next`, {
    method: 'POST',
    retry: 0,
    body: params,
    headers: await getChatboxHeaders(),
  })
  return ClientNotificationResponseSchema.parse(response).data
}

export async function getDialogConfig(params: { uuid: string; language: string; version: string }) {
  type Response = {
    data: null | DialogConfig
  }
  const res = await ofetch<Response>(`${getAPIOrigin()}/api/dialog_config`, {
    method: 'POST',
    retry: 3,
    body: params,
    headers: await getChatboxHeaders(),
  })
  return res['data'] || null
}

export async function reportContent(params: { id: string; type: string; details: string }) {
  const afetch = await getAfetch()
  await reportNativeContent({
    ...params,
    apiOrigin: getAPIOrigin(),
    fetchFn: (input, init) => afetch(input, init),
    headers: await getChatboxHeaders(),
  })
}
