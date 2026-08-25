import assert from "node:assert/strict";
import test from "node:test";

import {
  classifySandboxProbe,
  flagsToCapabilities,
  parseHelpFlags,
  unsupportedCliFlags
} from "../plugins/grok/scripts/lib/cli-capabilities.mjs";
import { detectCliCapabilities } from "../plugins/grok/scripts/lib/cli-capabilities.mjs";

test("parseHelpFlags extracts long options", () => {
  const flags = parseHelpFlags(`
      --sandbox <PROFILE>
      --always-approve
      --disallowed-tools <TOOLS>
      --worktree
  `);
  assert.ok(flags.has("--sandbox"));
  assert.ok(flags.has("--always-approve"));
  assert.ok(flags.has("--disallowed-tools"));
  assert.ok(!flags.has("--check"));
});

test("flagsToCapabilities treats yolo alias as yolo support", () => {
  const caps = flagsToCapabilities(new Set(["--always-approve", "--sandbox"]));
  assert.equal(caps.yolo, true);
  assert.equal(caps.check, false);
  assert.equal(caps.bestOfN, false);
  assert.equal(caps.sandbox, true);
});

test("detectCliCapabilities from helpText does not persist and omits dead flags", () => {
  const caps = detectCliCapabilities({
    helpText: "Usage: grok --sandbox --yolo --worktree",
    persist: false
  });
  assert.equal(caps.check, false);
  assert.equal(caps.bestOfN, false);
  assert.equal(caps.sandbox, true);
  assert.deepEqual(caps.unsupported, ["--check", "--best-of-n"]);
});

test("classifySandboxProbe detects custom-missing profiles", () => {
  assert.equal(
    classifySandboxProbe("Custom sandbox profile 'workspace-write' not found"),
    "custom-missing"
  );
  assert.equal(classifySandboxProbe("unexpected argument '--sandbox' found"), "unsupported-flag");
  assert.equal(classifySandboxProbe("Error: Device not configured (os error 6)"), "accepted");
});

test("unsupportedCliFlags lists omitted 0.2-era flags", () => {
  assert.deepEqual(unsupportedCliFlags({ check: false, bestOfN: false }), ["--check", "--best-of-n"]);
  assert.deepEqual(unsupportedCliFlags({ check: true, bestOfN: true }), []);
});
