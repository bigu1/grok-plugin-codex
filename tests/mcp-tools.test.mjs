import assert from "node:assert/strict";
import test from "node:test";

import { buildCompanionInvocation, listToolDefinitions } from "../plugins/grok/mcp/server.mjs";

test("listToolDefinitions exposes every Grok capability as a Codex tool", () => {
  const names = listToolDefinitions().map((tool) => tool.name).sort();

  assert.deepEqual(names, [
    "grok_adversarial_review",
    "grok_cancel",
    "grok_image",
    "grok_rescue",
    "grok_result",
    "grok_review",
    "grok_setup",
    "grok_status",
    "grok_transfer",
    "grok_video"
  ]);
});

test("buildCompanionInvocation maps review arguments to the companion runtime", () => {
  const invocation = buildCompanionInvocation("grok_review", {
    background: true,
    base: "main",
    scope: "branch",
    focus: "auth and race conditions"
  });

  assert.equal(invocation.command, "review");
  assert.deepEqual(invocation.args, [
    "review",
    "--background",
    "--base",
    "main",
    "--scope",
    "branch",
    "auth and race conditions"
  ]);
});

test("buildCompanionInvocation maps rescue aliases and flags", () => {
  const invocation = buildCompanionInvocation("grok_rescue", {
    prompt: "fix flaky tests",
    model: "deep",
    effort: "high",
    worktree: true,
    check: true,
    bestOfN: 3,
    resume: true
  });

  assert.equal(invocation.command, "task");
  assert.deepEqual(invocation.args, [
    "task",
    "--resume-last",
    "--model",
    "deep",
    "--effort",
    "high",
    "--worktree",
    "--check",
    "--best-of-n",
    "3",
    "fix flaky tests"
  ]);
});
