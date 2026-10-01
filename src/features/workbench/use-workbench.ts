"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  Bootstrap,
  Citation,
  DocumentInfo,
  Run,
  StreamEvent,
} from "@/lib/types";
import { examplePrompt } from "@/lib/demo";
async function responseData<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}
export function useWorkbench({
  initial,
  initialTask,
}: {
  initial: Bootstrap;
  initialTask?: string;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial),
    [taskId, setTaskId] = useState<string | null>(initialTask ?? null),
    [runId, setRunId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState(examplePrompt),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [modal, setModal] = useState<
      "workspace" | "source" | "settings" | null
    >(null),
    [submitting, setSubmitting] = useState(false),
    [formError, setFormError] = useState("");
  const [view, setView] = useState<"synthesis" | "details">("synthesis"),
    [panelTab, setPanelTab] = useState<"sources" | "activity">("sources");
  const [selected, setSelected] = useState<DocumentInfo | Citation | null>(
      null,
    ),
    [sidebarOpen, setSidebarOpen] = useState(false),
    [contextOpen, setContextOpen] = useState(false),
    [saved, setSaved] = useState(false);
  const abort = useRef<AbortController | null>(null),
    textarea = useRef<HTMLTextAreaElement>(null);
  const workspace = data.workspaces.find((w) => w.id === data.activeWorkspace);
  const task = data.tasks.find((t) => t.id === taskId);
  const run = task?.runs.find((r) => r.id === runId) ?? task?.runs[0];
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    const pop = () => {
      setTaskId(new URL(location.href).searchParams.get("task"));
      setRunId(null);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  const navigate = (id: string | null) => {
    setTaskId(id);
    setRunId(null);
    setSaved(false);
    setView("synthesis");
    setSidebarOpen(false);
    const url = new URL(location.href);
    if (id) url.searchParams.set("task", id);
    else url.searchParams.delete("task");
    window.history.pushState({}, "", url);
  };
  const refresh = async () => {
    const fresh = await responseData<Bootstrap>(
      await fetch(`/api/workspaces?workspace=${data.activeWorkspace}`),
    );
    setData(fresh);
    return fresh;
  };
  const updateRun = (update: (r: Run) => Run, id: string) =>
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((t) => ({
        ...t,
        runs: t.runs.map((r) => (r.id === id ? update(r) : r)),
      })),
    }));
  async function start(retry = false) {
    if (busy || !data.activeWorkspace) return;
    setBusy(true);
    setMessage("");
    setSaved(false);
    setView("synthesis");
    setSelected(null);
    const controller = new AbortController();
    abort.current = controller;
    let currentId = "";
    let terminal = false;
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: data.activeWorkspace,
          prompt: retry && task ? task.prompt : prompt,
          taskId: retry ? task?.id : undefined,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        await responseData(response);
        return;
      }
      if (!response.body) throw new Error("Streaming is unavailable.");
      const reader = response.body.getReader(),
        decoder = new TextDecoder();
      let buffer = "";
      const apply = (event: StreamEvent) => {
        if (event.type === "run") {
          currentId = event.run.id;
          navigate(event.task.id);
          setRunId(event.run.id);
          setData((old) => {
            const existing = old.tasks.find((t) => t.id === event.task.id);
            return {
              ...old,
              tasks: existing
                ? old.tasks.map((t) =>
                    t.id === event.task.id
                      ? { ...t, runs: [event.run, ...t.runs] }
                      : t,
                  )
                : [{ ...event.task, runs: [event.run] }, ...old.tasks],
            };
          });
        }
        if (event.type === "activity")
          updateRun(
            (r) => ({
              ...r,
              activities: [
                ...r.activities.filter((a) => a.id !== event.activity.id),
                event.activity,
              ],
            }),
            currentId,
          );
        if (event.type === "citations")
          updateRun((r) => ({ ...r, citations: event.citations }), currentId);
        if (event.type === "delta")
          updateRun(
            (r) => ({ ...r, answer: r.answer + event.text }),
            currentId,
          );
        if (event.type === "done") {
          terminal = true;
          updateRun(() => event.run, currentId);
          setMessage(
            event.run.status === "completed"
              ? "Research complete. Your result has been saved."
              : (event.run.error ?? "Run finished."),
          );
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) if (line.trim()) apply(JSON.parse(line));
      }
      if (buffer.trim()) apply(JSON.parse(buffer));
      if (!terminal)
        throw new Error(
          "The connection ended before completion. Refresh to inspect the saved run.",
        );
    } catch (error) {
      if (controller.signal.aborted) {
        setMessage("Stopping run…");
        try {
          let persisted: Run | undefined;
          for (let attempt = 0; attempt < 20; attempt++) {
            const fresh = await refresh();
            persisted = fresh.tasks
              .flatMap((t) => t.runs)
              .find((r) => r.id === currentId);
            if (persisted && persisted.status !== "running") break;
            await new Promise((resolve) => setTimeout(resolve, 150));
          }
          setMessage(
            persisted?.status === "cancelled"
              ? "Run cancelled."
              : persisted?.status === "completed"
                ? "The run finished before cancellation reached the server."
                : "Cancellation requested. Refresh shortly to inspect the saved status.",
          );
        } catch {
          setMessage(
            "Cancellation requested. Refresh to load the persisted run.",
          );
        }
      } else
        setMessage(
          error instanceof Error
            ? error.message
            : "Research failed. Try again.",
        );
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }
  async function submitWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const fields = new FormData(event.currentTarget);
      const created = await responseData<{ id: string }>(
        await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: fields.get("name") }),
        }),
      );
      router.push(`/?workspace=${created.id}`);
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  async function submitSource(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    try {
      const fields = new FormData(event.currentTarget);
      fields.set("workspaceId", data.activeWorkspace);
      await responseData(
        await fetch("/api/documents", { method: "POST", body: fields }),
      );
      await refresh();
      setModal(null);
      setMessage("Source added to your workspace.");
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }
  async function saveNote() {
    if (!run || !task) return;
    try {
      const form = new FormData();
      form.set("workspaceId", data.activeWorkspace);
      form.set("title", `Research · ${task.prompt.slice(0, 70)}`);
      form.set(
        "content",
        run.answer +
          "\n\nSources:\n" +
          run.citations
            .map((c) => `[${c.label}] ${c.title}\n${c.excerpt}`)
            .join("\n\n"),
      );
      await responseData(
        await fetch("/api/documents", { method: "POST", body: form }),
      );
      setSaved(true);
      await refresh();
      setMessage("Research saved as a workspace note.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }
  function openModal(value: typeof modal) {
    setFormError("");
    setModal(value);
  }
  return {
    setRunId,
    router,
    data,
    taskId,
    runId,
    prompt,
    setPrompt,
    busy,
    message,
    setMessage,
    modal,
    setModal,
    submitting,
    formError,
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
    navigate,
    start,
    submitWorkspace,
    submitSource,
    saveNote,
    openModal,
  };
}
export type WorkbenchModel = ReturnType<typeof useWorkbench>;
