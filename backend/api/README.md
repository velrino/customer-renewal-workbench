# Renewal API

Go service for the Customer Renewal Workbench. The API runs on Cloud Run in Iowa and writes shared account changes to the native Firestore database `(default)` in the same region. [Scalar API reference](https://renewal-api-43zsh4z3ja-uc.a.run.app/docs)

## Development

From the repository root, use pnpm and the Go version specified in `backend/api/go.mod`.

```sh
export GOOGLE_CLOUD_PROJECT=customer-renewal-workbench
export FIRESTORE_DATABASE='(default)'
pnpm dev --filter=renewal-workbench-api
```

Run `pnpm dev` from the root to start both services. Next.js refreshes frontend edits in the browser. Turbo starts Air for the backend. Air recompiles and restarts the Go process when its source, module files, OpenAPI contract or Scalar page changes. The first run downloads the pinned Air version through Go. Reload the docs tab to see those changes. The server listens on port 8080 by default. Use `PORT` to change it and `APP_ENV` to label the environment. Local runs use Application Default Credentials. Keep credential files outside the checkout. Cloud Run uses its attached runtime identity.

## Shared workbench

The API commits changes to `workbenches/shared` in one Firestore transaction. The frontend listens to that document. An empty database starts with the six sample accounts and zero saved changes. Reset restores that initial view for all API users. A successful reset starts a 60-second cooldown stored in the same transaction. Commands can still be saved during the cooldown.

Each API instance admits up to 30 commands and 3 reset attempts per network peer in a fixed one-minute window, with ceilings of 120 commands and 12 reset attempts across all peers. Rejections return HTTP 429 with a `Retry-After` delay in seconds. Peers behind a proxy can share a quota because the service uses the socket address. Restarts clear the in-memory counters. The reset cooldown applies across instances running this version. Drain previous revisions when rolling out, since older writers replace the board without preserving the cooldown.

For isolated local development, install Firebase CLI and Java 21, then run this from the repository root in one terminal:

```sh
firebase emulators:start --only firestore --config infra/firebase/firebase.json --project demo-renewal
```

In a second terminal, run:

```sh
GOOGLE_CLOUD_PROJECT=demo-renewal NEXT_PUBLIC_FIRESTORE_PROJECT_ID=demo-renewal \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 \
pnpm dev
```

Select **Shared API** under **User menu → Environment**. The local API uses port 8080. Its emulator health check reads the shared document and also accepts an empty database. In Cloud Run, the existing health check reads database metadata.

### Production setup

Deploy the Firestore rules from the repository root using `firebase deploy --only firestore:rules --config infra/firebase/firebase.json --project customer-renewal-workbench`. The rules grant public single-document reads on the synthetic workbench. Browser clients cannot list documents or write to Firestore.

Grant the Cloud Run runtime identity `datastore.databases.getMetadata`, `datastore.databases.get`, and `datastore.entities.get`, `datastore.entities.create`, `datastore.entities.update` on the intended database. The service uses its attached identity for transactions. Deploy the Go service and build the frontend against the same project. The frontend defaults to the project above and supports build-time overrides through `NEXT_PUBLIC_FIRESTORE_PROJECT_ID` and `NEXT_PUBLIC_API_ORIGIN`. When using a named database, set `FIRESTORE_DATABASE` on the API and `NEXT_PUBLIC_FIRESTORE_DATABASE` at frontend build time to the same ID. Set the matching database in `infra/firebase/firebase.json` and deploy its rules before enabling the frontend. [Firestore IAM permissions](https://firebase.google.com/docs/firestore/security/iam)

## Error reporting

Set `SENTRY_DSN` to the Go API project DSN to enable reporting. Events use `APP_ENV` and the Cloud Run revision, or an explicit `SENTRY_RELEASE`. The HTTP middleware reports handler panics across routes. The background Firestore check reports unexpected errors once per refresh. Local runs can omit the DSN.

## Structure

- `cmd/api` starts the server and reads environment settings.
- `internal/app` wires HTTP handlers to the server.
- `internal/modules/health-check` manages the health response and per-instance cache.
- `internal/modules/renewals` validates shared commands, account revisions and weekly capacity.
- `internal/shared/firestore` performs the read-only dependency check.
- `internal/shared/utils` calculates process uptime.
- `docs` contains the OpenAPI contract and its Scalar viewer.

Run `go test -race ./...` to exercise the handler and `go vet ./...` for static checks. GitHub Actions runs both and builds the service for backend changes.
