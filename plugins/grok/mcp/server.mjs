#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const SERVER_VERSION = "0.1.0";
const TOOL_PREFIX = "grok_";
const ROOT_DIR = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const COMPANION = path.join(ROOT_DIR, "scripts", "grok-companion.mjs");

const stringSchema = (description) => ({ type: "string", description });
const booleanSchema = (description) => ({ type: "boolean", description });
const integerSchema = (description, minimum = 1) => ({ type: "integer", minimum, description });

const TOOL_DEFINITIONS = [
  {
    name: "grok_setup",
    description: "Check Grok CLI availability and authentication.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enableReviewGate: booleanSchema("Enable the optional stop review gate."),
        disableReviewGate: booleanSchema("Disable the optional stop review gate."),
        json: booleanSchema("Return machine-readable JSON from the companion.")
      }
    }
  },
  {
    name: "grok_rescue",
    description: "Delegate investigation, implementation, or fixes to Grok. Write-capable by default.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["prompt"],
      properties: {
        prompt: stringSchema("The task for Grok to investigate, implement, or fix."),
        background: booleanSchema("Start a background job and return the job id."),
        readOnly: booleanSchema("Prevent source edits by running Grok in read-only mode."),
        resume: booleanSchema("Resume the latest Grok task session for this repository."),
        resumeSession: stringSchema("Resume a specific Grok session id."),
        fresh: booleanSchema("Start a fresh Grok session."),
        model: stringSchema("Grok model id or alias, such as fast or deep."),
        effort: stringSchema("Reasoning effort: none, minimal, low, medium, high, xhigh, or max."),
        worktree: booleanSchema("Run edits in a Grok-managed git worktree."),
        worktreeName: stringSchema("Name for a Grok-managed git worktree."),
        worktreeRef: stringSchema("Base ref for the Grok worktree."),
        check: booleanSchema("Ask Grok to verify its own work before returning."),
        bestOfN: integerSchema("Run N parallel attempts of the same task and keep the best."),
        maxTurns: integerSchema("Maximum Grok turns for this task."),
        verbatim: booleanSchema("Avoid adding extra wrapper instructions to the prompt."),
        json: booleanSchema("Return machine-readable JSON from the companion.")
      }
    }
  },
  {
    name: "grok_review",
    description: "Run a structured read-only Grok review of the working tree, branch, or PR.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        focus: stringSchema("Optional review focus, such as auth, race conditions, or data loss."),
        background: booleanSchema("Start a background review and return the job id."),
        base: stringSchema("Base git ref for branch review."),
        scope: stringSchema("Review scope: auto, working-tree, or branch."),
        pr: stringSchema("GitHub pull request number."),
        model: stringSchema("Grok model id or alias."),
        effort: stringSchema("Reasoning effort."),
        json: booleanSchema("Return machine-readable JSON from the companion.")
      }
    }
  },
  {
    name: "grok_adversarial_review",
    description: "Ask Grok to challenge a design, branch, working tree, or PR for hidden risks.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        focus: stringSchema("Design or implementation assumptions Grok should challenge."),
        background: booleanSchema("Start a background review and return the job id."),
        base: stringSchema("Base git ref for branch review."),
        scope: stringSchema("Review scope: auto, working-tree, or branch."),
        pr: stringSchema("GitHub pull request number."),
        model: stringSchema("Grok model id or alias."),
        effort: stringSchema("Reasoning effort."),
        json: booleanSchema("Return machine-readable JSON from the companion.")
      }
    }
  },
  {
    name: "grok_image",
    description: "Generate or edit an image with Grok and store artifacts under .grok-media/image by default.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        prompt: stringSchema("Image prompt."),
        background: booleanSchema("Start a background image job and return the job id."),
        edit: stringSchema("Path to an image to edit."),
        aspect: stringSchema("Aspect ratio, such as 16:9, 1:1, or 9:16."),
        model: stringSchema("Grok model id or alias."),
        effort: stringSchema("Reasoning effort."),
        out: stringSchema("Output directory, relative to the workspace or absolute."),
        json: booleanSchema("Return machine-readable JSON from the companion.")
      }
    }
  },
  {
    name: "grok_video",
    description: "Generate a short video with Grok and store artifacts under .grok-media/video by default.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        prompt: stringSchema("Video prompt."),
        background: booleanSchema("Start a background video job and return the job id."),
        image: stringSchema("Primary source image path."),
        refs: {
          type: "array",
          items: { type: "string" },
          description: "Additional reference image paths."
        },
        duration: stringSchema("Video duration supported by Grok, commonly 6 or 10."),
        aspect: stringSchema("Aspect ratio, such as 16:9, 1:1, or 9:16."),
        model: stringSchema("Grok model id or alias."),
        effort: stringSchema("Reasoning effort."),
        out: stringSchema("Output directory, relative to the workspace or absolute."),
        json: booleanSchema("Return machine-readable JSON from the companion.")
      }
    }
  },
  {
    name: "grok_status",
    description: "Show active and recent Grok jobs, optionally filtered by job id.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        jobId: stringSchema("Specific job id to inspect."),
        all: booleanSchema("Include older jobs, not only the recent default window."),
        json: booleanSchema("Return machine-readable JSON from the companion.")
      }
    }
  },
  {
    name: "grok_result",
    description: "Read the stored result for a completed Grok job.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        jobId: stringSchema("Specific job id. Omit only when there is one unambiguous recent job."),
        json: booleanSchema("Return machine-readable JSON from the companion.")
      }
    }
  },
  {
    name: "grok_cancel",
    description: "Cancel a running Grok background job.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["jobId"],
      properties: {
        jobId: stringSchema("Job id to cancel."),
        json: booleanSchema("Return machine-readable JSON from the companion.")
      }
    }
  },
  {
    name: "grok_transfer",
    description: "Build guidance for transferring the current Codex context into Grok.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        source: stringSchema("Optional transcript/source path."),
        json: booleanSchema("Return machine-readable JSON from the companion.")
      }
    }
  }
];

const TOOL_MAP = new Map(TOOL_DEFINITIONS.map((tool) => [tool.name, tool]));

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function pushFlag(args, condition, flag) {
  if (condition) {
    args.push(flag);
  }
}

function pushValue(args, value, flag) {
  if (hasValue(value)) {
    args.push(flag, String(value));
  }
}

function appendReviewArgs(args, input) {
  pushFlag(args, input.background, "--background");
  pushValue(args, input.base, "--base");
  pushValue(args, input.scope, "--scope");
  pushValue(args, input.pr, "--pr");
  pushValue(args, input.model, "--model");
  pushValue(args, input.effort, "--effort");
  pushFlag(args, input.json, "--json");
  if (hasValue(input.focus)) {
    args.push(String(input.focus));
  }
}

function appendMediaArgs(args, input, kind) {
  pushFlag(args, input.background, "--background");
  pushValue(args, input.model, "--model");
  pushValue(args, input.effort, "--effort");
  pushValue(args, input.aspect, "--aspect");
  pushValue(args, input.out, "--out");
  if (kind === "image") {
    pushValue(args, input.edit, "--edit");
  } else {
    pushValue(args, input.image, "--image");
    pushValue(args, input.duration, "--duration");
    for (const ref of input.refs || []) {
      pushValue(args, ref, "--ref");
    }
  }
  pushFlag(args, input.json, "--json");
  if (hasValue(input.prompt)) {
    args.push(String(input.prompt));
  }
}

export function listToolDefinitions() {
  return TOOL_DEFINITIONS.map((tool) => ({ ...tool }));
}

export function buildCompanionInvocation(toolName, input = {}) {
  if (!TOOL_MAP.has(toolName)) {
    throw new Error(`Unknown Grok tool: ${toolName}`);
  }

  const args = [];
  let command;

  switch (toolName) {
    case "grok_setup":
      command = "setup";
      args.push(command);
      pushFlag(args, input.enableReviewGate, "--enable-review-gate");
      pushFlag(args, input.disableReviewGate, "--disable-review-gate");
      pushFlag(args, input.json, "--json");
      break;
    case "grok_rescue":
      command = "task";
      args.push(command);
      pushFlag(args, input.background, "--background");
      pushFlag(args, input.readOnly, "--read-only");
      if (input.resumeSession) {
        pushValue(args, input.resumeSession, "--resume-session");
      } else if (input.resume) {
        args.push("--resume-last");
      } else if (input.fresh) {
        args.push("--fresh");
      }
      pushValue(args, input.model, "--model");
      pushValue(args, input.effort, "--effort");
      if (input.worktreeName) {
        pushValue(args, input.worktreeName, "--worktree-name");
      } else {
        pushFlag(args, input.worktree, "--worktree");
      }
      pushValue(args, input.worktreeRef, "--worktree-ref");
      pushFlag(args, input.check, "--check");
      pushValue(args, input.bestOfN, "--best-of-n");
      pushValue(args, input.maxTurns, "--max-turns");
      pushFlag(args, input.verbatim, "--verbatim");
      pushFlag(args, input.json, "--json");
      if (hasValue(input.prompt)) {
        args.push(String(input.prompt));
      }
      break;
    case "grok_review":
      command = "review";
      args.push(command);
      appendReviewArgs(args, input);
      break;
    case "grok_adversarial_review":
      command = "adversarial-review";
      args.push(command);
      appendReviewArgs(args, input);
      break;
    case "grok_image":
      command = "image";
      args.push(command);
      appendMediaArgs(args, input, "image");
      break;
    case "grok_video":
      command = "video";
      args.push(command);
      appendMediaArgs(args, input, "video");
      break;
    case "grok_status":
      command = "status";
      args.push(command);
      pushFlag(args, input.all, "--all");
      pushFlag(args, input.json, "--json");
      if (hasValue(input.jobId)) {
        args.push(String(input.jobId));
      }
      break;
    case "grok_result":
      command = "result";
      args.push(command);
      pushFlag(args, input.json, "--json");
      if (hasValue(input.jobId)) {
        args.push(String(input.jobId));
      }
      break;
    case "grok_cancel":
      command = "cancel";
      args.push(command);
      pushFlag(args, input.json, "--json");
      if (hasValue(input.jobId)) {
        args.push(String(input.jobId));
      }
      break;
    case "grok_transfer":
      command = "transfer";
      args.push(command);
      pushValue(args, input.source, "--source");
      pushFlag(args, input.json, "--json");
      break;
  }

  return { command, args };
}

export function runCompanion(toolName, input = {}) {
  const { args } = buildCompanionInvocation(toolName, input);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [COMPANION, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code, signal) => {
      const text = stdout || stderr || `grok companion exited with code ${code ?? signal}`;
      resolve({
        isError: code !== 0,
        content: [{ type: "text", text }]
      });
    });
  });
}

/**
 * Codex plugin MCP hosts speak newline-delimited JSON over stdio
 * (same framing as bundled plugins such as sites / codex-security).
 * Do not use LSP Content-Length framing — Codex never sends those headers,
 * so tools/list never completes and grok_* tools never appear in the session.
 */
function sendMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handleRequest(message) {
  const id = message.id;
  try {
    switch (message.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: message.params?.protocolVersion || "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: { name: "grok-in-codex", version: SERVER_VERSION }
          }
        };
      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: listToolDefinitions() } };
      case "tools/call": {
        const name = message.params?.name;
        const input = message.params?.arguments || {};
        const result = await runCompanion(name, input);
        return { jsonrpc: "2.0", id, result };
      }
      case "notifications/initialized":
      case "notifications/cancelled":
        return null;
      default:
        // Notifications have no id; do not error-reply to them.
        if (id === undefined || id === null) {
          return null;
        }
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Unknown method: ${message.method}` }
        };
    }
  } catch (error) {
    if (id === undefined || id === null) {
      return null;
    }
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : String(error)
      }
    };
  }
}

function startStdioServer() {
  const lines = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity
  });

  lines.on("line", (line) => {
    if (line.trim().length === 0) {
      return;
    }

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    // Ignore client responses (we do not issue server→client requests yet).
    if (message.method === undefined && message.id !== undefined) {
      return;
    }

    void handleRequest(message).then((response) => {
      if (response) {
        sendMessage(response);
      }
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startStdioServer();
}
