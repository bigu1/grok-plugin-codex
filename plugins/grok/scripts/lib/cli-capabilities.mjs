import fs from "node:fs";
import path from "node:path";

import { resolvePluginStateRoot } from "./jobs.mjs";
import { runCommand } from "./process.mjs";

/** Built-in Grok 1.x sandbox profiles (see user-guide/18-sandbox.md). */
export const BUILTIN_SANDBOX_PROFILES = ["off", "workspace", "devbox", "read-only", "strict"];

const memoryCache = new Map();

export function parseHelpFlags(helpText) {
  const flags = new Set();
  const text = String(helpText ?? "");
  for (const match of text.matchAll(/--[a-z0-9]+(?:-[a-z0-9]+)*/gi)) {
    flags.add(match[0].toLowerCase());
  }
  return flags;
}

export function flagsToCapabilities(flags) {
  const set = flags instanceof Set ? flags : new Set(flags);
  return {
    check: set.has("--check"),
    bestOfN: set.has("--best-of-n"),
    sandbox: set.has("--sandbox"),
    yolo: set.has("--yolo") || set.has("--always-approve"),
    experimentalMemory: set.has("--experimental-memory"),
    noMemory: set.has("--no-memory"),
    worktree: set.has("--worktree"),
    worktreeRef: set.has("--worktree-ref"),
    disallowedTools: set.has("--disallowed-tools"),
    permissionMode: set.has("--permission-mode"),
    builtinSandboxes: [...BUILTIN_SANDBOX_PROFILES]
  };
}

/** Conservative defaults when help text is missing: omit dead 0.2-era flags. */
export const DEFAULT_CAPABILITIES = flagsToCapabilities(
  new Set([
    "--sandbox",
    "--yolo",
    "--always-approve",
    "--worktree",
    "--worktree-ref",
    "--disallowed-tools",
    "--permission-mode"
  ])
);

export function classifySandboxProbe(stderr, stdout = "") {
  const blob = `${stderr}\n${stdout}`;
  if (/Custom sandbox profile/i.test(blob)) {
    return "custom-missing";
  }
  if (/unexpected argument '--sandbox'/i.test(blob)) {
    return "unsupported-flag";
  }
  return "accepted";
}

export function unsupportedCliFlags(capabilities) {
  const out = [];
  if (!capabilities?.check) {
    out.push("--check");
  }
  if (!capabilities?.bestOfN) {
    out.push("--best-of-n");
  }
  return out;
}

function cacheFilePath() {
  return path.join(resolvePluginStateRoot(), "cli-capabilities.json");
}

function readPersistCache() {
  const file = cacheFilePath();
  if (!fs.existsSync(file)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function writePersistCache(store) {
  const file = cacheFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(store, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

/**
 * Inspect Grok CLI help (never `-p`) and return a capability table.
 * @param {{ binary?: string, version?: string, helpText?: string, runCommandFn?: Function, persist?: boolean }} [opts]
 */
export function detectCliCapabilities(opts = {}) {
  const run = opts.runCommandFn || runCommand;
  const binary = opts.binary || null;
  const version = opts.version || null;

  if (!binary && !opts.helpText) {
    return {
      ...DEFAULT_CAPABILITIES,
      available: false,
      binary: null,
      version: null,
      unsupported: unsupportedCliFlags(DEFAULT_CAPABILITIES)
    };
  }

  const cacheKey = `${binary || "grok"}::${version || ""}`;
  if (!opts.helpText && memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey);
  }

  if (!opts.helpText && opts.persist !== false && binary) {
    const persisted = readPersistCache();
    const hit = persisted[cacheKey];
    if (hit && typeof hit === "object") {
      memoryCache.set(cacheKey, hit);
      return hit;
    }
  }

  let helpText = opts.helpText;
  if (!helpText) {
    const result = run(binary, ["--help"], { maxBuffer: 1024 * 1024 });
    helpText = `${result.stdout || ""}\n${result.stderr || ""}`;
  }

  const caps = {
    ...flagsToCapabilities(parseHelpFlags(helpText)),
    available: true,
    binary: binary || null,
    version: version || null
  };
  caps.unsupported = unsupportedCliFlags(caps);

  if (!opts.helpText) {
    memoryCache.set(cacheKey, caps);
    if (opts.persist !== false && binary) {
      const persisted = readPersistCache();
      persisted[cacheKey] = caps;
      try {
        writePersistCache(persisted);
      } catch {
        // cache is best-effort
      }
    }
  }

  return caps;
}

export function clearCliCapabilitiesCache() {
  memoryCache.clear();
}
