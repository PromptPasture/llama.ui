# AGENTS.md

## Scope

- These instructions apply to every file and directory under `docs/`.
- These instructions govern document writing only.

## Documentation Structure

```text
docs/                          # Project-scoped documentation
├── ARCHITECTURE.md
├── DESIGN.md
├── ROADMAP.md
└── [YYYY-MM-DD-task-name]/    # One folder per task, feature, or epic
    ├── BRAINSTORM.md          # Task-scoped discovery and explored ideas
    ├── PRD.md                 # Product requirements
    ├── SPEC.md                # Technical specification
    ├── ARCHITECTURE.md        # Task-scoped architecture decisions
    ├── DESIGN.md              # UI/UX decisions
    └── TASKS.md               # Actionable checklist
```

- Task folder names MUST use a UTC date prefix and a lowercase, hyphenated task name, such as `2026-06-04-user-auth`, `2026-06-04-payment-v2`, or `2026-06-04-issue-142`.
- You MUST create a task folder only when the work needs durable task-scoped product, technical, architecture, or design documentation.
- Each document shown in a task folder is optional and MUST be created only when it contributes to the task's requested outcome.
- You MUST NOT create a docs task folder only to store a checklist, implementation log, status update, or completed-task summary.
- `TASKS.md` MUST exist only in a task folder that also contains task-scoped product, technical, architecture, or design documentation.

## Before Writing

- Before creating or materially changing documentation, you MUST identify the document's purpose, audience, scope, required inputs, and acceptance criteria.

## Document Requirements

- Every document MUST be complete, actionable, internally consistent, and specific enough to verify.
- You MUST NOT leave unsupported claims, unresolved ambiguity, empty required sections, or contradictory requirements unless the user explicitly requests an incomplete draft.
- Requirements MUST use unambiguous normative language and define observable acceptance criteria.
- Examples MUST be narrow, complete, and consistent with the repository's actual interfaces and conventions.
- Documents MUST use YAML frontmatter for document metadata when metadata is needed.

## Consistency

- You MUST keep requirements, terminology, examples, links, and document status internally consistent across documents changed in the same task.
- You MUST NOT contradict an existing `PRD.md`, `SPEC.md`, `ARCHITECTURE.md`, or `DESIGN.md` without explicitly updating the affected document.
- `TASKS.md` items MUST trace to concrete requirements or deliverables documented in the same task folder.

## Completion Gate

- Before completing documentation work, you MUST self-review every created or materially modified document for placeholders, contradictions, ambiguity, unsupported claims, unnecessary content, scope drift, broken references, and missing verification.
- You MUST fix issues found during self-review before presenting the result.
- You MUST verify changed documentation with the repository's established linting, formatting, link-checking, or validation workflow when available.
