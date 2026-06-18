# Graceful errors — typed decode failures + recovery UI

> **Status:** ✅ Done — completed 2026-06-18

## Parent

[portablemd v1 — PRD](./PRD.md)

## What to build

The decode path never white-screens — it explains. The most likely real-world failure is a Link **truncated** when pasted into chat/email, so the error copy leads with that.

- Add **typed decode errors** to `core` that distinguish corrupt/truncated from unknown/newer-version.
- In the Viewer:
  - corrupt/truncated → a friendly state leading with the truncation explanation ("long links sometimes get cut off when pasted…") plus a **New Document** action;
  - unknown version tag → a "made with a newer version" message;
  - empty fragment → continues to the Editor (per issue-02/12).

## Acceptance criteria

- [x] `core` `decode` throws distinct typed errors for corrupt/truncated vs unknown-version.
- [x] A corrupted/truncated fragment shows the truncation-led error with a New Document action — no white screen, no console-only failure.
- [x] An unknown version tag shows the "newer version" message.
- [x] Behaviour tests cover each failure input → expected user-facing state.

## Blocked by

- [issue-01 — Walking skeleton](./issue-01-walking-skeleton.md)
