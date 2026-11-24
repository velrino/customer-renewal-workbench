# Monthly cost model

**TL;DR** — At 100,000 monthly reviewers, the modeled workload costs **$92.25** with eligible free static hosting or **$112.25** with one Vercel Pro seat. These are scenario estimates. The deployed demo’s bill is unknown here.

| Delivered | At scale |
| --- | --- |
| Vercel serves static assets. Cloud Run handles API requests. Firestore stores one shared board, and each subscribed browser receives committed updates. Local account saves stay in IndexedDB. | Estimate frontend traffic, billed API time, reads per connected listener and bytes per snapshot from real usage. Two boards with the same reviewer count can have different costs if one has more simultaneous listeners. |

| Estimated monthly cost (USD)     |      1 |    100 |  1,000 | 10,000 | 100,000 |
| -------------------------------- | -----: | -----: | -----: | -----: | ------: |
| Google Cloud Run · Go API        |  $0.00 |  $0.00 |  $0.00 |  $0.48 |  $48.48 |
| Firestore · storage and transfer |  $0.00 |  $0.00 |  $0.00 |  $1.14 |  $22.24 |
| Firestore · document operations  |  $0.00 |  $0.00 |  $0.00 |  $1.26 |  $21.53 |
| GitHub Pages or Vercel Hobby     |  $0.00 |  $0.00 |  $0.00 |  $0.00 |   $0.00 |
| Vercel Pro · alternative host    | $20.00 | $20.00 | $20.00 | $20.00 |  $20.00 |
| **Total · with Pages or Hobby**  |  $0.00 |  $0.00 |  $0.00 |  $2.88 |  $92.25 |
| **Total · with Vercel Pro**      | $20.00 | $20.00 | $20.00 | $22.88 | $112.25 |

## Workload behind the estimate

- **API.** Assume 100 calls per reviewer per month, 0.2 billed seconds per call, one vCPU and 0.5 GiB of memory in Iowa. Model request-based billing, zero minimum instances, available free allowances and no overlap between requests. At 100,000 reviewers this gives 10 million requests, 2 million vCPU-seconds and 1 million GiB-seconds. [Cloud Run pricing](https://cloud.google.com/run/pricing)
- **Firestore.** Budget 300 document reads, 150 writes, eight ordinary deletes and 2 MiB of outbound data per reviewer per month for a hypothetical larger portfolio. Reads include transactions, snapshots and reconnects. Deletes represent a future cleanup workload. Resetting the delivered board rewrites its document. At 100,000 reviewers this gives 30 million reads, 15 million writes, 800,000 deletes and 195.31 GiB outbound. [Firestore pricing](https://cloud.google.com/firestore/pricing)
- **Billing assumptions.** Spread activity evenly over 30 days. Apply 50,000 free reads, 20,000 writes and 20,000 deletes daily. Model Iowa overages at $0.03, $0.09 and $0.01 per 100,000 operations respectively. Assume storage stays within 1 GiB and budget $0.12/GiB for Americas transfer above 10 GiB per month. The model excludes transaction retries above the stated workload, backups, build and log overages, API network egress and taxes.
- **Static hosting.** Assume five CDN requests and 0.5 MB of assets per reviewer per month. At 100,000 reviewers that is 500,000 requests and 50 GB. Each total includes one hosting choice, with usage within that plan’s allowance. [Vercel pricing](https://vercel.com/pricing) · [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

[Delivered and at scale](../PLANS/0-START/plan.svg) · [Project README](../../README.md#monthly-costs)
