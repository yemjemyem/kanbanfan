"use client";

import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import type { Task, TaskPriority, TaskStatus } from "../lib/types";

type ChangeLog = { at: string; message: string };
const statuses: TaskStatus[] = ["todo", "doing", "done"];

const icons = { image: "🖼️", pdf: "📄", excel: "📊", txt: "📝", md: "📘", log: "🧾", ai: "✨", github: "🐙" };

export default function HomePage() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [repo, setRepo] = useState("");
  const [token, setToken] = useState("");

  const grouped = useMemo(() => Object.fromEntries(statuses.map((s) => [s, tasks.filter((t) => t.status === s)])), [tasks]) as Record<TaskStatus, Task[]>;
  const addLog = (message: string) => setLogs((p) => [{ at: new Date().toISOString(), message }, ...p]);

  const addTask = (incoming?: Partial<Task>) => {
    if (!incoming?.title && !title.trim()) return;
    const now = new Date().toISOString();
    const task: Task = {
      id: crypto.randomUUID(),
      title: incoming?.title?.trim() || title.trim(),
      description: incoming?.description?.trim() || description.trim(),
      status: incoming?.status || status,
      priority: incoming?.priority || priority,
      source: incoming?.source || "manual",
      createdAt: now,
      updatedAt: now,
    };
    setTasks((prev) => [...prev, task]);
    addLog(`Created: ${task.title}`);
    setTitle(""); setDescription("");
  };

  const moveTask = (id: string, nextStatus: TaskStatus) => setTasks((prev) => prev.map((t) => t.id === id ? { ...t, status: nextStatus, updatedAt: new Date().toISOString() } : t));

  const exportBoard = async (type: "image" | "pdf") => {
    if (!boardRef.current) return;
    const canvas = await html2canvas(boardRef.current, { backgroundColor: "#0b1220", scale: 2 });
    if (type === "image") {
      const a = document.createElement("a"); a.href = canvas.toDataURL("image/png"); a.download = "kanban-board.png"; a.click(); return;
    }
    const pdf = new jsPDF("landscape", "pt", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 10, width, height);
    pdf.save("kanban-board.pdf");
  };

  const exportText = (format: "txt" | "md" | "log") => {
    const text = format === "log"
      ? logs.map((l) => `${l.at}: ${l.message}`).join("\n")
      : tasks.map((t) => `${format === "md" ? "-" : "*"} [${t.status}|${t.priority}] ${t.title} - ${t.description}`).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `kanban.${format === "log" ? "changelog.txt" : format}`; a.click();
  };

  const exportExcel = () => { const ws = XLSX.utils.json_to_sheet(tasks); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Tasks"); XLSX.writeFile(wb, "kanban.xlsx"); };

  const aiCorrectDescription = async () => {
    const r = await fetch("/api/ai-correct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: description }) });
    const d = (await r.json()) as { corrected: string }; setDescription(d.corrected); addLog("AI corrected description");
  };

  const importFromGithub = async () => {
    const r = await fetch("/api/github-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repo, token }) });
    const d = (await r.json()) as { cards?: Array<Partial<Task>>; error?: string };
    if (d.error || !d.cards) return addLog(`GitHub import failed: ${d.error || "unknown"}`);
    d.cards.forEach((c) => addTask({ ...c, source: "github" }));
    addLog(`Imported ${d.cards.length} items from GitHub: ${repo}`);
  };

  return <main className="main">
    <header className="topbar"><h1>KanbanFan Pro</h1><p>Mobile-first board for daily developer execution.</p></header>

    <section className="panel">
      <h3>Create task</h3>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe scope, files, acceptance..." rows={4} />
      <div className="row">
        <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
        <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}><option>low</option><option>medium</option><option>high</option></select>
      </div>
      <div className="row"><button onClick={aiCorrectDescription}>{icons.ai} AI Correct</button><button onClick={() => addTask()}>{"➕"} Add</button></div>
    </section>

    <section className="panel">
      <h3>{icons.github} GitHub Sync + AI Issue Seeder</h3>
      <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="owner/repo" />
      <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Optional GitHub token" type="password" />
      <button onClick={importFromGithub}>Import Issues + TODOs to Kanban</button>
      <small>This scans open issues and README TODO/FIXME lines and creates cards.</small>
    </section>

    <section className="exportBar">
      <button onClick={() => exportBoard("image")}>{icons.image}</button><button onClick={() => exportBoard("pdf")}>{icons.pdf}</button><button onClick={exportExcel}>{icons.excel}</button>
      <button onClick={() => exportText("txt")}>{icons.txt}</button><button onClick={() => exportText("md")}>{icons.md}</button><button onClick={() => exportText("log")}>{icons.log}</button>
    </section>

    <section className="board" ref={boardRef}>{statuses.map((s) => <div className="column" key={s} onDragOver={(e) => e.preventDefault()} onDrop={() => dragId && moveTask(dragId, s)}>
      <h3>{s.toUpperCase()} <span>{grouped[s].length}</span></h3>
      {grouped[s].map((task) => <article key={task.id} className={`card p-${task.priority}`} draggable onDragStart={() => setDragId(task.id)}>
        <strong>{task.title}</strong><p>{task.description || "No description"}</p><small>{task.priority} • {task.source || "manual"}</small>
      </article>)}
    </div>)}</section>
  </main>;
}
