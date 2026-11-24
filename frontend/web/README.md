# Customer Renewal Workbench Web

**TL;DR** — A Next.js App Router dashboard for reviewing six sample accounts, deciding which renewals need attention, and assigning follow-ups within a two-slot weekly limit. The app runs in the browser without backend setup. IndexedDB stores account work, and local storage keeps UI preferences.

## Run locally

Use Node.js 22.12+ and pnpm 10. From the repository root, run the following commands.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the [dashboard at `/`](http://127.0.0.1:3000/). Run `pnpm typecheck`, `pnpm test`, and `pnpm build` from the repository root. The production build exports static files to `frontend/web/out/`.

## Folder structure

| Folder | What belongs here |
| --- | --- |
| [`src/app/`](src/app/) | Next.js routes, the root layout, global styles, and app-wide providers. `page.tsx` renders the dashboard at `/`. |
| [`src/modules/admin/`](src/modules/admin/) | The workbench shell and dashboard UI. `layout/` holds navigation and reset controls. `features/dashboard/` holds the renewal overview, timeline, account queue, and account decisions. |
| [`src/shared/renewals/`](src/shared/renewals/) | Sample accounts in `accounts/`, attention and capacity rules with their tests in `workflow/`, and React hooks that connect the dashboard to the workflow and persistence in `hooks/`. |
| [`src/shared/storage/`](src/shared/storage/) | IndexedDB for saved account work and local storage for UI preferences. |
| [`src/shared/ui/`](src/shared/ui/) | Reusable components such as dialogs, date pickers, buttons, and toasts. |
| [`src/shared/hooks/`](src/shared/hooks/) | General-purpose hooks for mobile layouts and reduced motion. |
| [`src/shared/i18n/`](src/shared/i18n/) | next-intl configuration and the English message catalog. |
| [`src/shared/telemetry/`](src/shared/telemetry/) | `analytics/` handles pageview and event collection through PostHog. `observability/` handles browser exception reporting through Sentry. The app provider imports these modules by responsibility. |

## Telemetry setup

- **PostHog** counts dashboard visits with `$pageview` and reports uncaught JavaScript errors and unhandled promise rejections as `crw-error`. Error events include their source (`window` or `promise`). Autocapture for clicks and forms is disabled. Set `NEXT_PUBLIC_POSTHOG_ENABLED=true`, `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`, and `NEXT_PUBLIC_POSTHOG_HOST` at build time. For US Cloud, the ingestion host is `https://us.i.posthog.com`. Collection is disabled on localhost and respects Do Not Track. Events omit account identifiers, form values, exception text, and query strings.
- **Sentry** groups unexpected browser exceptions. Set `NEXT_PUBLIC_SENTRY_DSN` to enable it. On Vercel, the build uses the deployment environment and commit SHA. To upload production source maps, supply a build-only `SENTRY_AUTH_TOKEN` with release upload access and rebuild.

Both clients have session replay disabled.

The repository README covers the product rules and reviewer walkthrough. [Project README](../../README.md)
