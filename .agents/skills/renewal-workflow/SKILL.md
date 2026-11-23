---
name: renewal-workflow
description: Verify a renewal workbench change against its evidence, two-slot capacity, and persistence rules. Use during feature validation or submission review.
---

# Verify the renewal workflow

Follow the [reviewer walkthrough](../../../README.md#reviewer-walkthrough-and-acceptance-checks) in a fresh synthetic demo session. Keep that session across reloads. When checking session isolation, open an independent browser context and verify that a saved intervention from the first session stays private.

For each step, record the expected outcome, observed outcome, and evidence. Identify the environment (public deployment or local build) and the version or URL tested. For simultaneous saves, record both responses and the final persisted count.

Summarize material findings in impact order and list any paths left unverified. If only the scaffold is available, assess the documented design and leave runtime checks pending.
