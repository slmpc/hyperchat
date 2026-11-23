import { PROJECT_URL } from '../project-links'

export const CHATBOX_PRODUCT_SOURCES = `## Documentation sources

- Start with the HyperChat README and source code at ${PROJECT_URL}.
- For inherited client features and integrations, consult the upstream documentation at https://chatboxai.app/llms.txt and verify that the feature is available in HyperChat.
- HyperChat uses user-configured model providers.`

export const CHATBOX_PRODUCT_ANSWERING_RULES = `## Answering rules

- Fetch the relevant source before answering when current client behavior matters.
- If the source cannot be fetched, say that the current source could not be accessed and avoid inventing details.
- Include the source URL used in the answer when giving client details.
- Answer in the user's language unless they ask otherwise.`
