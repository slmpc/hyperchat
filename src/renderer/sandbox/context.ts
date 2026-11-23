import type { ModelInterface } from '@shared/models/types'
import type { SandboxProvider } from '@shared/sandbox-provider'
import type { SessionSettings } from '@shared/types'

/** Resolve the sandbox capabilities used to prepare a conversation context. */
export async function resolveContextSandbox(options: {
  enabled: boolean
  model: Pick<ModelInterface, 'isSupportToolUse'>
  settings: SessionSettings
  createProvider: () => SandboxProvider | null
}): Promise<{ sandboxProvider: SandboxProvider | null; canExecuteCode: boolean }> {
  const sandboxProvider = options.enabled ? options.createProvider() : null
  const workingDirectories =
    options.settings.workingDirectories?.filter((directory) => directory.trim().length > 0) ?? []
  if (sandboxProvider && workingDirectories.length > 0) {
    sandboxProvider.setExtraWritableDirs(workingDirectories)
  }
  let canExecuteCode = Boolean(
    sandboxProvider && sandboxProvider.type !== 'cloud' && options.model.isSupportToolUse('agent')
  )
  if (canExecuteCode && sandboxProvider) {
    canExecuteCode = (await sandboxProvider.checkAvailability()).available
  }
  return { sandboxProvider, canExecuteCode }
}
