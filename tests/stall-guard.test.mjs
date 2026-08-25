import assert from "node:assert/strict";
import test from "node:test";

import {
  EXECUTION_DRIFT_MESSAGE,
  applyStreamEventToStallGuard,
  buildGrokBackgroundWrapperSource,
  createStallGuardState,
  getStallGuardHelperSource,
  isMutatingToolName
} from "../plugins/grok/scripts/lib/grok.mjs";

test("isMutatingToolName covers old and new write tools", () => {
  assert.equal(isMutatingToolName("write"), true);
  assert.equal(isMutatingToolName("search_replace"), true);
  assert.equal(isMutatingToolName("write_file"), true);
  assert.equal(isMutatingToolName("read_file"), false);
  assert.equal(isMutatingToolName("run_terminal_command"), false);
});

test("stall guard aborts after usage limit with only reads", () => {
  let state = createStallGuardState({ enabled: true, limit: 3 });
  for (let i = 0; i < 2; i += 1) {
    state = applyStreamEventToStallGuard(state, {
      type: "tool_call",
      toolName: "read_file"
    });
    state = applyStreamEventToStallGuard(state, { type: "usage" });
    assert.equal(state.abort, false);
  }
  state = applyStreamEventToStallGuard(state, { type: "thought", data: "planning" });
  state = applyStreamEventToStallGuard(state, { type: "usage" });
  assert.equal(state.abort, true);
  assert.equal(state.mutatingToolSeen, false);
  assert.equal(state.usageWithoutMutating, 3);
});

test("stall guard does not abort after a mutating tool", () => {
  let state = createStallGuardState({ enabled: true, limit: 2 });
  state = applyStreamEventToStallGuard(state, {
    type: "tool_call",
    toolName: "read_file"
  });
  state = applyStreamEventToStallGuard(state, { type: "usage" });
  state = applyStreamEventToStallGuard(state, {
    type: "tool_call",
    toolName: "search_replace"
  });
  state = applyStreamEventToStallGuard(state, { type: "usage" });
  state = applyStreamEventToStallGuard(state, { type: "usage" });
  state = applyStreamEventToStallGuard(state, { type: "usage" });
  assert.equal(state.abort, false);
  assert.equal(state.mutatingToolSeen, true);
});

test("background wrapper embeds stall-guard helpers", () => {
  const source = buildGrokBackgroundWrapperSource({
    binary: "grok",
    args: ["-p", "hi"],
    resultFile: "/tmp/x.result.json",
    streaming: true,
    stallGuard: { enabled: true, limit: 8 }
  });
  assert.match(source, /applyStreamEventToStallGuard/);
  assert.match(source, /createStallGuardState/);
  assert.ok(source.includes(getStallGuardHelperSource().slice(0, 40)));
  assert.match(source, new RegExp(EXECUTION_DRIFT_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
