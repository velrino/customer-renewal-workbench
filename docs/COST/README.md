**TL;DR** — This table estimates the monthly cost of running the Customer Renewal Workbench in USD. Pick a column for the number of active reviewers and read the total for your hosting choice. At 100,000 reviewers, the estimate is $92.25 with GitHub Pages or Vercel Hobby (if eligible), or $112.25 with one Vercel Pro seat. Both totals include the Go API on Cloud Run and Cloud Firestore. [Usage assumptions and pricing sources](../PLANS/0-START/plan.excalidraw)

| Estimated monthly cost (USD)     |      1 |    100 |  1,000 | 10,000 | 100,000 |
| -------------------------------- | -----: | -----: | -----: | -----: | ------: |
| Google Cloud Run · Go API        |  $0.00 |  $0.00 |  $0.00 |  $0.48 |  $48.48 |
| Firestore · storage and transfer |  $0.00 |  $0.00 |  $0.00 |  $1.14 |  $22.24 |
| Firestore · document operations  |  $0.00 |  $0.00 |  $0.00 |  $1.26 |  $21.53 |
| GitHub Pages or Vercel Hobby     |  $0.00 |  $0.00 |  $0.00 |  $0.00 |   $0.00 |
| Vercel Pro · alternative host    | $20.00 | $20.00 | $20.00 | $20.00 |  $20.00 |
| **Total · with Pages or Hobby**  |  $0.00 |  $0.00 |  $0.00 |  $2.88 |  $92.25 |
| **Total · with Vercel Pro**      | $20.00 | $20.00 | $20.00 | $22.88 | $112.25 |
