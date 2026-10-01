"use client";
import { Plus, FileText, Settings2, ArrowRight } from "lucide-react";
import { Dialog } from "./dialog";
import type { WorkbenchModel } from "./use-workbench";
export function WorkbenchDialogs({
  model,
}: {
  model: Pick<
    WorkbenchModel,
    | "modal"
    | "setModal"
    | "submitWorkspace"
    | "submitSource"
    | "submitting"
    | "formError"
    | "data"
  >;
}) {
  const {
    modal,
    setModal,
    submitWorkspace,
    submitSource,
    submitting,
    formError,
    data,
  } = model;
  return (
    <>
      {" "}
      {modal === "workspace" && (
        <Dialog title="Create a workspace" onClose={() => setModal(null)}>
          <form onSubmit={submitWorkspace}>
            <p className="subtle">
              A dedicated home for your sources and research decisions.
            </p>
            <label>
              Workspace name
              <input
                name="name"
                minLength={2}
                maxLength={60}
                required
                placeholder="e.g. Platform strategy"
                autoFocus
              />
            </label>
            {formError && (
              <p role="alert" className="form-error">
                {formError}
              </p>
            )}
            <button className="primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create workspace"}
              <Plus size={15} />
            </button>
          </form>
        </Dialog>
      )}
      {modal === "source" && (
        <Dialog title="Add source material" onClose={() => setModal(null)}>
          <form onSubmit={submitSource}>
            <p className="subtle">
              Import a document or write a note. Content is normalized and
              indexed within this workspace.
            </p>
            <label className="file-upload">
              <FileText size={22} />
              <strong>Upload a document</strong>
              <span>TXT, Markdown, or text-based PDF · up to 2 MB</span>
              <input
                type="file"
                name="file"
                accept=".txt,.md,.pdf"
                aria-label="Upload document"
              />
            </label>
            <div className="or-divider">or add a note</div>
            <label>
              Title
              <input name="title" maxLength={180} placeholder="Source title" />
            </label>
            <label>
              Source text
              <textarea
                name="content"
                rows={6}
                maxLength={150000}
                placeholder="Paste the context you want to research…"
              />
            </label>
            {formError && (
              <p role="alert" className="form-error">
                {formError}
              </p>
            )}
            <button className="primary" disabled={submitting}>
              {submitting ? "Indexing…" : "Add to workspace"}
              <Plus size={15} />
            </button>
          </form>
        </Dialog>
      )}
      {modal === "settings" && (
        <Dialog title="Settings & connections" onClose={() => setModal(null)}>
          <div className="settings-content">
            <p className="subtle">
              A local research workspace. Provider credentials stay on the
              server.
            </p>
            <div className="setting-row">
              <span>AI mode</span>
              <strong>{data.config.mode}</strong>
            </div>
            <div className="setting-row">
              <span>Model</span>
              <strong>{data.config.model}</strong>
            </div>
            <div className="setting-row">
              <span>MCP utility server</span>
              <strong>{data.config.mcp ? "Configured" : "Disabled"}</strong>
            </div>
            <div className="notice">
              <Settings2 size={17} />
              <span>
                Set AI_MODE, AI_MODEL, AI_API_KEY, and AI_BASE_URL in your local
                .env file, then restart the app. Enable the optional utility
                server with MCP_URL.
              </span>
            </div>
            <h3>About demo mode</h3>
            <p>
              Retrieval, tools, citations, and persistence are real. The
              Northstar recommendation is a deterministic fixture; other tasks
              produce an extractive evidence brief.
            </p>
            <h3>Privacy boundary</h3>
            <p>
              Demo mode keeps your sources local. Provider mode sends selected
              passages to your configured model. This build uses one local
              identity and must stay on a trusted machine.
            </p>
            <button className="text-button" onClick={() => setModal(null)}>
              Back to workbench
              <ArrowRight size={15} />
            </button>
          </div>
        </Dialog>
      )}
    </>
  );
}
