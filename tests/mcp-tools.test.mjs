import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildCompanionInvocation, listToolDefinitions } from "../plugins/grok/mcp/server.mjs";

const SERVER_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../plugins/grok/mcp/server.mjs"
);

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

/**
 * Codex speaks newline-delimited JSON over stdio for plugin MCP servers.
 * Content-Length framing must not be required or emitted.
 */
test("stdio MCP transport speaks NDJSON (Codex framing)", async () => {
  const child = spawn(process.execPath, [SERVER_PATH], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const send = (message) => {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };

  send({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "mcp-tools-test", version: "0.0.0" }
    }
  });
  send({ jsonrpc: "2.0", method: "notifications/initialized" });
  send({ jsonrpc: "2.0", id: 2, method: "tools/list" });

  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const lines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const parsed = [];
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line));
      } catch {
        // incomplete trailing line
      }
    }
    const init = parsed.find((m) => m.id === 1);
    const tools = parsed.find((m) => m.id === 2);
    if (init && tools) {
      child.kill();
      assert.equal(init.result?.serverInfo?.name, "grok-in-codex");
      assert.ok(Array.isArray(tools.result?.tools));
      assert.equal(tools.result.tools.length, 10);
      assert.ok(tools.result.tools.some((t) => t.name === "grok_video"));
      // Must not speak LSP Content-Length framing
      assert.doesNotMatch(stdout, /Content-Length:/i);
      assert.equal(stderr.trim(), "");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  child.kill();
  assert.fail(
    `NDJSON MCP handshake timed out.\nstdout:\n${stdout}\nstderr:\n${stderr}`
  );
});
