import { BUILTIN_MCP_SERVERS as definitions } from '@chatbox/core/mcp'
import i18n from '@/i18n'
export type { BuildinMCPServerConfig } from '@chatbox/core/mcp'
export const BUILTIN_MCP_SERVERS = definitions.map((server) => ({ ...server, description: i18n.t(server.description) }))
export { getBuiltinServerConfig } from '@chatbox/core/mcp'
