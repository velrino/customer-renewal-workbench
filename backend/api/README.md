# Customer Renewal Workbench API

**TL;DR** — A Go service on Cloud Run lists renewal accounts and handles every change to the shared portfolio. Firestore transactions enforce account revisions and the two-slot limit. The dashboard listens directly to Firestore for committed changes. [Live API](https://renewal-api-809086370856.us-central1.run.app/) · [Scalar API reference](https://renewal-api-809086370856.us-central1.run.app/docs)

## Run locally

Use Node.js 22.12+, pnpm 10 and the Go version in [go.mod](go.mod). Run these commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm dev --filter=renewal-workbench-api
```

Open the [local Scalar reference](http://127.0.0.1:8080/docs). The reference works as soon as the server starts. To change the default port, set `PORT` on the API and `NEXT_PUBLIC_API_ORIGIN` on the frontend. To exercise account reads and writes, connect Firestore using the emulator setup below. Turbo starts Air, which downloads on first use and restarts the API after changes to Go source, module files or API docs. Refresh the Scalar tab to see contract changes.

### Shared workbench

For an isolated demo, install the Firebase CLI and Java 21. In one terminal, start Firestore on port 8085.

```sh
firebase emulators:start --only firestore --config infra/firebase/firebase.json --project demo-renewal
```

In a second terminal, start both services with the same emulator settings. If the API is already running on port 8080, stop that process first.

```sh
GOOGLE_CLOUD_PROJECT=demo-renewal NEXT_PUBLIC_FIRESTORE_PROJECT_ID=demo-renewal \
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 \
pnpm dev
```

Open the [local dashboard](http://127.0.0.1:3000/) and select **User menu → Environment → Shared API**. An empty database shows six sample accounts with no saved changes. For API-only development against a hosted database, set `GOOGLE_CLOUD_PROJECT` and `FIRESTORE_DATABASE` and run the filtered command above with Application Default Credentials. Keep credential files outside the checkout.

## Folder structure

| Folder | What belongs here |
| --- | --- |
| [cmd/api/](cmd/api/) | Server entry point, environment settings and wiring for storage, telemetry and routes. |
| [internal/app/](internal/app/) | HTTP router setup for health and documentation. |
| [internal/modules/health-check/](internal/modules/health-check/) | Health responses and the per-instance dependency cache. |
| [internal/modules/renewals/](internal/modules/renewals/) | Paginated account reads, command validation, shared reset and Firestore transactions. |
| [internal/shared/firestore/](internal/shared/firestore/) | Firestore dependency probe for the hosted database. |
| [internal/shared/ratelimit/](internal/shared/ratelimit/) | HTTP middleware for per-peer and per-instance quotas. |
| [internal/shared/observability/](internal/shared/observability/) | Sentry integration for HTTP panics and background probe failures. |
| [internal/shared/utils/](internal/shared/utils/) | Process uptime calculation. |
| [docs/](docs/) | OpenAPI contract and Scalar viewer. |

## Shared data and request limits

The API writes to `workbenches/shared`. A confirmed reset clears saved changes for everyone and records a 60-second cooldown in the same transaction. Other commands can still be saved during that minute.

| Operation | Requests/min per network peer | Requests/min per instance |
| --- | ---: | ---: |
| List accounts | 60 | 240 |
| Account commands | 30 | 120 |
| Reset attempts | 3 | 12 |

Each group has independent in-memory token buckets that start full. Each request consumes a token from both buckets. A throttled caller receives HTTP 429 and a `Retry-After` delay in seconds. By default the socket peer identifies the caller. Set `TRUSTED_PROXY_HOPS` only after verifying how many forwarding entries the ingress appends on every supported path. The API selects that entry from the right, groups IPv6 addresses by /64, and falls back to the socket peer for incomplete or malformed headers. A direct-access deployment should leave the value at zero. Restarting an instance refills its quotas. The reset cooldown persists across instances.

The health check has its own cache. On Cloud Run it reads database metadata. With the emulator it reads the shared document and accepts an empty database.

## Production setup

Backend CI tests changes under `backend/api/` and changes to its workflow. After those changes reach `master`, GitHub Actions uses Workload Identity Federation to push the image to Artifact Registry and update `renewal-api` in `us-central1`. The deploy compares the public OpenAPI document with the committed file and reads the first page of renewals.

- **Database and identity.** Cloud Run and the native Firestore database `(default)` run in Iowa. Grant the attached runtime identity `datastore.databases.getMetadata`, `datastore.databases.get`, and `datastore.entities.get`, `datastore.entities.create`, `datastore.entities.update` on the target database. [Firestore IAM permissions](https://firebase.google.com/docs/firestore/security/iam)
- **Frontend configuration.** Build the frontend with the matching `NEXT_PUBLIC_FIRESTORE_PROJECT_ID` and `NEXT_PUBLIC_API_ORIGIN`. For a named database, match `FIRESTORE_DATABASE` on the API with `NEXT_PUBLIC_FIRESTORE_DATABASE` in the frontend build and the database in [firebase.json](../../infra/firebase/firebase.json).
- **Access rules.** Deploy the rules before enabling the frontend. They allow public reads of the single synthetic board document and deny browser writes and document listing. From the repository root, run `firebase deploy --only firestore:rules --config infra/firebase/firebase.json --project customer-renewal-workbench`. [Firestore rules](../../infra/firebase/firestore.rules)
- **Rollout.** Drain revisions that predate the reset cooldown. Those writers can replace the board without preserving its last reset time.

## Telemetry setup

Set `SENTRY_DSN` to enable error reporting. The HTTP middleware reports handler panics. A failed Firestore probe sends one report per refresh for unexpected errors. `APP_ENV` labels the environment and defaults to `local`. Events use the Cloud Run revision unless `SENTRY_RELEASE` overrides it. Local runs can omit the DSN.

## Verification

From the repository root, run the same Go checks used in backend CI.

```sh
cd backend/api
go vet ./...
go test -race ./...
go build ./...
```

[Frontend guide](../../frontend/web/README.md) · [Project README](../../README.md)

### Demo deployment settings

Set `GOOGLE_CLOUD_PROJECT` to the Firestore project. Set `WORKBENCH_ORIGINS` to comma-separated, exact dashboard and Scalar origins. The local default includes localhost and 127.0.0.1 on ports 3000 and 8080. For remote Vercel previews, explicitly add the intended origin before sharing it. Commands, reset and preflight check browser origins before consuming a quota or writing. Clients without an Origin header can still use the public API.

Health, Scalar and the spec each have an independent read policy of 120 requests/minute per peer and 480 per instance. On master, the deployment workflow sets the service and revision maxima to two instances. Configure a project billing alert for Firestore as described in the [cost guide](../../docs/COST/README.md#controls-for-the-public-demo). Document the measured ingress topology before configuring trusted hops, and confirm the chosen identity distinguishes two networks using normal read traffic.

Commands merge the updated account’s fields in a transaction. Reset replaces the account map, retaining the version watermark, cooldown and unrelated top-level fields. An invalid watermark or cooldown requires operator repair.

## Local reviewer sessions

From the repository root, `pnpm dev:reviewer` runs the API at `127.0.0.1:8181` with project `demo-renewal-reviewer`, Auth Emulator at port 9199 and Firestore Emulator at port 8185. The profile rejects incomplete emulator settings and Cloud Run startup. All three renewal operations require a bearer token. Health, Scalar and the OpenAPI schema are available before sign-in.

In the [local Scalar reference](http://127.0.0.1:8181/docs), send the credentials from the private local file to **Reviewer → Sign in**, then use the returned token for **Bearer authentication**. Use **Sign out** to revoke it. The API verifies the password directly with the Auth Emulator and checks the account UID. It issues its own opaque, one-hour session. API restarts invalidate sessions. The browser keeps the token in tab memory.

This profile assumes a trusted workstation. Firebase emulator administration is accessible to local processes, and the synthetic board permits direct document reads. Keep the loopback ports off tunnels and port-forwarding services. The production project, authentication providers and Firestore rules use their existing configuration.
