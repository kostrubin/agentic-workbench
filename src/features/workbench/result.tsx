"use client";
import { lazy, Suspense } from "react";
const CitedMarkdown = lazy(() => import("./cited-markdown"));
import {
  Check,
  Circle,
  LoaderCircle,
  AlertCircle,
  ArrowUpRight,
  Copy,
  BookmarkPlus,
  RotateCcw,
} from "lucide-react";
import type { Activity, Citation, Run } from "@/lib/types";
export function ActivityList({ activities }: { activities: Activity[] }) {
  return (
    <ol className="timeline">
      {activities.map((item) => (
        <li key={item.id}>
          <span className={"activity-icon " + item.status}>
            {item.status === "running" ? (
              <LoaderCircle size={14} className="spin" />
            ) : item.status === "failed" ? (
              <AlertCircle size={14} />
            ) : (
              <Check size={14} />
            )}
          </span>
          <div>
            <span>{item.label}</span>
            <small>
              {item.tool ?? item.phase}
              {item.detail && ` · ${item.detail}`}
            </small>
          </div>
          <code>
            {item.durationMs !== undefined ? `${item.durationMs} ms` : "…"}
          </code>
        </li>
      ))}
    </ol>
  );
}
export function PhaseRail({ run }: { run: Run }) {
  const phases = [
    ["plan", "Plan"],
    ["retrieve", "Retrieve"],
    ["tools", "Verify"],
    ["synthesize", "Synthesize"],
  ] as const;
  return (
    <div className="phase-rail" aria-label="Execution phases">
      {phases.map(([phase, label], i) => {
        const items = run.activities.filter((a) => a.phase === phase);
        const active = items.some((a) => a.status === "running");
        const failed = items.some((a) => a.status === "failed");
        const done = items.length > 0 && !active;
        return (
          <div
            key={phase}
            className={
              active ? "active" : failed ? "failed" : done ? "done" : ""
            }
          >
            <span>
              {active ? (
                <LoaderCircle size={13} className="spin" />
              ) : failed ? (
                <AlertCircle size={13} />
              ) : done ? (
                <Check size={13} />
              ) : (
                <Circle size={13} />
              )}
            </span>
            <b>{label}</b>
            <small>0{i + 1}</small>
          </div>
        );
      })}
    </div>
  );
}
export function Result({
  run,
  onCitation,
  onRetry,
  onSave,
  onCopy,
  busy,
  saved,
}: {
  run: Run;
  onCitation: (c: Citation) => void;
  onRetry: () => void;
  onSave: () => void;
  onCopy: () => void;
  busy: boolean;
  saved: boolean;
}) {
  return (
    <section className="result-card" aria-label="Research result">
      <div className="result-meta">
        <span className="mini-mark">a</span>
        <strong>Research brief</strong>
        <span className="subtle">
          {run.provider === "demo"
            ? "Deterministic demo"
            : "Provider synthesis"}
        </span>
        <span className={"status-badge " + run.status}>{run.status}</span>
      </div>
      {run.error && (
        <div className="notice danger" role="alert">
          <AlertCircle size={17} />
          <span>{run.error}</span>
        </div>
      )}
      {run.answer ? (
        <div
          className={"prose " + (run.status === "running" ? "streaming" : "")}
        >
          <Suspense fallback={<p>Rendering brief…</p>}>
            <CitedMarkdown
              answer={run.answer}
              citations={run.citations}
              onCitation={onCitation}
            />
          </Suspense>
        </div>
      ) : (
        <div className="synthesis-placeholder">
          {run.status === "running" ? (
            <LoaderCircle size={24} className="spin" />
          ) : (
            <AlertCircle size={24} />
          )}
          <h3>
            {run.status === "running"
              ? "Working through your evidence"
              : "No synthesis yet"}
          </h3>
          <p>
            {run.status === "running"
              ? "Retrieving context and checking the relevant constraints."
              : "Retry this task to start a fresh execution."}
          </p>
        </div>
      )}
      <div className="result-footer">
        <span>
          <span className="live-dot" /> {run.citations.length} cited passages ·{" "}
          {run.contextTokens.toLocaleString()} context tokens
        </span>
        <div>
          <button
            className="text-button"
            disabled={busy || !run.answer}
            onClick={onCopy}
          >
            <Copy size={14} />
            Copy
          </button>
          <button
            className="text-button"
            disabled={busy || run.status !== "completed" || saved}
            onClick={onSave}
          >
            <BookmarkPlus size={14} />
            {saved ? "Saved" : "Save note"}
          </button>
          <button className="text-button" disabled={busy} onClick={onRetry}>
            <RotateCcw size={14} />
            Rerun
          </button>
        </div>
      </div>
    </section>
  );
}
export function RunInspector({ run }: { run: Run }) {
  return (
    <section className="inspector">
      <div className="section-heading">
        <h2>Execution record</h2>
        <ArrowUpRight size={18} />
      </div>
      <p className="subtle">
        Structured activity and timings. Private reasoning is never recorded.
      </p>
      <div className="inspector-grid">
        {[
          ["Status", run.status],
          ["Provider", run.provider],
          ["Model", run.model],
          [
            "Total latency",
            run.latencyMs
              ? `${(run.latencyMs / 1000).toFixed(2)} s`
              : "In progress",
          ],
          ["Retrieved passages", String(run.retrievalCount)],
          ["Context estimate", `${run.contextTokens} tokens`],
          [
            "Input / output tokens",
            run.usage?.inputTokens !== undefined
              ? `${run.usage.inputTokens} / ${run.usage.outputTokens ?? "—"}`
              : "Not reported",
          ],
          ["Started", new Date(run.startedAt).toLocaleString()],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <ActivityList activities={run.activities} />
      <p className="run-id">Run ID · {run.id}</p>
    </section>
  );
}
