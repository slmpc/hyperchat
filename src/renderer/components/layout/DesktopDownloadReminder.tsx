import { Button, Flex, Paper, Stack, Text } from '@mantine/core'
import { PROJECT_RELEASES_URL } from '@shared/project-links'
import { IconDeviceDesktop, IconDeviceMobile, IconDownload, IconX } from '@tabler/icons-react'
import { useLocation } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ICON_SIZE, ICON_STROKE_WIDTH, IconButton } from '@/components/common/IconButton'
import { ScalableIcon } from '@/components/common/ScalableIcon'
import platform from '@/platform'
import { useSettingsStore } from '@/stores/settingsStore'

/** Web only: whether the app download prompt is still shown on the current page. */
export function useWebAppDownloadPromptVisible() {
  const location = useLocation()
  const dismissed = useSettingsStore((state) => state.chatboxAIDesktopPromptDismissed)
  if (platform.type !== 'web' || dismissed) {
    return false
  }
  return !(location.pathname.startsWith('/settings') || Boolean((location.search as Record<string, unknown>)?.settings))
}

function useDismissWebAppDownloadPrompt() {
  const setSettings = useSettingsStore((state) => state.setSettings)
  return () => setSettings({ chatboxAIDesktopPromptDismissed: true })
}

/** Desktop-width web: card at the bottom of the sidebar. */
export function SidebarDesktopDownloadCard() {
  const { t } = useTranslation()
  const dismiss = useDismissWebAppDownloadPrompt()

  return (
    <Paper withBorder p="sm" className="bg-chatbox-background-primary">
      <Stack gap={6}>
        <Flex justify="space-between" gap="xs" align="flex-start">
          <Flex gap={6} align="flex-start" flex={1} miw={0}>
            <ScalableIcon
              icon={IconDeviceDesktop}
              size={ICON_SIZE.inline}
              strokeWidth={ICON_STROKE_WIDTH}
              className="text-chatbox-brand shrink-0 mt-[2px]"
            />
            <Text size="sm" fw={600} lh={1.3}>
              {t('More advanced features are available in HyperChat Desktop.')}
            </Text>
          </Flex>
          <IconButton
            icon={IconX}
            iconSize={14}
            size="sm"
            mt={-6}
            mr={-6}
            color="chatbox-tertiary"
            aria-label={t('Close')}
            onClick={dismiss}
          />
        </Flex>
        <Text size="xs" c="chatbox-secondary">
          {t(
            'Your chat history on web version can only be stored in the browser cache (unreliable - it may be cleaned by browser).'
          )}
        </Text>
        <Button
          size="compact-sm"
          fullWidth
          leftSection={<ScalableIcon icon={IconDownload} size={14} />}
          onClick={() => platform.openLink(PROJECT_RELEASES_URL)}
        >
          {t('Download Desktop App')}
        </Button>
      </Stack>
    </Paper>
  )
}

/** Small-screen web: a dismissible strip under the page header that never covers the composer. */
export function MobileWebDownloadBanner() {
  const { t } = useTranslation()
  const visible = useWebAppDownloadPromptVisible()
  const dismiss = useDismissWebAppDownloadPrompt()

  if (!visible) {
    return null
  }

  return (
    <Flex
      h={40}
      align="center"
      gap="xs"
      pl="md"
      pr={4}
      className="flex-none border-0 border-b border-solid border-chatbox-border-primary bg-chatbox-background-brand-secondary"
    >
      <ScalableIcon
        icon={IconDeviceMobile}
        size={ICON_SIZE.inline}
        strokeWidth={ICON_STROKE_WIDTH}
        className="text-chatbox-brand shrink-0"
      />
      <Text size="xs" c="chatbox-secondary" flex={1} truncate="end">
        {t('Recommended to use HyperChat App')}
      </Text>
      <Button size="compact-xs" variant="subtle" onClick={() => platform.openLink(PROJECT_RELEASES_URL)}>
        {t('Download')}
      </Button>
      <IconButton
        icon={IconX}
        iconSize={14}
        size="md"
        color="chatbox-tertiary"
        aria-label={t('Close')}
        onClick={dismiss}
      />
    </Flex>
  )
}
