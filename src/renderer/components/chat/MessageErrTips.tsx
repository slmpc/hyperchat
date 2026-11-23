import type { Message } from '@shared/types'
import { GenericMessageError } from './GenericMessageError'
import { resolveMessageErrorPresentation } from './message-error-presentation'

export default function MessageErrTips(props: {
  msg: Message
  sessionId?: string
  onRetry?: () => void | Promise<void>
}) {
  const { msg, onRetry } = props
  const presentation = resolveMessageErrorPresentation(msg)

  if (!msg.error) return null
  return (
    <GenericMessageError
      msg={msg}
      presentation={
        presentation.kind === 'quota' || presentation.kind === 'agent-mode-reward'
          ? { ...presentation, kind: 'unknown' }
          : presentation
      }
      onRetry={onRetry}
    />
  )
}
