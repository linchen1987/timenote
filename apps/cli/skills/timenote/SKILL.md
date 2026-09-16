---
name: timenote
description: Operate the user's TimeNote Desktop notebooks (notes CRUD, search, reveal) through the agent-safe `timenote desktop` CLI. Use when the user asks to read, search, create, update, delete or organize notes/notebooks in TimeNote.
---

# Timenote Desktop for AI Agents

Operate the running TimeNote Desktop app via the local automation API. All
writes are revision-guarded (CAS) — a stale write never silently overwrites
newer content, including the user's unsaved editor drafts.

## Preconditions

- TimeNote Desktop is running on this machine and "Agent 连接" is enabled in its Settings.
- Verify with `timenote desktop status`. Exit code 4 means the Desktop is not
  reachable — tell the user to open the app and enable Agent 连接; never fall
  back to editing vault files directly.

## Workflow

1. **Discover notebooks**: `timenote desktop notebooks list --json`
   Targets are identified by stable `projectId` (e.g. `vXk29fj3Qa`). Never
   guess or use notebook names as write targets.
2. **Find notes**: `timenote desktop note search --notebook <projectId> --query '<terms>' --json`
   or `timenote desktop note list --notebook <projectId> --json`.
3. **Read before writing**: `timenote desktop note get <noteId> --notebook <projectId> --json`
   returns `revision` plus full body. You MUST carry this revision into updates.
4. **Write with CAS**:
   - create: `timenote desktop note create --notebook <projectId> --file <path> --json`
     (write long content to a temp file; avoid --content for multi-line text)
   - update: `timenote desktop note update <noteId> --notebook <projectId> --file <path> --if-revision <revision> --operation-id <uuid> --json`
   - delete: `timenote desktop note delete <noteId> --notebook <projectId> --if-revision <revision> --operation-id <uuid> --json`
5. **Check results**: JSON stdout only. Success includes the new `revision`.
6. **Show the user**: `timenote desktop note reveal <noteId> --notebook <projectId>`
   (the only operation that focuses the Desktop window).

## Rules

- Generate a fresh `--operation-id` (uuid) per logical write and **reuse it on
  retries**. After a timeout, first run
  `timenote desktop operation get <operationId> --json` — the write may have
  landed; do not blindly re-create notes.
- On `REVISION_CONFLICT` (exit 3): re-read the note, reconcile with the new
  content, retry once with the fresh revision. Do not overwrite blindly.
- On `NOTE_HAS_UNSAVED_CHANGES` (exit 3): the user has the note open with
  unsaved edits. Tell the user; do not retry until they save or close it.
- Exit codes: 0 ok · 2 protocol mismatch · 3 conflict/unsaved · 4 desktop
  unavailable · 5 unauthorized · 6 not found · 7 outcome unknown.
- The Desktop UI updates automatically after each successful write; no need
  to ask the user to refresh.
