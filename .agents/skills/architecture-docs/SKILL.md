---
name: architecture-docs
description: Update the workbench architecture diagram, renewal sequence diagrams, and their previews in the README and pull requests. Use when documenting components, data paths, or workflow steps.
---

# Document the architecture and renewal flows

## Architecture overview

Edit the [Excalidraw scene](../../../docs/ARCHITECTURE/architecture.excalidraw) and export its [SVG preview](../../../docs/ARCHITECTURE/architecture.svg). When the user supplies a visual reference, open its editable source and inspect the rendered image. Reuse its typography, icons, panel treatment and spacing. For a small correction, edit the existing scene in place.

Keep one React icon for the dashboard. Place IndexedDB and localStorage directly above it. Center PostHog and Sentry together in the footer under **TELEMETRY**. Use the Firebase logo for the Cloud Firestore node. Prefer horizontal and vertical connectors with labels clear of lines and icons. Check that the direction of each arrow matches the implementation, particularly API writes and snapshots delivered directly to browsers.

## Workflow steps

Use [environment selection](../../../docs/ARCHITECTURE/steps/01-environment/) as the template. Give each flow a numbered folder under `docs/ARCHITECTURE/steps/` containing `README.md`, `SEQUENCE.txt` and `diagram.png`. Describe the outcome in the step README and link the preview and editable Mermaid source.

Draw the sequence as a staircase. Declare the initiator at the top and introduce each following actor with `create participant` immediately before its first incoming message. This places its header and lifeline at first use. Preserve actual request order, concurrency and subscriptions when choosing that first interaction. Label the service **API** in these diagrams. Render the PNG and check that headers descend from left to right and message text clears each newly introduced box.

## README and review

Keep the root README concise, with **Architecture**, **Run locally** and **Renewal flows** in that order. Link each step to its folder, source and full-size preview. When an asset moves, update both the repository links and the open PR description, including any image URL pinned to an older commit.

For a documentation PR, lead with a TL;DR and embed the diagrams so reviewers can inspect them before merging. When publishing by stages, commit and push each completed step with its source, preview and README links together. Follow the requested branch and review instructions.
