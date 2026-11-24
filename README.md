# Customer Renewal Workbench

**TL;DR** — A customer-success manager oversees 40 accounts and can personally help two this week. This workbench brings renewal dates, usage and support notes into one queue so the manager can choose two accounts, record the evidence and assign each follow-up to an owner.

This Hacker Eval prototype uses six fictional B2B software accounts. The buyer is the head of Customer Success. The app simulates the account owner’s follow-through.

**Try the prototype** — [Open the dashboard](https://customer-renewal-workbench.vercel.app/) or [open the account queue](https://customer-renewal-workbench.vercel.app/#account-queue). Start with a fresh browser profile for the original six cases. Changes are saved in this browser and survive a reload. Open an account from the queue. The Accounts card on the dashboard also opens the same detail.

[Editable project plan](docs/PLANS/0-START/plan.excalidraw) · [Estimated monthly costs by user count](docs/COST/README.md)

![Customer Renewal Workbench plan showing the account queue, intervention workflow, and deployment estimates](docs/PLANS/0-START/plan.svg)

## Starting portfolio

The prototype opens with six synthetic accounts. Annual contract value (ACV) is in USD. The demo calculates renewal dates relative to today in the browser’s local time zone. Saved follow-up dates retain the calendar day the manager chose. Adoption is the percentage of licensed users active that week.

| Account | ACV | Renews in | Weekly adoption | Other evidence |
| --- | ---: | ---: | --- | --- |
| Atlas | $100,000 | 45 days | 85% | No unresolved issue. Positive sponsor. |
| Beacon | $18,000 | 14 days | Fell from 70% to 20% | Sponsor unreachable. |
| Cove | $80,000 | 21 days | 80% | One critical issue open. Positive sponsor. |
| Drift | $40,000 | 30 days | Unknown | Usage reporting failed. Sponsor sentiment is unknown. |
| Ember | $55,000 | 7 days | 35% | Sponsor says budget approval is pending. |
| Field | $25,000 | 60 days | 65% | Issue resolved. Positive sponsor. |

## How the manager chooses two interventions

One defensible choice is **Ember and Cove**. Ember renews in seven days, and the sponsor has identified a specific dependency. Its owner can identify the budget approver and confirm the decision date. For Cove, the owner can agree on a resolution date with support and schedule an update with the sponsor. Beacon is the closest alternative. Its drop in usage and unreachable sponsor warrant investigation, but the cause of that drop is unknown. The manager can choose Beacon and record their reasoning.

Cove illustrates three distinct things the interface should show together:

| What the manager sees | Example |
| --- | --- |
| Signal | A critical issue is open. Adoption is 80%, and the sponsor is positive. |
| Hypothesis | The unresolved issue could delay renewal. The sponsor has yet to confirm its effect. |
| Agreed plan | Once agreed, record “coordinate issue resolution,” assign an owner, and set a follow-up for two days after the sample day. |

**Capacity rule:** A committed intervention occupies one weekly slot per account. Editing its owner or date keeps the same slot. An information request records an evidence gap and leaves the slot available. Resolving a concern updates the attention reason; the owner explicitly completes the plan to release the slot. This keeps the evidence and the commitment independently visible.

## Reviewer walkthrough and acceptance checks

Open the [public dashboard](https://customer-renewal-workbench.vercel.app/) in a fresh browser profile, or start the frontend locally using the setup below. Skip or finish the quick tour, then scroll to the account queue on the dashboard. The names below are the labels on the screen.

1. Inspect **Cove**. Its critical issue, 80% adoption and positive sponsor are visible together on **Overview**. Compare **Drift**. Its adoption says **Unknown**, and its signal says the usage report failed. On **Plan**, choose **Request information**, enter “Corrected weekly usage report”, and choose **Save information request**. The confirmation says no extra slot was used, and the count stays at zero. The saved request appears on **Plan**.
2. Open Cove, select **Plan**, and choose **Plan an intervention**. The suggested action is **Coordinate a fix for the critical issue**. Choose **Save intervention** with no owner. Enter Sam, then check that the calendar disables dates after Cove’s renewal. Choose a follow-up two days from today and save. The count becomes one. Reload, reopen Cove, and select **Plan**. The agreed plan still shows the action, Sam, the selected follow-up date, and the evidence from the time of the decision.
3. On **Owner actions**, under **Account owner simulation**, choose **Mark critical issue resolved**. Cove changes from **Review now** to **Follow-up planned**. The current signal says the issue is resolved. The agreed plan still cites the open issue, and the slot stays in use. Leave this plan active.
4. Open **Ember** and save **Confirm budget approval** with an owner and a follow-up within the next seven days. The count becomes two. Ember stays **Review now** because budget approval is still pending. Open **Beacon** and try to save a valid plan. The app says both weekly slots are in use. Choose **Edit intervention** on Ember, change the owner, and save. The count stays at two.
5. Choose **Mark intervention complete** on Ember. One slot is free, and Ember remains **Review now**. Use **Try saving plans for Ember and Beacon**. The confirmation says Ember’s plan was saved and Beacon’s was not. The count returns to two of two. An independent browser profile shows the original six accounts and zero saved plans.
6. Choose **Mark intervention complete** on Cove. Its status becomes **Routine review**, the completed plan remains visible, and a slot is free. Search for an absent name. The queue says “No accounts match your search or filters.” Choose **Show all accounts**. Scroll up to the dashboard cards. Open **Renewing within 30 days**, then **Remove 30-day renewal filter**. Press Escape to close an account dialog. Focus returns to the control that opened it.

## Decision rules

An open critical issue warrants **Review now**. Pending budget approval warrants **Review now** when renewal is within 14 days inclusive. A decline of at least 30 percentage points in adoption warrants **Review now** when the sponsor is also unreachable. These review rules win over an open plan, so Ember stays **Review now** after a plan is saved while budget approval is pending. If no review rule matches, missing usage or unknown sentiment is **Needs information**. An active intervention is **Follow-up planned** only when no review rule still matches. Cove reaches that status after its critical issue is resolved and while its plan remains active. Completing that plan makes Cove **Routine review**. Atlas and Field start as **Routine review**. Within each attention group the queue sorts by earliest renewal. Contract value is not a tie-breaker. The manager chooses the interventions. Missing adoption stays **Unknown** and is not stored as zero. A hypothesis says what could or may be true and asks the manager to check it. It is not a prediction.

## Engineering choices and scope

The frontend is a Next.js App Router workbench with React, an English next-intl catalog and selected shadcn-admin components. Its dashboard and account list share a detail dialog. Comparing accounts requires opening each detail in turn. That trade-off keeps the main workflow small enough to finish and verify within the exercise.

The frontend runs locally and supports static export. IndexedDB persists records by account. Each write reads current commitments and updates the plan in one transaction. Two tabs therefore share a single weekly limit. A revision check rejects stale edits, and tabs refresh after a change. If browser storage is unavailable, writes are disabled and the draft can be retried. The synthetic week is fixed so the reviewer can reproduce the cases.

Browser persistence keeps the walkthrough independent of backend setup. Clearing site data resets it. Another device or profile has a separate portfolio. The Go API and Firestore in the design diagram are a possible later phase for shared data across devices.

The exercise uses synthetic data and explainable attention rules. Live analytics, actual outreach, support and CRM integrations, churn prediction, paid AI features, billing, and production account management are outside the prototype scope.

## Proposed success metric

**Share of accounts renewing within 30 days that have a timely, evidence-backed intervention.** Count each account once. Include it in the numerator when a plan was saved before renewal, links to a specific signal, names an owner, and schedules follow-up by the renewal date. In the starting portfolio the denominator is four: Beacon, Cove, Drift, and Ember. For a real reporting period, compare plan creation timestamps and follow-up dates with each renewal date. A point-in-time metric would also need plan history. The prototype stores the latest plan and uses a fixed sample day, so it does not report a measured business result. It measures planning coverage. Assessing whether an intervention improved renewal outcomes would require actual outcomes and a credible comparison.

## Setup, verification, and submission

From the repository root, start the frontend with Node.js 22.12+ and pnpm 10.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the [local dashboard](http://127.0.0.1:3000/).

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` from the repository root. Turborepo runs each task in the workspace packages that implement it. The frontend static build is written to `frontend/web/out/`. `pnpm test` checks the attention rules, the slot limit, an information request, a missing owner, and Cove after the issue is resolved.

### Verification

The project author personally checked the frontend.

Codex ran `pnpm typecheck`, `pnpm test`, and `pnpm build` locally. All three passed. Its scripted headless Chrome walkthrough on a fresh profile opened the account queue and checked all six seeded rows, Drift’s unknown usage and information request, Cove’s conflicting signals, a missing owner, a follow-up after renewal, save and reload, issue resolution to Follow-up planned, focus returning to Cove, a third intervention rejected at capacity, and empty-search recovery. The rule tests also check that editing an existing plan keeps the same slot. A later agent session used Chrome DevTools on the local app and confirmed the screen labels in the walkthrough above, including Ember remaining Review now with an active plan and the same-tab control saving only one of the two plans. In a subsequent local Chrome check, Codex submitted Ember and Beacon plans from separate tabs with one slot remaining. Ember saved, Beacon received the capacity error, and reloading showed two occupied slots. An independent browser context showed zero occupied slots. Simulated channel failures and a closed database connection also exercised save and retry behavior. Safari, Firefox, physical devices and screen readers remain unverified.

AI assistance covered interface alternatives, the architecture diagram, implementation, documentation and scripted verification. The author directed the dashboard layout, modal behavior, theme options and phased frontend-first approach.

[Public prototype](https://customer-renewal-workbench.vercel.app/) · [Local dashboard](http://127.0.0.1:3000/) · [Public repository](https://github.com/velrino/customer-renewal-workbench)

## Reviewing with an AI assistant

Open [AGENTS.md](AGENTS.md) for project instructions and links to the review skills. Any reviewer can follow them as plain Markdown.
