import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runCommand } from "./process.mjs";

export function findCodexContextSource(cwd, explicitSource) {
  if (explicitSource) {
    const resolved = path.resolve(explicitSource);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Context source not found: ${resolved}`);
    }
    return resolved;
  }

  const history = path.join(os.homedir(), ".codex", "history.jsonl");
  if (fs.existsSync(history)) {
    return history;
  }

  const sessionIndex = path.join(os.homedir(), ".codex", "session_index.jsonl");
  return fs.existsSync(sessionIndex) ? sessionIndex : null;
}

export function buildTransferPlan(cwd, options = {}) {
  const sessionPath = findCodexContextSource(cwd, options.source);
  if (!sessionPath) {
    return {
      ok: false,
      error:
        "No Codex history source found under ~/.codex. Pass --source <path-to.jsonl>.",
      sessionPath: null,
      importCommand: null,
      resumeCommand: null,
      notes: [
        "Codex commonly stores local conversation history in ~/.codex/history.jsonl.",
        "You can also continue work with grok_rescue using resume=true and a focused prompt."
      ]
    };
  }

  // Probe whether grok import exists
  const help = runCommand(options.grokBinary || "grok", ["help"]);
  const helpText = `${help.stdout || ""}\n${help.stderr || ""}`;
  const supportsImport = /\bimport\b/i.test(helpText);

  const notes = [
    "Transfer is best-effort. Grok import support depends on your CLI version.",
    "After import/resume, continue the work in Grok TUI or with grok_rescue resume=true."
  ];

  if (supportsImport) {
    return {
      ok: true,
      sessionPath,
      importCommand: `grok import "${sessionPath}"`,
      resumeCommand: "grok --continue",
      notes
    };
  }

  return {
    ok: true,
    sessionPath,
    importCommand: null,
    resumeCommand: null,
    notes: [
      ...notes,
      "This Grok CLI does not expose a documented `import` subcommand in `grok help`.",
      "Open the context source above and summarize the relevant lines into grok_rescue, or upgrade Grok and retry."
    ]
  };
}
