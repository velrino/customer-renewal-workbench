# Renewal API

`GET /` reports whether the service can read a document from Firestore. The probe reads `_health/probe`. A successful lookup counts as healthy even when the document is absent.

| Response | Meaning | Per-instance cache |
| --- | --- | --- |
| 200, `ok` | Firestore responded | 60 seconds |
| 503, `degraded` | Missing configuration, deadline exceeded, or dependency unavailable | 5 seconds |

Concurrent requests share one refresh. Every response includes process uptime, the snapshot creation and expiry times, and timings in milliseconds. The HTTP response sets `Cache-Control: no-store` so callers see current uptime and remaining cache time.

## Run locally

Use Java 17 and Maven 3.9. From this directory:

```sh
mvn clean verify
export GOOGLE_CLOUD_PROJECT=customer-renewal-workbench
export FIRESTORE_DATABASE=default
java -cp 'target/classes:target/dependency/*' api.Main
```

Open [the local health endpoint](http://localhost:8080/). Set `PORT` to override 8080 or `APP_ENV` to set the environment label. The Firestore client uses Application Default Credentials. For local development, use an authorized ADC identity or point `GOOGLE_APPLICATION_CREDENTIALS` to a file outside the checkout. Cloud Run uses the attached runtime service account.

## Structure

- `src/main/scala/api/Main.scala` starts the HTTP server.
- `modules/healthcheck/` under the main API package owns the HTTP contract and snapshot cache.
- `shared/firestore/` owns the bounded Firestore read.
- `src/test/scala/api/` exercises HTTP responses and concurrent cache access. GitHub Actions runs Maven verification for backend changes.
