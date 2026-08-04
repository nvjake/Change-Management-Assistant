# Chewy Change Activation Assistant

A small internal prototype that turns one `.docx` project brief into an editable, right-sized change activation plan. Version one is deterministic and local: the selected document is read inside the browser, and nothing is uploaded or retained.

## What it does

- Reads paragraph text from one Word document.
- Prefills a six-part change intake and asks the user to confirm gaps.
- Classifies primary and secondary change type, recommends an XS–XL path, and surfaces risk/readiness signals.
- Creates nine editable activation-plan sections with visible source grounding.
- Checks key Chewy writing conventions and flags items that still need human review.
- Downloads the edited plan as a plain-text working draft.

## Run locally

Use the bundled project runtime, install dependencies, and run the development command:

```text
pnpm install
pnpm build
pnpm start
```

Then open the local address shown in the terminal. The local launcher includes a Windows-safe static-asset layer so the upload controls hydrate correctly. No credentials, API keys, or external services are required.

## Tests and build

```text
pnpm test
pnpm build
```

## Source hierarchy

1. `reference-materials/change-navigator-instructions.txt` and Decision Mapping Logic v1 control routing, sizing, escalation, and human-judgment flags.
2. The Change Navigation Strategic Framework supplies the strategic structure.
3. Functional Impact, Risk/Readiness, and Echo guardrails supply reusable operating rules.
4. Cai, Genesys, Rx/VD, and medium-change files are examples only. Their names, owners, dates, and channels are not treated as universal policy.
5. `brand-assets` controls mechanics, voice, and Smart Brevity structure. It does not override risk or governance logic.

The medium-change lead times are deliberately labeled **Suggested—confirm with Communications**.

## Privacy and limitations

- Files remain in browser memory and are cleared on refresh or with the Clear button.
- The prototype has no login, database, telemetry, email, SharePoint, or Teams integration.
- Extraction is heuristic; users must review prefilled fields.
- Outputs are decision support, not approval. Sensitive people, AI, legal, privacy, external, and reputation topics require the appropriate human reviewers.
- The custom GPT link is not called. Its supplied instructions and knowledge materials are represented as local, inspectable rules.

## Future AI integration

If an approved API connection is added later, keep the current classification and governance layer deterministic. Send only the minimum sanitized intake fields needed for drafting, require enterprise-approved credentials and retention settings, and return generated content for human review before any communication is shared.
