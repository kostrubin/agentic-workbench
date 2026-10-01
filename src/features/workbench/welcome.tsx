import {
  Layers,
  Workflow,
  ArrowUpRight,
  FileText,
  ArrowRight,
  Search,
  Command,
  Check,
} from "lucide-react";
import { examplePrompt } from "@/lib/demo";
import type { WorkbenchModel } from "./use-workbench";
export function Welcome({
  model,
}: {
  model: Pick<
    WorkbenchModel,
    "data" | "workspace" | "busy" | "setPrompt" | "textarea"
  >;
}) {
  const { data, workspace, busy, setPrompt, textarea } = model;
  return (
    <>
      <div className="page-eyebrow">
        <span />
        RESEARCH & DECISIONS
      </div>
      <div className="welcome-heading">
        <h1>
          Clarity starts
          <br />
          with good evidence.
        </h1>
        <p>
          A focused space to investigate, compare, and decide.
          <br className="desktop-break" /> Bring your sources. Follow the work.
          Keep the evidence.
        </p>
      </div>
      <div className="workspace-summary">
        <div>
          <span className="summary-icon">
            <Layers size={19} />
          </span>
          <div>
            <strong>{workspace?.name ?? "Create your first workspace"}</strong>
            <p>
              {workspace?.description ??
                "Organize the context for a meaningful decision."}
            </p>
          </div>
        </div>
        <span className="subtle">{data.documents.length} sources</span>
      </div>
      <div className="section-heading">
        <h2>A starting point</h2>
        <span>BUILT TO EXPLORE</span>
      </div>
      <button
        className="starter-card"
        disabled={busy || !workspace}
        onClick={() => {
          setPrompt(examplePrompt);
          textarea.current?.focus();
        }}
      >
        <div className="starter-top">
          <span className="starter-icon">
            <Workflow size={21} />
          </span>
          <span className="tag">ARCHITECTURE REVIEW</span>
          <ArrowUpRight size={18} />
        </div>
        <h3>
          One team. Two proposals.
          <br />A tenfold growth target.
        </h3>
        <p>
          Compare a modular monolith with event-driven services. Find the right
          trade-off for a small team.
        </p>
        <div className="starter-bottom">
          <span>
            <FileText size={13} />
            Try with the seeded Northstar sources
          </span>
          <span>
            Use this brief <ArrowRight size={14} />
          </span>
        </div>
      </button>
      <div className="capability-strip">
        <span>
          <Search size={14} />
          Find relevant context
        </span>
        <span>
          <Command size={14} />
          Verify with tools
        </span>
        <span>
          <Check size={14} />
          Cite every source
        </span>
      </div>
    </>
  );
}
