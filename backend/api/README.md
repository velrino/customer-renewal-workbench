# Renewal API

Go service for the Customer Renewal Workbench. The API runs on Cloud Run in Iowa and reads metadata for the native Firestore database `(default)` in the same region. [Scalar API reference](https://renewal-api-43zsh4z3ja-uc.a.run.app/docs)

## Development

From this directory, use the Go version specified in `go.mod`.

```sh
export GOOGLE_CLOUD_PROJECT=customer-renewal-workbench
export FIRESTORE_DATABASE='(default)'
go run ./cmd/api
```

The server listens on port 8080 by default. Use `PORT` to change it and `APP_ENV` to label the environment. Local runs use Application Default Credentials. Keep credential files outside the checkout. Cloud Run uses its attached runtime identity.

## Structure

- `cmd/api` starts the server and reads environment settings.
- `internal/app` wires HTTP handlers to the server.
- `internal/modules/health-check` manages the health response and per-instance cache.
- `internal/shared/firestore` performs the read-only dependency check.
- `internal/shared/utils` calculates process uptime.
- `docs` contains the OpenAPI contract and its Scalar viewer.

Run `go test -race ./...` to exercise the handler and `go vet ./...` for static checks. GitHub Actions runs both and builds the service for backend changes.
