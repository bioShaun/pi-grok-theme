# Domain Docs

How engineering skills should consume this repository's domain documentation.

## Before exploring, read these

- `CONTEXT.md` at the repository root, or
- `CONTEXT-MAP.md` at the repository root if it exists, followed by each relevant context document
- relevant ADRs under `docs/adr/`

If these files do not exist, proceed silently. Do not create empty placeholders. The domain-modeling workflow creates them when terminology or architectural decisions need to be recorded.

## Layout

This is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/adr/
└── source files
```

## Use the glossary's vocabulary

When an issue title, design proposal, test, or implementation names a domain concept, use the term defined in `CONTEXT.md`. Avoid synonyms that the glossary explicitly rejects.

If a required concept is absent, reconsider whether the term belongs in the project or record the gap for domain modeling.

## Flag ADR conflicts

If proposed work contradicts an existing ADR, identify the conflict explicitly rather than silently overriding the decision.
