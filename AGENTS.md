# Working in Customer Renewal Workbench

Use English for documentation, identifiers, and UI copy. The [README](README.md) defines the challenge, sample accounts, product rules, and current delivery status.

- For product validation or a submission review, use the [renewal workflow skill](.agents/skills/renewal-workflow/SKILL.md).
- For architecture diagrams, workflow steps, and their README or PR previews, use the [architecture documentation skill](.agents/skills/architecture-docs/SKILL.md).
- For a source or diff review, use the [code review skill](.agents/skills/code-review/SKILL.md). Pay particular attention to misleading evidence, lost plans, session isolation, and competing updates for the last weekly slot.

Inspect the current checkout before describing a feature as implemented. Keep reviews read-only unless changes are requested. Distinguish AI contributions from checks the author personally performed.

## Implementation conventions

- Group API operations by domain in the [OpenAPI contract](backend/api/docs/openapi.json). Scalar renders the endpoint reference. Keep the [API README](backend/api/README.md) focused on setup, structure and operations.
- Keep domain rules in `backend/api/internal/modules/<domain>`. Put cross-module middleware in `internal/shared/<responsibility>` and general helpers in `internal/shared/utils`. Rate limits are a shared mechanism with policies chosen per route group.
- Use responsibility names such as `analytics` and `observability` for telemetry interfaces, folders and PR titles. Name providers where readers configure or troubleshoot an integration. [Frontend guide](frontend/web/README.md#telemetry-setup)
- In Shared API mode the browser subscribes to Firestore and sends mutations, including reset, through the API. The API checks business rules inside the transaction. Keep local account work in IndexedDB and environment preferences in local storage. [Persistence and scope](README.md#persistence-and-scope)
