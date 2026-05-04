"use client";

import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import * as XLSX from "xlsx";
import type { Task, TaskStatus } from "../lib/types";

type ChangeLog = { at: string; message: string };

const statuses: TaskStatus[] = ["todo", "doing", "done"];

const aiCorrectDescription = async (text: string) => {
  const response = await fetch("/api/ai-correct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) throw new Error("Failed to correct description");
  const data = (await response.json()) as { corrected: string };
  return data.corrected;
};

export default function HomePage() {
  const boardRef = useRef<HTMLDivElement>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [loadingAI, setLoadingAI] = useState(false);

  const grouped = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s, tasks.filter((t) => t.status === s)])),
    [tasks],
  ) as Record<TaskStatus, Task[]>;

  const addLog = (message: string) => setLogs((prev) => [{ at: new Date().toISOString(), message }, ...prev]);

  const addTask = () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const task: Task = { id: crypto.randomUUID(), title: title.trim(), description: description.trim(), status, createdAt: now, updatedAt: now };
    setTasks((prev) => [...prev, task]);
    addLog(`Task created: ${task.title}`);
    setTitle("");
    setDescription("");
    setStatus("todo");
  };

  const moveTask = (id: string, nextStatus: TaskStatus) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, status: nextStatus, updatedAt: new Date().toISOString() } : task)),
    );
    const task = tasks.find((t) => t.id === id);
    if (task) addLog(`Task moved: ${task.title} -> ${nextStatus}`);
  };

  const exportImage = async () => {
    if (!boardRef.current) return;
    const canvas = await html2canvas(boardRef.current, { backgroundColor: "#f4f7fb", scale: 2 });
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "kanban-board.png";
    a.click();
  };

  const exportPDF = async () => {
    if (!boardRef.current) return;
    const canvas = await html2canvas(boardRef.current, { scale: 2 });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF("landscape", "pt", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(img, "PNG", 0, 20, width, height);
    pdf.save("kanban-board.pdf");
  };

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(tasks);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");
    XLSX.writeFile(workbook, "kanban-tasks.xlsx");
  };

  const exportTextLike = (format: "txt" | "md") => {
    const lines = tasks.map((t) => `${format === "md" ? "-" : "*"} [${t.status}] ${t.title}: ${t.description}`);
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanban-tasks.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportChangelog = () => {
    const text = logs.map((l) => `${l.at} - ${l.message}`).join("\n");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "changelog.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const correctDescription = async () => {
    if (!description.trim()) return;
    setLoadingAI(true);
    try {
      const corrected = await aiCorrectDescription(description);
      setDescription(corrected);
      addLog("AI corrected draft description");
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <main className="main">
      <section className="header">
        <div>
          <h1>KanbanFan</h1>
          <small>Manage tasks + AI correction + multi-format export.</small>
        </div>
      </section>

      <section className="col">
        <h3>Create Task</h3>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Task description" rows={3} />
        <div className="row">
          <button type="button" className="secondary" onClick={correctDescription} disabled={loadingAI}>
            {loadingAI ? "Correcting..." : "AI Correct Description"}
          </button>
          <select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {statuses.map((s) => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={addTask}>Add Task</button>
      </section>

      <section className="toolbar">
        <button onClick={exportImage}>Export Image</button>
        <button onClick={exportPDF}>Export PDF</button>
        <button onClick={exportExcel}>Export Excel</button>
        <button onClick={() => exportTextLike("txt")}>Export Text</button>
        <button onClick={() => exportTextLike("md")}>Export Markdown</button>
        <button className="secondary" onClick={exportChangelog}>Export Changelog</button>
      </section>

      <section className="grid" ref={boardRef}>
        {statuses.map((s) => (
          <div className="col" key={s}>
            <h3>{s.toUpperCase()}</h3>
            {grouped[s].map((task) => (
              <article className="card" key={task.id}>
                <b>{task.title}</b>
                <p>{task.description || "No description"}</p>
                <small>Updated: {new Date(task.updatedAt).toLocaleString()}</small>
                <select value={task.status} onChange={(e) => moveTask(task.id, e.target.value as TaskStatus)}>
                  {statuses.map((next) => (
                    <option key={next} value={next}>{next.toUpperCase()}</option>
                  ))}
                </select>
              </article>
            ))}
          </div>
        ))}
      </section>
    </main>
  );
}
