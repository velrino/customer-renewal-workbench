# Renewal API

Go service for the Customer Renewal Workbench. The API runs on Cloud Run in Iowa and reads metadata for the native Firestore database `(default)` in the same region. [Scalar API reference](https://renewal-api-43zsh4z3ja-uc.a.run.app/docs)

## Development

From the repository root, use pnpm and the Go version specified in `backend/api/go.mod`.

```sh
export GOOGLE_CLOUD_PROJECT=customer-renewal-workbench
export FIRESTORE_DATABASE='(default)'
pnpm dev --filter=renewal-workbench-api
```

Run `pnpm dev` from the root to start both the API and frontend. The server listens on port 8080 by default. Use `PORT` to change it and `APP_ENV` to label the environment. Local runs use Application Default Credentials. Keep credential files outside the checkout. Cloud Run uses its attached runtime identity.

## Error reporting

Set `SENTRY_DSN` to the Go API project DSN to enable reporting. Events use `APP_ENV` and the Cloud Run revision, or an explicit `SENTRY_RELEASE`. The HTTP middleware reports handler panics across routes. The background Firestore check reports unexpected errors once per refresh. Local runs can omit the DSN.

## Structure

- `cmd/api` starts the server and reads environment settings.
- `internal/app` wires HTTP handlers to the server.
- `internal/modules/health-check` manages the health response and per-instance cache.
- `internal/shared/firestore` performs the read-only dependency check.
- `internal/shared/utils` calculates process uptime.
- `docs` contains the OpenAPI contract and its Scalar viewer.

Run `go test -race ./...` to exercise the handler and `go vet ./...` for static checks. GitHub Actions runs both and builds the service for backend changes.
