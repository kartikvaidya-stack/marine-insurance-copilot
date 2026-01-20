"use client";

import { useMemo, useState } from "react";

type Task = {
  id: string;
  title: string;
  status: "open" | "done";
  createdAt?: string;
  dueAt?: string;
};

function fmtUTC(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // stable formatting (avoid hydration issues)
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function isOverdue(dueAt?: string) {
  if (!dueAt) return false;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() > t;
}

function nextId(claimId: string, existing: Task[]) {
  // NC-...-T01 style
  const nums = existing
    .map((t) => {
      const m = String(t.id || "").match(/-T(\d+)$/);
      return m ? Number(m[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  const pad = String(n).padStart(2, "0");
  return `${claimId}-T${pad}`;
}

export default function TaskChecklist({
  claimId,
  tasks,
}: {
  claimId: string;
  tasks: Task[];
}) {
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const [items, setItems] = useState<Task[]>(safeTasks);
  const [newTitle, setNewTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const summary = useMemo(() => {
    const open = items.filter((t) => t.status !== "done").length;
    const done = items.filter((t) => t.status === "done").length;
    const overdue = items.filter((t) => t.status !== "done" && isOverdue(t.dueAt)).length;
    return { open, done, overdue };
  }, [items]);

  async function save(nextTasks: Task[]) {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch("/api/claims/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, tasks: nextTasks }),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      // optional: read response, but not required
      await res.json().catch(() => null);
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(taskId: string) {
    const next = items.map((t) =>
      t.id === taskId ? { ...t, status: t.status === "done" ? "open" : "done" } : t
    );
    setItems(next);
    await save(next);
  }

  async function addTask() {
    const title = newTitle.trim();
    if (!title) return;

    const now = new Date().toISOString();
    const due = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // +1 day default

    const t: Task = {
      id: nextId(claimId, items),
      title,
      status: "open",
      createdAt: now,
      dueAt: due,
    };

    const next = [t, ...items];
    setItems(next);
    setNewTitle("");
    await save(next);
  }

  async function removeTask(taskId: string) {
    const next = items.filter((t) => t.id !== taskId);
    setItems(next);
    await save(next);
  }

  async function updateDueAt(taskId: string, dueAt: string) {
    // accept datetime-local -> convert to ISO if possible
    let iso = dueAt;
    if (dueAt && !dueAt.endsWith("Z") && dueAt.includes("T")) {
      const d = new Date(dueAt);
      iso = Number.isNaN(d.getTime()) ? dueAt : d.toISOString();
    }
    const next = items.map((t) => (t.id === taskId ? { ...t, dueAt: iso } : t));
    setItems(next);
    await save(next);
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Tasks</h3>
          <p className="text-sm text-gray-600 mt-1">
            Open: <span className="font-semibold">{summary.open}</span> • Done:{" "}
            <span className="font-semibold">{summary.done}</span>
            {summary.overdue > 0 && (
              <>
                {" "}
                • <span className="text-red-700 font-semibold">{summary.overdue} overdue</span>
              </>
            )}
          </p>
        </div>

        <div className="text-xs text-gray-500">
          {saving ? "Saving…" : " "}
          {err ? <span className="text-red-700">Save failed</span> : null}
        </div>
      </div>

      {err ? (
        <div className="mt-3 text-xs bg-red-50 border border-red-200 text-red-800 rounded-lg p-3 whitespace-pre-wrap">
          {err}
        </div>
      ) : null}

      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 border rounded-md px-3 py-2 text-sm"
          placeholder="Add a task (e.g., Appoint surveyor / Notify underwriters / Request repair quote)"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addTask();
          }}
        />
        <button
          className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700"
          onClick={addTask}
        >
          Add
        </button>
      </div>

      <ul className="mt-4 divide-y border rounded-lg overflow-hidden">
        {items.length === 0 ? (
          <li className="p-3 text-sm text-gray-600">No tasks yet.</li>
        ) : (
          items.map((t) => {
            const overdue = t.status !== "done" && isOverdue(t.dueAt);
            return (
              <li key={t.id} className="p-3 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={t.status === "done"}
                    onChange={() => toggle(t.id)}
                  />
                  <div>
                    <div className={t.status === "done" ? "line-through text-gray-500" : ""}>
                      {t.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Due:{" "}
                      <span className={overdue ? "text-red-700 font-semibold" : ""}>
                        {fmtUTC(t.dueAt)}
                      </span>
                      {overdue ? <span className="ml-2 text-red-700 font-semibold">OVERDUE</span> : null}
                    </div>

                    <div className="mt-2">
                      <label className="text-xs text-gray-500 mr-2">Change due:</label>
                      <input
                        type="datetime-local"
                        className="border rounded-md px-2 py-1 text-xs"
                        onChange={(e) => updateDueAt(t.id, e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <button
                  className="text-xs text-red-700 hover:underline"
                  onClick={() => removeTask(t.id)}
                >
                  Remove
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-4 text-xs text-gray-500">
        Reminders are managed in the <a className="text-blue-700 hover:underline" href="/reminders">Reminders</a> tab.
      </div>
    </div>
  );
}
