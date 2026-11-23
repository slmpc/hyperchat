export const CHATBOX_PRODUCT_SOURCES = `## Source of truth

- Start from https://chatboxai.app/llms.txt for current machine-readable discovery links.
- For client guides, follow the relevant documentation links from llms.txt. This build uses user-configured model providers.
- For developer, authentication, API, MCP, or integration questions, follow the relevant docs links from llms.txt.`

export const CHATBOX_PRODUCT_ANSWERING_RULES = `## Answering rules

- Fetch the relevant source before answering when current client behavior matters.
- If the source cannot be fetched, say that the current source could not be accessed and avoid inventing details.
- Include the source URL used in the answer when giving client details.
- Answer in the user's language unless they ask otherwise.`
