---
name: renewal-workflow
description: Verify a renewal workbench change against its evidence, two-slot capacity, and persistence rules. Use during feature validation or submission review.
---

# Verify the renewal workflow

Follow the [reviewer walkthrough](../../../README.md#reviewer-walkthrough) in a fresh synthetic demo session. Keep that session across reloads. Use two independent browser contexts. In Local mode, verify that saved work stays private to each browser. In API mode, verify that both see the same changes without reloading and that a confirmed reset restores the sample portfolio in both. Use the Firestore emulator for shared reset checks.

For each step, record the expected outcome, observed outcome, and evidence. Identify the environment (public deployment or local build) and the version or URL tested. For simultaneous saves, record both responses and the final persisted count.

When validating environment selection, start the [local emulator setup](../../../backend/api/README.md#shared-workbench). Select Shared API and reload to check that the preference survives. Make the local API unavailable while a shared editor is open. Verify that the draft stays attached to Shared API and a failed save never writes it to IndexedDB. Close the editor to check Local fallback. Restore the API and verify that the saved preference selects Shared API again after a successful health check.

When validating reset, open a shared draft in one browser and confirm the reset in another. Check that the reset request has an empty body, both browsers receive the restored board, and submitting the old revision is rejected. Verify that previously saved Local work is still available in its original profile.

Summarize material findings in impact order and list any paths left unverified. If only the scaffold is available, assess the documented design and leave runtime checks pending.
