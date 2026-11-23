# Customer Renewal Workbench

**TL;DR** — A customer-success manager oversees 40 accounts and can personally help two this week. This planned workbench brings renewal dates, usage and support notes into one queue so the manager can choose two accounts, record the evidence and assign each follow-up to an owner.

This Hacker Eval prototype uses six fictional B2B software accounts. The buyer is the head of Customer Success. The app will simulate the account owner’s follow-through.

**Current status:** Design and repository scaffold. Implementation and deployment are pending. The exercise targets 3–5 focused hours within 48 hours of confirmed start. The submission screen lists November 25, 2026 at 4:53:03 PM as the deadline.

[Editable project plan](docs/PLANS/0-START/plan.excalidraw) · [Estimated monthly costs by user count](docs/COST/README.md)

![Customer Renewal Workbench plan showing the account queue, intervention workflow, and deployment estimates](docs/PLANS/0-START/plan.png)

## Starting portfolio

The prototype will open with six synthetic accounts. Annual contract value (ACV) is in USD. Renewal days are relative to a fixed sample day. Adoption is the percentage of licensed users active that week.

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

Use this sequence against the deployed prototype once available:

1. Open the account list without importing data. Open Cove's detail dialog using the keyboard. Inspect its renewal, ACV, critical issue, strong usage, and positive sponsor together.
2. Compare Drift. Its adoption should read **Unknown**, with reporting failure visible as the reason. Record a request for a corrected report. Verify that the count of committed interventions stays unchanged.
3. Return to Cove and try saving a plan without an owner. Expect a labeled field error and the draft to remain open. Supply an owner and follow-up date, save, and check for confirmation beside the evidence. Reload and reopen Cove to verify the saved values.
4. Switch to the labeled account-owner simulation and resolve Cove's critical issue. The attention reason should change to monitoring while the saved follow-up remains visible. Close the dialog and check that focus returns to its opener.
5. Commit the second slot to Ember. Try adding Beacon as a third distinct account, then edit Ember's existing plan. The third commitment should be rejected and the edit should succeed. With one slot free, simultaneous saves for two accounts should accept exactly one.
6. Search for an absent account. Expect a clear empty state and a keyboard-accessible action that restores the list.

## Engineering choices and scope

The planned frontend is a single React/Vite workbench adapted from shadcn-admin, with an account list, filters, and a detail dialog. Comparing accounts requires opening each detail in turn. That trade-off keeps the main workflow small enough to finish and verify within the exercise.

A Go API on Cloud Run will validate plan updates and enforce the weekly capacity rule in a Cloud Firestore transaction. The browser will subscribe to changes within its demo session so the manager can see an owner's update in a second tab. Reloading should restore the saved state, and a fresh browser session should start with its own six accounts. This adds deployment and session-isolation work in exchange for demonstrating real persistence and live updates.

The exercise uses synthetic data and explainable attention rules. Live analytics, actual outreach, support and CRM integrations, churn prediction, paid AI features, billing, and production account management are outside the prototype scope.

## Proposed success metric

**Share of accounts renewing within 30 days that have a timely, evidence-backed intervention.** Count each account once. Include it in the numerator when a plan was saved before renewal, links to a specific signal, names an owner, and schedules follow-up by the renewal date. In the starting portfolio the denominator is four: Beacon, Cove, Drift, and Ember. Use saved records and timestamps to calculate the share. It measures planning coverage. Assessing whether an intervention improved renewal outcomes would require actual outcomes and a credible comparison.

## Setup, verification, and submission

There is no runnable application or local setup command yet. The next implementation step is the seeded account list and detail dialog, followed by API persistence and the two-slot transaction. Before submission, add the verified local setup commands and run the walkthrough against the public deployment. The API, browser interactions, reload persistence, realtime updates, accessibility, and concurrency checks are all pending.

AI assistance so far covers brainstorming interface alternatives, preparing the architecture and cost drawings, and drafting this README. Before submission, document the implementation decisions the author changed and the checks they personally performed.

The required deliverables are a public repository and a public HTTPS prototype that opens with the sample accounts. The walkthrough recording is optional. The prototype URL and recording are pending. [Repository](https://github.com/velrino/customer-renewal-workbench)

## Reviewing with an AI assistant

Open [AGENTS.md](AGENTS.md) for project instructions and links to the review skills. Any reviewer can follow them as plain Markdown.
