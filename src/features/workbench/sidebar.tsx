"use client";
import {
  PanelLeftClose,
  ChevronDown,
  Plus,
  Workflow,
  FileText,
  Settings2,
} from "lucide-react";
import type { WorkbenchModel } from "./use-workbench";
export function Sidebar({
  model,
}: {
  model: Pick<
    WorkbenchModel,
    | "router"
    | "data"
    | "workspace"
    | "busy"
    | "taskId"
    | "sidebarOpen"
    | "setSidebarOpen"
    | "navigate"
    | "setPrompt"
    | "textarea"
    | "setPanelTab"
    | "setContextOpen"
    | "openModal"
  >;
}) {
  const {
    router,
    data,
    workspace,
    busy,
    taskId,
    sidebarOpen,
    setSidebarOpen,
    navigate,
    setPrompt,
    textarea,
    setPanelTab,
    setContextOpen,
    openModal,
  } = model;
  return (
    <aside className={"sidebar " + (sidebarOpen ? "is-open" : "")}>
      <div className="brand">
        <span className="brand-symbol">
          a<span />
        </span>
        <span>
          agentic<span>workbench</span>
        </span>
        <button
          className="icon-button mobile-close"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        >
          <PanelLeftClose size={17} />
        </button>
      </div>
      <label className="workspace-switcher">
        <span className="workspace-avatar">
          {workspace?.name.slice(0, 1) ?? "W"}
        </span>
        <span>
          <small>WORKSPACE</small>
          <select
            aria-label="Select workspace"
            value={data.activeWorkspace}
            disabled={busy}
            onChange={(e) => {
              router.push(`/?workspace=${e.target.value}`);
            }}
          >
            {data.workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
            {!data.workspaces.length && (
              <option value="">No workspace yet</option>
            )}
          </select>
        </span>
        <ChevronDown size={13} />
      </label>
      <button
        className="new-task"
        disabled={busy}
        onClick={() => {
          navigate(null);
          setPrompt("");
          setTimeout(() => textarea.current?.focus(), 0);
        }}
      >
        <Plus size={16} />
        New research<span>↗</span>
      </button>
      <nav aria-label="Main navigation">
        <button
          className="nav-item active"
          onClick={() => {
            if (!busy) navigate(null);
          }}
        >
          <Workflow size={17} />
          Research
          <span className="nav-dot" />
        </button>
        <button
          className="nav-item"
          onClick={() => {
            setPanelTab("sources");
            setContextOpen(true);
          }}
        >
          <FileText size={17} />
          Source library
          <span className="nav-count">{data.documents.length}</span>
        </button>
      </nav>
      <div className="history-heading">
        RECENT RESEARCH<span>{data.tasks.length}</span>
      </div>
      <div className="history">
        {data.tasks.length ? (
          data.tasks.map((t) => (
            <button
              key={t.id}
              disabled={busy && t.id !== taskId}
              className={"history-item " + (t.id === taskId ? "selected" : "")}
              onClick={() => navigate(t.id)}
            >
              <span className={"history-dot " + (t.runs[0]?.status ?? "")} />
              <span>{t.prompt}</span>
            </button>
          ))
        ) : (
          <p className="history-empty">
            Your research will live here.
            <br />
            Every run, every reference.
          </p>
        )}
      </div>
      <div className="sidebar-bottom">
        <button
          className="nav-item"
          disabled={busy}
          onClick={() => openModal("workspace")}
        >
          <Plus size={16} />
          Create workspace
        </button>
        <button className="nav-item" onClick={() => openModal("settings")}>
          <Settings2 size={16} />
          Settings & connections
        </button>
        <div className="reviewer">
          <span>LR</span>
          <div>
            <strong>Local reviewer</strong>
            <small>Personal workspace</small>
          </div>
          <span className="live-dot" />
        </div>
      </div>
    </aside>
  );
}
