---
name: grok-routing
description: When Codex should delegate to Grok vs handle work itself
user-invocable: false
---

# When to call Grok

## Prefer Grok MCP tools

- Substantial debugging after Codex is stuck
- Second-opinion implementation of a non-trivial change
- Best-of-N alternative approaches (`--best-of-n`)
- Risky edits that should land in a worktree (`--worktree`)
- Image/video generation (`grok_image`, `grok_video`)
- Structured or adversarial code review before shipping
- Long-running investigation better as a background job

## Prefer staying in Codex

- Quick questions, renames, one-line fixes
- Tiny edits with obvious answers
- Pure conversation / planning without repo mutation

## Parallel jobs

When workstreams are independent, **run multiple Grok jobs at once**:

| Need | Agent / command |
| --- | --- |
| Fix / investigate | `grok_rescue` |
| Review | `grok_review` |
| Challenge design | `grok_adversarial_review` |
| Image / video | `grok_image` / `grok_video` |

How:

1. Split into independent prompts.
2. Start each Grok MCP tool with `background: true` when it may take time.
3. Track each job id via `grok_status`.
4. Collect results with `grok_result`.

Do **not** serialize independent Grok work just because another job is running.

## Tool map

| Need | Command |
| --- | --- |
| Setup | `grok_setup` |
| Fix / investigate | `grok_rescue` |
| Review | `grok_review` |
| Challenge design | `grok_adversarial_review` |
| Image | `grok_image` |
| Video | `grok_video` |
| Progress | `grok_status` |
| Output | `grok_result` |
| Cancel | `grok_cancel` |
| Handoff context | `grok_transfer` |
