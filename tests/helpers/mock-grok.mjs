/**
 * Minimal mock Grok CLI binary for finish-path tests.
 * Invoked as: node mock-grok.mjs -p ... --output-format json
 * Writes a fixed JSON success payload to stdout.
 */
import process from "node:process";

const text = process.env.MOCK_GROK_TEXT || "mock-ok";
const sessionId = process.env.MOCK_GROK_SESSION || "00000000-0000-4000-8000-000000000001";

const payload = {
  text,
  stopReason: "end_turn",
  sessionId,
  requestId: "mock-req",
  num_turns: 1,
  usage: {
    input_tokens: 10,
    output_tokens: 5,
    total_tokens: 15,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    reasoning_tokens: 0
  },
  total_cost_usd: 0.0001,
  modelUsage: {
    "mock-model": {
      inputTokens: 10,
      outputTokens: 5,
      cacheReadInputTokens: 0,
      modelCalls: 1,
      costUSD: 0.0001
    }
  }
};

// If --json-schema present, emit structured review
if (process.argv.some((a) => a === "--json-schema")) {
  payload.text = JSON.stringify({
    verdict: "approve",
    summary: "No issues",
    findings: [],
    next_steps: []
  });
}

process.stdout.write(`${JSON.stringify(payload)}\n`);
process.exit(0);
