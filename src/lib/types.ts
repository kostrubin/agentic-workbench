export type RunStatus = "running" | "completed" | "failed" | "cancelled";
export type Phase = "plan" | "retrieve" | "tools" | "synthesize";
export interface Workspace {
  id: string;
  name: string;
  description: string;
}
export interface DocumentInfo {
  id: string;
  title: string;
  kind: string;
  content: string;
  createdAt: string;
}
export interface Chunk {
  id: string;
  documentId: string;
  title: string;
  text: string;
  ordinal: number;
  score: number;
}
export interface Citation {
  label: number;
  chunkId: string;
  documentId: string;
  title: string;
  excerpt: string;
}
export interface Activity {
  id: string;
  phase: Phase;
  label: string;
  status: "running" | "completed" | "failed";
  durationMs?: number;
  detail?: string;
  tool?: string;
}
export interface Run {
  id: string;
  taskId: string;
  status: RunStatus;
  answer: string;
  activities: Activity[];
  citations: Citation[];
  provider: string;
  model: string;
  startedAt: string;
  completedAt: string | null;
  latencyMs: number | null;
  contextTokens: number;
  retrievalCount: number;
  usage: { inputTokens?: number; outputTokens?: number } | null;
  error: string | null;
}
export interface Task {
  id: string;
  workspaceId: string;
  prompt: string;
  createdAt: string;
  runs: Run[];
}
export type StreamEvent =
  | { type: "run"; run: Run; task: Omit<Task, "runs"> }
  | { type: "activity"; activity: Activity }
  | { type: "citations"; citations: Citation[] }
  | { type: "delta"; text: string }
  | { type: "done"; run: Run };
export interface Bootstrap {
  workspaces: Workspace[];
  activeWorkspace: string;
  documents: DocumentInfo[];
  tasks: Task[];
  config: { mode: string; model: string; mcp: boolean };
}
