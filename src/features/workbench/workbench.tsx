"use client";
import {
  Plus,
  PanelLeft,
  Layers,
  CircleHelp,
  Sparkles,
  Workflow,
  ArrowRight,
  Square,
} from "lucide-react";
import type { Bootstrap } from "@/lib/types";
import { useWorkbench } from "./use-workbench";
import { Sidebar } from "./sidebar";
import { Welcome } from "./welcome";
import { WorkbenchDialogs } from "./forms";
import { Evidence } from "./evidence";
import { PhaseRail, Result, RunInspector } from "./result";
export function Workbench({
  initial,
  initialTask,
}: {
  initial: Bootstrap;
  initialTask?: string;
}) {
  const model = useWorkbench({ initial, initialTask });
  const {
    data,
    prompt,
    setPrompt,
    busy,
    message,
    setMessage,
    view,
    setView,
    panelTab,
    setPanelTab,
    selected,
    setSelected,
    sidebarOpen,
    setSidebarOpen,
    contextOpen,
    setContextOpen,
    saved,
    abort,
    textarea,
    workspace,
    task,
    run,
    setRunId,
    start,
    saveNote,
    openModal,
  } = model;
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to research
      </a>
      {sidebarOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <Sidebar model={model} />
      <div className="workspace-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <PanelLeft size={18} />
            </button>
            <span className="breadcrumb-root">Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>{workspace?.name ?? "Getting started"}</strong>
          </div>
          <div>
            <span className="mode-indicator">
              <span className="live-dot" />
              {data.config.mode === "demo" ? "Demo mode" : "Provider mode"}
            </span>
            <button
              className="icon-button context-toggle"
              aria-label="Open context panel"
              onClick={() => setContextOpen(!contextOpen)}
            >
              <Layers size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="About this workbench"
              onClick={() => openModal("settings")}
            >
              <CircleHelp size={17} />
            </button>
          </div>
        </header>
        <div className="workspace-columns">
          <main id="main" className="main-content">
            <div className="main-inner">
              {!task ? (
                <Welcome model={model} />
              ) : (
                <>
                  <div className="page-eyebrow">
                    <span />
                    RESEARCH TASK
                  </div>
                  <h1 className="task-title">{task.prompt}</h1>
                  <div className="task-meta">
                    <span>
                      {new Date(task.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span>·</span>
                    <span>
                      {task.runs.length}{" "}
                      {task.runs.length === 1 ? "run" : "runs"}
                    </span>
                    <span>·</span>
                    <span>Saved to workspace</span>
                  </div>
                  <div className="result-tabs">
                    <button
                      className={view === "synthesis" ? "selected" : ""}
                      onClick={() => setView("synthesis")}
                    >
                      <Sparkles size={15} />
                      Synthesis
                    </button>
                    <button
                      className={view === "details" ? "selected" : ""}
                      onClick={() => setView("details")}
                    >
                      <Workflow size={15} />
                      Run details
                    </button>
                    {task.runs.length > 1 && (
                      <select
                        aria-label="Select run"
                        value={run?.id}
                        disabled={busy}
                        onChange={(e) => setRunId(e.target.value)}
                      >
                        {task.runs.map((r, i) => (
                          <option key={r.id} value={r.id}>
                            Run {task.runs.length - i} · {r.status}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  {run && (
                    <>
                      <PhaseRail run={run} />
                      {view === "synthesis" ? (
                        <Result
                          run={run}
                          busy={busy}
                          saved={saved}
                          onCitation={(c) => {
                            setSelected(c);
                            setPanelTab("sources");
                            setContextOpen(true);
                          }}
                          onRetry={() => void start(true)}
                          onSave={() => void saveNote()}
                          onCopy={() => {
                            void navigator.clipboard
                              .writeText(run.answer)
                              .then(() => setMessage("Result copied."))
                              .catch(() =>
                                setMessage(
                                  "Clipboard unavailable. Select the result text to copy.",
                                ),
                              );
                          }}
                        />
                      ) : (
                        <RunInspector run={run} />
                      )}
                    </>
                  )}
                </>
              )}
              {!task && (
                <form
                  className="composer"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void start();
                  }}
                >
                  <label htmlFor="research-prompt">
                    <Sparkles size={16} />
                    What would you like to investigate?
                  </label>
                  <textarea
                    ref={textarea}
                    id="research-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Ask a question grounded in your workspace…"
                    minLength={8}
                    maxLength={2000}
                    required
                    disabled={busy || !workspace}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                        e.preventDefault();
                        if (prompt.trim().length >= 8) void start();
                      }
                    }}
                  />
                  <div className="composer-footer">
                    <span>
                      <Layers size={13} />
                      {data.documents.length} sources available
                      <span className="composer-shortcut">⌘ ↵</span>
                    </span>
                    <button
                      className="primary"
                      disabled={busy || !workspace || prompt.trim().length < 8}
                    >
                      Start research
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </form>
              )}
              {busy && (
                <div className="running-bar" role="status">
                  <span>
                    <span className="live-dot pulse" />
                    Research in progress · changes are saved as you go
                  </span>
                  <button
                    className="text-button"
                    onClick={() => abort.current?.abort()}
                  >
                    <Square size={12} />
                    Stop run
                  </button>
                </div>
              )}
              {!workspace && (
                <button
                  className="primary"
                  onClick={() => openModal("workspace")}
                >
                  Create workspace
                  <Plus size={15} />
                </button>
              )}
              <div className="toast" role="status" aria-live="polite">
                {message}
              </div>
              <footer className="main-footer">
                <span className="footer-mark">a</span>Evidence first. Judgment
                always yours.
                <span>
                  {data.config.mode === "demo"
                    ? "No API key required"
                    : "Connected provider"}
                </span>
              </footer>
            </div>
          </main>
          {contextOpen && (
            <button
              className="context-scrim"
              aria-label="Close context panel"
              onClick={() => setContextOpen(false)}
            />
          )}
          <aside
            className={"context-panel " + (contextOpen ? "is-open" : "")}
            aria-label="Research context"
          >
            <Evidence
              documents={data.documents}
              run={run}
              tab={panelTab}
              setTab={setPanelTab}
              selected={selected}
              onSelect={setSelected}
              onAdd={() => openModal("source")}
              onClose={() => setContextOpen(false)}
            />
          </aside>
        </div>
      </div>
      <WorkbenchDialogs model={model} />
    </div>
  );
}
