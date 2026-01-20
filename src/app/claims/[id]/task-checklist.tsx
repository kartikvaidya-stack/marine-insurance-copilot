"use client";

import { useEffect, useMemo, useState } from "react";

export type TaskStatus = "open" | "done";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt?: string;
  dueAt?: string;
};

export type ReminderStatus = "pending" | "done";

export type Reminder = {
  id: string;
  createdAt?: string;
  status?: ReminderStatus | string;
  dueAt: string;
  to?: string;
  channel?: string;
  subject?: string;
  context?: string;
};

function isOverdue(dueAt?: string) {
  if (!dueAt) return false;
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() > t;
}

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

async function postJSON(url: string, payload: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // If route crashes, Next may return HTML. Detect and surface it.
  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  const isJson = ct.includes("application/json");

  if (!res.ok) {
    throw new Error(isJson ? text : `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return isJson ? JSON.parse(text) : text;
}

export default function TaskChecklist(props: {
  claimId: string;
  tasks: Task[];
  reminders?: Reminder[];
}) {
  const claimId = props.claimId;

  // Always safe arrays
  const initialTasks = Array.isArray(props.tasks) ? props.tasks : [];
  const initialReminders = Array.isArray(props.reminders) ? props.reminders : [];

  const [items, setItems] = useState<Task[]>(initialTasks);
  const [saving, setSaving] = useState<string>("");

  // Keep in sync if parent changes
  useEffect(() => {
    setItems(Array.isArray(props.tasks) ? (props.tasks as Task[]) : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.tasks?.length, claimId]);

  const reminders = useMemo(() => {
    return Array.isArray(props.reminders) ? props.reminders : [];
  }, [props.reminders]);

  const openCount = items.filter((t) => t.status !== "done").length;
  const doneCount = items.filter((t) => t.status === "done").length;

  const overdueTasks = items.filter((t) => t.status !== "done" && isOverdue(t.dueAt)).length;
  const overdueReminders = reminders.filter((r) => (r?.status || "pending") !== "done" && isOverdue(r?.dueAt))
    .length;

  async function save(next: Task[]) {
    setSaving("Saving...");
    try {
      await postJSON("/api/tasks/set-status", {
        claimId,
        tasks: next,
      });
      setSaving("Saved");
      setTimeout(() => setSaving(""), 700);
    } catch (e: any) {
      setSaving(`Save failed: ${e?.message || String(e)}`);
    }
  }

  async function toggle(taskId: string) {
    const next: Task[] = items.map((t) =>
      t.id === taskId ? { ...t, status: (t.status === "done" ? "open" : "done") as TaskStatus } : t
    );
    setItems(next);
    await save(next);
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Tasks</h3>
          <p className="text-sm text-gray-600">
            Open: <span className="font-semibold">{openCount}</span> • Done:{" "}
            <span className="font-semibold">{doneCount}</span>
            {overdueTasks > 0 ? (
              <>
                {" "}
                • <span className="text-red-700 font-semibold">{overdueTasks} overdue</span>
              </>
            ) : null}
            {overdueReminders > 0 ? (
              <>
                {" "}
                • <span className="text-red-700 font-semibold">{overdueReminders} overdue reminders</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="text-xs text-gray-500">{saving}</div>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left font-medium px-3 py-2">Done</th>
              <th className="text-left font-medium px-3 py-2">Task</th>
              <th className="text-left font-medium px-3 py-2">Due</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr className="border-t">
                <td colSpan={4} className="px-3 py-3 text-gray-600">
                  No tasks.
                </td>
              </tr>
            ) : (
              items.map((t) => {
                const od = t.status !== "done" && isOverdue(t.dueAt);
                return (
                  <tr key={t.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={t.status === "done"}
                        onChange={() => toggle(t.id)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{t.title}</div>
                      <div className="text-xs text-gray-500 mt-1">{t.id}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className={od ? "text-red-700 font-semibold" : ""}>{fmt(t.dueAt)}</div>
                      {od ? <div className="text-xs text-red-700">OVERDUE</div> : null}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={
                          t.status === "done"
                            ? "inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                            : "inline-block text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded"
                        }
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mini reminders summary (read-only) */}
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-700">
        Reminders attached to this claim:{" "}
        <span className="font-semibold">{initialReminders.length}</span>
      </div>
    </div>
  );
}
