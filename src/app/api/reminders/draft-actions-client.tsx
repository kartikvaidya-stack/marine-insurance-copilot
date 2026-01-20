"use client";

import { useState } from "react";

export default function DraftActionsClient({
  claimId,
  to,
  subject,
  context,
  reminderId,
}: {
  claimId: string;
  to: string;
  subject: string;
  context: string;
  reminderId?: string;
}) {
  const [msg, setMsg] = useState<string>("");

  async function draft(intent: string, subjectHint: string) {
    setMsg("Drafting...");
    try {
      const res = await fetch("/api/drafts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          intent,
          to,
          subjectHint,
          context,
        }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        setMsg("Error: API did not return JSON.");
        return;
      }

      if (!res.ok) {
        setMsg(`Error: ${json?.error || "Failed"}${json?.details ? " — " + json.details : ""}`);
        return;
      }

      setMsg("Draft saved to claim ✓");
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "Failed"}`);
    }
  }

  async function markDone() {
    if (!reminderId) {
      setMsg("No reminderId (cannot mark done).");
      return;
    }
    setMsg("Marking done...");
    try {
      const res = await fetch("/api/reminders/done", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, reminderId }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        setMsg("Error: API did not return JSON.");
        return;
      }

      if (!res.ok) {
        setMsg(`Error: ${json?.error || "Failed"}${json?.details ? " — " + json.details : ""}`);
        return;
      }

      setMsg("Marked done ✓ (refresh page)");
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "Failed"}`);
    }
  }

  return (
    <div className="grid gap-2 min-w-[240px]">
      <button
        className="text-xs bg-gray-900 text-white px-2 py-2 rounded-md hover:bg-black"
        onClick={() => draft("reminder", `Claim ${claimId} – Follow-up`)}
      >
        Draft: Reminder
      </button>

      <button
        className="text-xs bg-gray-700 text-white px-2 py-2 rounded-md hover:bg-gray-800"
        onClick={() => draft("club_notification", `Claim ${claimId} – Initial Notification`)}
      >
        Draft: Initial Notification
      </button>

      <button
        className="text-xs bg-gray-700 text-white px-2 py-2 rounded-md hover:bg-gray-800"
        onClick={() => draft("task_followup", `Claim ${claimId} – Documents / Info Required`)}
      >
        Draft: Documents Chaser
      </button>

      <button
        className="text-xs bg-gray-700 text-white px-2 py-2 rounded-md hover:bg-gray-800"
        onClick={() => draft("task_followup", `Claim ${claimId} – Survey / Repair Update`)}
      >
        Draft: Survey / Repair Update
      </button>

      <button
        className="text-xs bg-gray-700 text-white px-2 py-2 rounded-md hover:bg-gray-800"
        onClick={() => draft("task_followup", `Claim ${claimId} – Underwriter / Club Update`)}
      >
        Draft: Underwriter / Club Update
      </button>

      <button
        className="text-xs bg-green-700 text-white px-2 py-2 rounded-md hover:bg-green-800"
        onClick={markDone}
      >
        Mark reminder DONE
      </button>

      {msg && <div className="text-xs text-gray-600 mt-1">{msg}</div>}

      <div className="text-[11px] text-gray-500">
        To: {to || "—"}
        <br />
        Ref: {subject || "—"}
      </div>
    </div>
  );
}
