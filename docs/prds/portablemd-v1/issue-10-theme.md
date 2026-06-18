# Dark/light theme

## Parent

[portablemd v1 — PRD](./PRD.md)

## What to build

A comfortable reading theme that respects the reader's environment.

- Default to the system preference (`prefers-color-scheme`), with a **manual toggle persisted** in `localStorage`.
- Apply to both the Viewer and the Editor.
- Ensure code highlighting, Mermaid diagrams, and KaTeX math remain legible in both themes.

## Acceptance criteria

- [ ] First load matches the OS light/dark preference.
- [ ] The manual toggle overrides and persists across reloads.
- [ ] Highlighted code, diagrams, and math are legible in both themes.
- [ ] No flash of the wrong theme on load.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md)
