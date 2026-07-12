---
name: grok-cli-runtime
description: Internal helper contract for calling the grok-companion runtime from Codex
user-invocable: false
---

# Grok Runtime

Use through the Grok MCP tools. If MCP is unavailable, call the companion directly with `node plugins/grok/scripts/grok-companion.mjs <command> ...`.

## Concurrency

- **Multiple companion jobs may run at once.** There is no global single-agent lock.
- Prefer `background: true` or `--background` when a Codex turn is launching more than one Grok job.
- Each MCP call should make exactly one companion invocation.
- Parallelism = multiple background companion jobs, not a serialized queue.
- When several jobs are running, always pass job ids to `status` / `result` / `cancel`.

## Task (`grok-rescue`)

Primary helper:
- `grok_rescue`
- direct fallback: `node plugins/grok/scripts/grok-companion.mjs task "<args>"`

Rules:
- Exactly one `task` invocation per handoff.
- Return stdout unchanged.
- Map `fast` → `--model grok-composer-2.5-fast`
- Map `deep` → `--model grok-4.5 --effort high`
- `--resume` → `--resume-last` (latest session)
- `--resume-session <id>` → resume that specific Grok session
- `--fresh` → no resume
- Pass `--worktree`, `--check`, `--best-of-n <n>` through when present
- Default write-capable; `--read-only` only when requested
- Do not call setup/status/result/cancel/image/video from the rescue subagent

## Review (`grok-review`)

- `grok_review`
- direct fallback: `node plugins/grok/scripts/grok-companion.mjs review ...`
- or `... adversarial-review ...` for design challenges
- Read-only; never apply patches

## Media (`grok-media`)

- `grok_image`
- `grok_video`
- direct fallback: `node plugins/grok/scripts/grok-companion.mjs image ...`
- direct fallback: `node plugins/grok/scripts/grok-companion.mjs video ...`
