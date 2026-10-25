# AGENTS.md

## Session Start

Before any work, read `.agents/memory/MEMORY.md` and `.agents/memory/$(date -u +%Y-%m-%d).md`. Create missing files or the `.agents/memory/` directory if needed; never overwrite existing memory.

- `MEMORY.md` — durable project facts.
- `YYYY-MM-DD.md` — daily task notes (UTC dates). Use for checklists and completed implementation notes.
- For substantial work needing durable documentation, create `docs/YYYY-MM-DD-task-name/` instead.

## Repository Behavior

- Update project-scoped documents in the same change if behavior they describe is affected.

## Artifact Quality

- Every artifact must be complete, actionable, internally consistent, and specific enough to verify.
- No placeholders, TODOs, unsupported claims, or missing required sections unless the user requests a draft.
- Every section and example must contribute to the outcome. Remove anything that does not.
- Examples must be narrow, direct, complete, and consistent with actual repo interfaces.
- Self-review every non-trivial artifact for placeholders, contradictions, scope drift, and missing verification. Fix issues before presenting.
