"use client";
import {
  FileText,
  Plus,
  ArrowUpRight,
  Database,
  BookOpen,
  X,
  Layers,
} from "lucide-react";
import type { Citation, DocumentInfo, Run } from "@/lib/types";
import { ActivityList } from "./result";
export function Evidence({
  documents,
  run,
  tab,
  setTab,
  selected,
  onSelect,
  onAdd,
  onClose,
}: {
  documents: DocumentInfo[];
  run?: Run;
  tab: "sources" | "activity";
  setTab: (t: "sources" | "activity") => void;
  selected: DocumentInfo | Citation | null;
  onSelect: (d: DocumentInfo | Citation | null) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <header className="panel-heading">
        <div>
          <Layers size={16} />
          <h2>Context</h2>
        </div>
        <button
          className="icon-button mobile-close"
          onClick={onClose}
          aria-label="Close context panel"
        >
          <X size={18} />
        </button>
        <span className="panel-count">{documents.length}</span>
      </header>
      <div className="panel-tabs">
        <button
          className={tab === "sources" ? "selected" : ""}
          onClick={() => setTab("sources")}
        >
          Sources
        </button>
        <button
          className={tab === "activity" ? "selected" : ""}
          onClick={() => setTab("activity")}
        >
          Activity {run && <span>{run.activities.length}</span>}
        </button>
      </div>
      {tab === "activity" ? (
        <div className="panel-body">
          {run ? (
            <ActivityList activities={run.activities} />
          ) : (
            <div className="empty-panel">
              <Layers size={25} />
              <h3>A clear execution trail</h3>
              <p>
                Start a research task to see source retrieval, tool calls, and
                timings here.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="panel-body">
          <div className="panel-label">
            WORKSPACE LIBRARY
            <button
              className="icon-button"
              onClick={onAdd}
              aria-label="Add source"
            >
              <Plus size={15} />
            </button>
          </div>
          {documents.length === 0 ? (
            <div className="empty-panel">
              <BookOpen size={28} />
              <h3>Bring your own evidence</h3>
              <p>
                Add a note, Markdown document, or PDF to give your research
                useful context.
              </p>
            </div>
          ) : (
            <div className="source-list">
              {documents.map((doc, i) => (
                <button
                  key={doc.id}
                  className={
                    "source-item " +
                    (selected && "id" in selected && selected.id === doc.id
                      ? "selected"
                      : "")
                  }
                  onClick={() => onSelect(doc)}
                >
                  <span className={"file-icon color-" + (i % 4)}>
                    <FileText size={17} />
                  </span>
                  <span>
                    <strong>{doc.title}</strong>
                    <small>
                      {doc.kind.toUpperCase()} ·{" "}
                      {Math.ceil(doc.content.length / 1000)}k characters
                    </small>
                  </span>
                  <ArrowUpRight size={13} />
                </button>
              ))}
            </div>
          )}
          <button className="add-source-button" onClick={onAdd}>
            <Plus size={15} />
            Add source material
          </button>
          {selected && (
            <section className="source-preview">
              <header>
                <small>
                  {"label" in selected
                    ? `CITATION ${selected.label}`
                    : "SOURCE PREVIEW"}
                </small>
                <button
                  className="icon-button"
                  onClick={() => onSelect(null)}
                  aria-label="Close source preview"
                >
                  <X size={15} />
                </button>
              </header>
              <h3>{selected.title}</h3>
              <div className="source-excerpt">
                {"excerpt" in selected ? selected.excerpt : selected.content}
              </div>
            </section>
          )}
          {run && run.citations.length > 0 && (
            <section className="used-sources">
              <div className="panel-label">
                SELECTED EVIDENCE<span>{run.citations.length}</span>
              </div>
              {run.citations.map((c) => (
                <button key={c.label} onClick={() => onSelect(c)}>
                  <span className="citation-label">{c.label}</span>
                  <span>{c.title}</span>
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </section>
          )}
          <div className="context-note">
            <Database size={17} />
            <div>
              <strong>Grounded in your workspace</strong>
              <p>
                Only relevant passages enter the context. Every reference stays
                connected to its source.
              </p>
              <span>2,400 token evidence budget</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
