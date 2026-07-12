function escapeCell(value) {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ")
    .trim();
}

function short(value, max = 80) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
}

function formatLineRange(finding) {
  if (!finding.line_start) {
    return "";
  }
  if (!finding.line_end || finding.line_end === finding.line_start) {
    return `:${finding.line_start}`;
  }
  return `:${finding.line_start}-${finding.line_end}`;
}

export function renderSetupReport(payload) {
  const lines = ["# Grok setup", ""];
  lines.push(`- **CLI**: ${payload.available ? "found" : "missing"}`);
  if (payload.binary) {
    lines.push(`- **Binary**: \`${payload.binary}\``);
  }
  if (payload.version) {
    lines.push(`- **Version**: ${payload.version}`);
  }
  lines.push(`- **Auth**: ${payload.authenticated ? "ok" : "not ready"}`);
  if (payload.authDetail) {
    lines.push(`- **Auth detail**: ${payload.authDetail}`);
  }
  if (payload.ready) {
    lines.push(
      "",
      "Grok is ready for `grok_rescue`, `grok_review`, `grok_image`, and `grok_video`.",
      "Background jobs can run in parallel. Use `grok_status`, `grok_result`, and `grok_cancel` with explicit job ids."
    );
  } else {
    lines.push("", "## Next steps");
    for (const step of payload.nextSteps ?? []) {
      lines.push(`- ${step}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function renderStructuredReview(payload) {
  const review = payload.review;
  const lines = [];
  lines.push(`# Grok ${payload.kind || "review"} result`);
  lines.push("");
  lines.push(`- **Job**: \`${payload.jobId}\``);
  lines.push(`- **Status**: ${payload.status}`);
  lines.push(`- **Verdict**: ${review.verdict}`);
  if (payload.model) {
    lines.push(`- **Model**: ${payload.model}`);
  }
  if (payload.grokSessionId) {
    lines.push(`- **Grok session**: \`${payload.grokSessionId}\``);
  }
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(review.summary);
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  if (!review.findings.length) {
    lines.push("_No findings._");
  } else {
    for (const finding of review.findings) {
      lines.push(
        `### [${finding.severity}] ${finding.title}`,
        "",
        `- **File**: \`${finding.file}${formatLineRange(finding)}\``,
        "",
        finding.body
      );
      if (finding.recommendation) {
        lines.push("", `**Recommendation:** ${finding.recommendation}`);
      }
      lines.push("");
    }
  }
  if (review.next_steps?.length) {
    lines.push("## Next steps", "");
    for (const step of review.next_steps) {
      lines.push(`- ${step}`);
    }
    lines.push("");
  }
  lines.push("## Follow-ups", "", `- \`grok_status jobId="${payload.jobId}"\``, `- \`grok_result jobId="${payload.jobId}"\``);
  return `${lines.join("\n")}\n`;
}

export function renderTaskResult(payload) {
  if (payload.review) {
    return renderStructuredReview(payload);
  }

  const lines = [];
  lines.push(`# Grok ${payload.kind || "task"} result`);
  lines.push("");
  lines.push(`- **Job**: \`${payload.jobId}\``);
  lines.push(`- **Status**: ${payload.status}`);
  if (payload.model) {
    lines.push(`- **Model**: ${payload.model}`);
  }
  if (payload.bestOfN) {
    lines.push(`- **Best-of-N**: ${payload.bestOfN}`);
  }
  if (payload.worktree) {
    lines.push(`- **Worktree**: enabled`);
  }
  if (payload.check) {
    lines.push(`- **Self-check**: enabled`);
  }
  if (payload.grokSessionId) {
    lines.push(`- **Grok session**: \`${payload.grokSessionId}\``);
    lines.push(`- **Resume in Grok TUI**: \`grok --resume ${payload.grokSessionId}\``);
  }
  if (payload.kind === "image" || payload.kind === "video") {
    lines.push("- **Mode**: media generation (default tools + denylist; companion copies into `.grok-media/`)");
    if (payload.mediaDir) {
      lines.push(`- **Output dir**: \`${payload.mediaDir}\``);
    }
  } else if (payload.write) {
    lines.push("- **Mode**: write-capable (`--yolo`)");
  } else {
    lines.push("- **Mode**: read-only (denylist)");
  }
  if (payload.artifacts?.length) {
    lines.push("");
    lines.push("## Artifacts");
    lines.push("");
    for (const artifact of payload.artifacts) {
      lines.push(`- \`${artifact}\``);
    }
  }
  lines.push("");
  lines.push("## Output");
  lines.push("");
  lines.push(payload.text || payload.error || "(empty)");
  if (payload.error && payload.text) {
    lines.push("", "## Error", "", payload.error);
  }
  lines.push("");
  lines.push("## Follow-ups");
  lines.push("");
  lines.push(`- \`grok_status jobId="${payload.jobId}"\``);
  lines.push(`- \`grok_result jobId="${payload.jobId}"\``);
  if (payload.grokSessionId && payload.kind === "task") {
    lines.push(`- \`grok_rescue resume=true prompt="continue from this session"\``);
  }
  return `${lines.join("\n")}\n`;
}

export function renderBackgroundStarted(payload) {
  const lines = [
    `# Grok ${payload.kind || "task"} started in background`,
    "",
    `- **Job**: \`${payload.jobId}\``,
    `- **PID**: ${payload.pid ?? "n/a"}`,
    `- **Title**: ${payload.title || "(untitled)"}`,
    `- **Concurrent jobs**: allowed (multiple Grok processes may run in parallel)`
  ];
  if (payload.otherRunning?.length) {
    lines.push(`- **Also running**: ${payload.otherRunning.length}`);
    for (const other of payload.otherRunning) {
      lines.push(`  - \`${other.id}\` (${other.kind || "job"}): ${short(other.title || "", 50)}`);
    }
  }
  lines.push(
    "",
    "Check progress with:",
    "",
    `- \`grok_status jobId="${payload.jobId}"\``,
    `- \`grok_result jobId="${payload.jobId}"\``,
    `- \`grok_cancel jobId="${payload.jobId}"\``
  );
  return `${lines.join("\n")}\n`;
}

export function renderStatusReport(jobs, options = {}) {
  if (!jobs.length) {
    return "No Grok jobs recorded for this repository yet.\n";
  }

  if (options.jobId) {
    const job = jobs[0];
    const lines = [
      `# Job ${job.id}`,
      "",
      `- **Kind**: ${job.kind || "task"}`,
      `- **Status**: ${job.status}`,
      `- **Title**: ${job.title || ""}`,
      `- **Created**: ${job.createdAt || ""}`,
      `- **Updated**: ${job.updatedAt || ""}`
    ];
    if (job.finishedAt) {
      lines.push(`- **Finished**: ${job.finishedAt}`);
    }
    if (job.pid) {
      lines.push(`- **PID**: ${job.pid}`);
    }
    if (job.alive != null) {
      lines.push(`- **Process alive**: ${job.alive ? "yes" : "no"}`);
    }
    if (job.progress?.phase) {
      lines.push(`- **Phase**: ${job.progress.phase}`);
    }
    if (job.progress?.message) {
      lines.push(`- **Progress**: ${job.progress.message}`);
    }
    if (job.grokSessionId) {
      lines.push(`- **Grok session**: \`${job.grokSessionId}\``);
    }
    if (job.summary) {
      lines.push(`- **Summary**: ${job.summary}`);
    }
    if (job.error) {
      lines.push(`- **Error**: ${job.error}`);
    }
    if (job.logFile) {
      lines.push(`- **Log**: \`${job.logFile}\``);
    }
    if (job.logTail?.length) {
      lines.push("", "## Recent log", "", "```", ...job.logTail, "```");
    }
    lines.push("", "Follow-ups:", "", `- \`grok_result jobId="${job.id}"\``, `- \`grok_cancel jobId="${job.id}"\``);
    return `${lines.join("\n")}\n`;
  }

  const runningCount = jobs.filter((job) => job.status === "running").length;
  const lines = [];
  if (runningCount > 1 || options.concurrent) {
    lines.push(
      `# Grok jobs (${runningCount} running in parallel)`,
      "",
      "Multiple jobs can run at once. Pass a job id to `grok_result` and `grok_cancel` when more than one is running.",
      ""
    );
  }
  lines.push("| Job | Kind | Status | Progress | Summary |", "| --- | --- | --- | --- | --- |");
  for (const job of jobs) {
    const progress =
      job.status === "running"
        ? short(job.progress?.message || job.progress?.phase || "running", 40)
        : "—";
    lines.push(
      `| \`${escapeCell(job.id)}\` | ${escapeCell(job.kind || "task")} | ${escapeCell(job.status)} | ${escapeCell(progress)} | ${escapeCell(short(job.summary || job.title || ""))} |`
    );
  }
  lines.push("", "Use `grok_status` or `grok_result` with a job id for details.");
  return `${lines.join("\n")}\n`;
}

export function renderStoredJobResult(job) {
  if (!job) {
    return "No job found.\n";
  }

  if (job.status === "running") {
    const lines = [
      `# Job ${job.id} is still running`,
      "",
      `- **Title**: ${job.title || ""}`,
      `- **PID**: ${job.pid ?? "n/a"}`
    ];
    if (job.progress?.message) {
      lines.push(`- **Progress**: ${job.progress.message}`);
    }
    if (job.logTail?.length) {
      lines.push("", "## Recent log", "", "```", ...job.logTail, "```");
    }
    lines.push("", "Wait a bit, then retry `grok_result`, or check `grok_status`.", "");
    return lines.join("\n");
  }

  return renderTaskResult({
    jobId: job.id,
    kind: job.kind,
    status: job.status,
    model: job.model,
    grokSessionId: job.grokSessionId,
    write: job.write,
    text: job.resultText || job.summary || "",
    error: job.error || null,
    review: job.review || null,
    artifacts: job.artifacts || null,
    bestOfN: job.bestOfN,
    worktree: job.worktree,
    check: job.check
  });
}

export function renderCancelReport(job, killed) {
  return [
    `# Cancel ${job.id}`,
    "",
    `- **Previous status**: ${job.status}`,
    `- **Signal sent**: ${killed ? "yes" : "no (process already stopped)"}`,
    `- **New status**: cancelled`,
    ""
  ].join("\n");
}

export function renderTransferReport(payload) {
  const lines = ["# Transfer Codex context to Grok", ""];
  if (payload.sessionPath) {
    lines.push(`- **Codex context source**: \`${payload.sessionPath}\``);
  }
  if (payload.importCommand) {
    lines.push(`- **Suggested import**: \`${payload.importCommand}\``);
  }
  if (payload.resumeCommand) {
    lines.push(`- **Then resume**: \`${payload.resumeCommand}\``);
  }
  if (payload.notes?.length) {
    lines.push("", "## Notes", "");
    for (const note of payload.notes) {
      lines.push(`- ${note}`);
    }
  }
  if (payload.error) {
    lines.push("", `**Error:** ${payload.error}`);
  }
  lines.push("");
  return lines.join("\n");
}
