import assert from "node:assert/strict";
import test from "node:test";

import { classifySandboxProbe } from "../plugins/grok/scripts/lib/cli-capabilities.mjs";
import { getGrokAvailability } from "../plugins/grok/scripts/lib/grok.mjs";
import { runCommand } from "../plugins/grok/scripts/lib/process.mjs";

function probe(binary, args) {
  return runCommand(binary, args, { maxBuffer: 512 * 1024 });
}

test("live Grok CLI 1.x rejects --check and treats workspace-write as custom", (t) => {
  const availability = getGrokAvailability();
  if (!availability.available) {
    t.skip("grok CLI not installed");
    return;
  }

  const check = probe(availability.binary, ["--check"]);
  const checkBlob = `${check.stderr || ""}\n${check.stdout || ""}`;
  assert.match(checkBlob, /unexpected argument '--check'/i);

  const bestOfN = probe(availability.binary, ["--best-of-n", "2"]);
  const bestBlob = `${bestOfN.stderr || ""}\n${bestOfN.stdout || ""}`;
  assert.match(bestBlob, /unexpected argument '--best-of-n'/i);

  const alias = probe(availability.binary, ["--sandbox", "workspace-write"]);
  assert.equal(classifySandboxProbe(alias.stderr, alias.stdout), "custom-missing");

  const workspace = probe(availability.binary, ["--sandbox", "workspace"]);
  assert.notEqual(classifySandboxProbe(workspace.stderr, workspace.stdout), "custom-missing");
});
