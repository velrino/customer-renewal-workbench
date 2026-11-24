# Customer Renewal Workbench

**TL;DR** — A Customer Success manager oversees 40 accounts and can help two this week. This Hacker Eval prototype uses six fictional B2B accounts to show how the manager can review renewal evidence, choose interventions, and assign follow-ups. The head of Customer Success is the buyer.

[Live dashboard](https://customer-renewal-workbench.vercel.app/) · [Account queue](https://customer-renewal-workbench.vercel.app/#account-queue) · [Frontend guide](frontend/web/README.md) · [Project plan](docs/PLANS/0-START/plan.excalidraw) · [Plan preview](docs/PLANS/0-START/plan.svg) · [Cost estimates](docs/COST/README.md)

## Run locally

Use Node.js 22.12+ and pnpm 10. Run these commands from the repository root.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the [local dashboard](http://127.0.0.1:3000/). The [frontend guide](frontend/web/README.md) covers the folder structure, build, and telemetry setup.

## Starting portfolio

Renewal dates are relative to today in the browser’s time zone. Adoption is the share of licensed users active that week.

| Account | ACV (USD) | Renews in | Adoption | Evidence |
| --- | ---: | ---: | --- | --- |
| Atlas | $100,000 | 45 days | 85% | Positive sponsor and no unresolved issue |
| Beacon | $18,000 | 14 days | 70% → 20% | Sponsor unreachable |
| Cove | $80,000 | 21 days | 80% | Critical issue open and sponsor positive |
| Drift | $40,000 | 30 days | Unknown | Usage report failed and sponsor sentiment unknown |
| Ember | $55,000 | 7 days | 35% | Budget approval pending |
| Field | $25,000 | 60 days | 65% | Issue resolved and sponsor positive |

One defensible choice is **Ember and Cove**. For Ember, identify the budget approver and confirm the decision date. For Cove, agree on a resolution date with support and schedule a sponsor update. Beacon is a viable alternative while the cause of the adoption drop is investigated.

## Decision rules

- **Review now** applies to an open critical issue, pending budget approval within 14 days of renewal, or an adoption drop of at least 30 percentage points with an unreachable sponsor. An active plan leaves this status in place. Completing the plan changes it to **Reviewed** while the same concern persists.
- When none of those rules applies, missing usage or unknown sentiment yields **Needs information**. Otherwise, an active intervention yields **Follow-up planned**, and the default is **Routine review**. Within each group, the queue sorts by earliest renewal.
- A committed intervention uses one slot per account and requires evidence, an owner, and a follow-up by the renewal date. Edits keep the same slot, information requests use zero, and completing a plan frees its slot. Resolving a concern updates the current signal while preserving the plan’s original evidence.

## Reviewer walkthrough

Start in a fresh browser profile and skip or finish the quick tour.

1. Open **Cove** and check its critical issue alongside 80% adoption and positive sponsor sentiment. Open **Drift**, verify **Unknown** adoption, and save an information request for a corrected usage report. The slot count stays at zero.
2. Save a **Cove** intervention with an owner and a follow-up two days from today. Check that a missing owner blocks saving and the calendar disables dates after renewal. Reload and reopen the plan to verify the saved evidence, owner, and date.
3. Under Cove’s **Owner actions**, mark the critical issue resolved. Cove moves to **Follow-up planned**, retains the original plan evidence, and still occupies one slot.
4. Save an **Ember** plan to fill the second slot. Ember stays **Review now**. Try saving **Beacon** and verify the limit. Edit Ember’s owner and check that the count stays at two.
5. Complete Ember’s intervention. It moves to **Reviewed** with budget approval still pending. Reload to verify that status, then use the free slot for Beacon. Complete Cove’s plan and check that Cove returns to **Routine review** and still shows the completed plan.
6. Search for an absent account and recover with **Show all accounts**. Toggle the dashboard’s 30-day renewal filter. Press Escape in an account dialog and verify focus returns to the trigger. An independent browser profile starts with zero saved plans.

## Persistence and scope

IndexedDB saves work in the current browser. Each write checks capacity and updates the plan in one transaction across tabs. A revision check rejects stale edits. If storage fails, the draft can be retried. The diagram’s Go API and Firestore describe a possible later phase for shared data across devices. The prototype uses synthetic evidence and simulates owner actions.

**Proposed success metric** — Share of accounts renewing within 30 days with a plan saved before renewal that cites a signal, names an owner, and schedules follow-up by renewal. The starting denominator is Beacon, Cove, Drift, and Ember. The dashboard measures planning coverage. Measuring renewal impact would require outcome data and a comparison.

## Verification and attribution

- The author personally checked the frontend and directed the dashboard layout, dialogs, theme options, and frontend-first approach.
- Codex ran type checking, tests, and the static build. Chrome checks covered the account workflow, reloads, competing saves for the last slot, browser-profile isolation, and storage failure recovery. Safari, Firefox, physical devices, and screen readers remain unverified.
- AI assistance covered design alternatives, the architecture diagram, implementation, documentation, and scripted verification. [Reviewer instructions](AGENTS.md)
