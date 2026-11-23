import { Box, Button, Group, Paper, Stack, Text, ThemeIcon } from '@mantine/core'
import { ChatboxAIAPIError } from '@shared/models/errors'
import { IconAlertCircle, IconWorldOff } from '@tabler/icons-react'
import type { FC } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import { GLASS_FILL_CLASS } from '@/lib/glass-surface'

interface ToolUnavailableCardProps {
  toolLabel: string
  toolName: string
  errorCode: number
}

export const ToolUnavailableCard: FC<ToolUnavailableCardProps> = ({ toolLabel, toolName, errorCode }) => {
  const { t } = useTranslation()
  const isSmallScreen = useIsSmallScreen()
  const isWebTool = toolName === 'web_search' || toolName === 'parse_link'
  const ToolErrorIcon = isWebTool ? IconWorldOff : IconAlertCircle
  const openSearchSettings = async () => {
    const { navigateToSettings } = await import('@/modals/settings-navigation')
    navigateToSettings('/web-search')
  }

  return (
    <Paper
      role="status"
      radius={8}
      p={isSmallScreen ? 14 : 16}
      withBorder
      className={`bg-chatbox-background-primary ${GLASS_FILL_CLASS}`}
      style={{ borderColor: 'var(--chatbox-border-primary)' }}
    >
      <Group
        align="flex-start"
        wrap="nowrap"
        gap={isSmallScreen ? 10 : 14}
        style={isSmallScreen ? { flexDirection: 'column' } : undefined}
      >
        <ThemeIcon
          size={38}
          radius="50%"
          variant="light"
          style={{
            flexShrink: 0,
            color: 'var(--chatbox-tint-error)',
            background: 'var(--chatbox-background-error-secondary)',
          }}
        >
          <ToolErrorIcon size={20} stroke={1.8} />
        </ThemeIcon>

        <Box style={{ flex: 1, minWidth: 0, width: isSmallScreen ? '100%' : undefined }}>
          <Stack gap={4}>
            <Text size="sm" fw={600} lh={1.45}>
              {t('{{tool}} could not run', { tool: toolLabel })}
            </Text>
            <Text size="13px" c="var(--chatbox-tint-secondary)" lh={1.6} component="div">
              {isWebTool && errorCode === 20024 ? (
                t('The selected Web Search provider needs to be configured before it can run.')
              ) : (
                <Trans
                  i18nKey={ChatboxAIAPIError.getDetail(errorCode)?.i18nKey}
                  components={{
                    OpenExtensionSettingButton: (
                      <button type="button" className="underline" onClick={openSearchSettings} />
                    ),
                  }}
                />
              )}
            </Text>
          </Stack>

          {isWebTool && (
            <Button mt={10} size="xs" variant="light" fullWidth={isSmallScreen} onClick={openSearchSettings}>
              {t('Web Search settings')}
            </Button>
          )}
        </Box>
      </Group>
    </Paper>
  )
}
