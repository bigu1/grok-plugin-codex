# Grok in Codex

Use Grok from inside Codex for code reviews, delegated coding tasks, background investigations, image generation, and video generation.

Codex stays the orchestrator. This plugin exposes a small MCP server that calls the local Grok CLI through a shared companion runtime.

Using Claude Code instead? Use the sibling plugin: [grok-in-claude](https://github.com/stdevMac/grok-in-claude).

## What You Get

| Codex tool | Purpose |
| --- | --- |
| `grok_setup` | Check Grok CLI and authentication |
| `grok_rescue` | Delegate investigation or fixes; write-capable by default |
| `grok_review` | Structured read-only review of a tree, branch, or PR |
| `grok_adversarial_review` | Challenge design, tradeoffs, and assumptions |
| `grok_image` | Generate or edit images into `.grok-media/image/` |
| `grok_video` | Generate short videos into `.grok-media/video/` |
| `grok_status` | Show active and recent Grok jobs |
| `grok_result` | Read final stored output for a job |
| `grok_cancel` | Cancel a background job |
| `grok_transfer` | Build context-transfer guidance for Grok |

Skills included:

- `grok-routing` for deciding when to delegate
- `grok-cli-runtime` for companion runtime rules
- `grok-prompting` for strong rescue prompts
- `grok-brand-media` for image/video recipes

## Requirements

- Node.js 18.18 or later
- Grok CLI on your `PATH`
- Grok authentication via `grok login`
- GitHub CLI (`gh`) only for `grok_review` with pull requests

Typical Grok CLI locations:

```bash
~/.grok/bin/grok
~/.local/bin/grok
```

## Install

From GitHub:

```bash
codex plugin marketplace add stdevMac/grok-in-codex
codex plugin add grok@grok-in-codex
```

Then start a new Codex thread so the plugin skills and MCP tools are loaded.

## Install Locally

From this repository:

```bash
codex plugin marketplace add /path/to/grok-in-codex/.agents/plugins
codex plugin add grok@grok-in-codex
```

Then start a new Codex thread so the plugin skills and MCP tools are loaded.

Run setup:

```bash
node plugins/grok/scripts/grok-companion.mjs setup
```

Or ask Codex to call `grok_setup`.

## Quick Start

Ask Codex naturally:

```text
Ask Grok to review this branch against main.
Use Grok to investigate why the auth tests are flaky.
Start a background Grok rescue job for the retry redesign.
Generate a 16:9 launch banner with Grok.
Show Grok job status.
```

Direct MCP tool examples:

```text
grok_review base=main focus="auth, data loss, and race conditions"
grok_rescue prompt="investigate why npm test is failing" background=true
grok_status
grok_result jobId="task-abc123"
grok_image aspect="16:9" prompt="Dark developer-tool launch banner for Grok in Codex"
grok_video image="./.grok-media/image/hero.png" duration="6" prompt="gentle camera push-in"
```

## Usage Notes

### Rescue

`grok_rescue` is write-capable by default. Use `readOnly: true` for diagnosis only, and `worktree: true` for risky edits.

Useful options:

- `background: true` for long-running work
- `model: "fast"` for quick passes
- `model: "deep", effort: "high"` for harder problems
- `worktree: true` to isolate edits
- `check: true` to ask Grok to verify before returning
- `bestOfN: 3` to run parallel attempts and select the best
- `resume: true`, `resumeSession`, or `fresh` for session control

### Review

`grok_review` is read-only and returns structured findings when parsing succeeds.

Examples:

```text
grok_review
grok_review base=main
grok_review pr=123 focus="security and data-loss risks"
grok_adversarial_review focus="challenge this caching design"
```

### Media

Images and videos are copied into project-local output folders:

```text
.grok-media/image/
.grok-media/video/
```

Examples:

```text
grok_image aspect="1:1" prompt="Simple geometric app icon, no text"
grok_image edit="./assets/logo.png" prompt="Make it monochrome with tighter padding"
grok_video refs=["shot1.png","shot2.png"] aspect="16:9" duration="6" prompt="product launch cutdown"
```

Video resolution is limited by the Grok model tier, commonly 480p.

### Job Control

Background jobs can run concurrently. Use explicit job ids when more than one job is active.

```text
grok_status
grok_status jobId="task-abc123"
grok_result jobId="task-abc123"
grok_cancel jobId="task-abc123"
```

## How It Works

```text
Codex
  -> Grok MCP tool
    -> node plugins/grok/mcp/server.mjs
      -> node plugins/grok/scripts/grok-companion.mjs <command>
        -> grok -p ... --output-format json|streaming-json
```

Job metadata is stored under:

```text
~/.grok/codex-plugin/state/<repo-slug-hash>/
```

Set `CODEX_PLUGIN_DATA` to override the plugin data directory when running in custom environments.

## Security

- `grok_rescue` defaults to full tool auto-approval through Grok CLI write mode.
- Use `readOnly: true` when you only want analysis.
- Use `worktree: true` for higher-risk changes.
- Reviews are read-only.
- Media commands write under `.grok-media/` and Grok session folders.

## Development

```bash
npm test
node plugins/grok/scripts/grok-companion.mjs setup
node plugins/grok/scripts/grok-companion.mjs review --base main
node plugins/grok/scripts/grok-companion.mjs task --worktree --check "fix the failing test"
node plugins/grok/mcp/server.mjs
```
