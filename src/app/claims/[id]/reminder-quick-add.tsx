"use client";

import { useMemo, useState } from "react";

function toIsoFromLocal(local: string) {
  // local is like "2026-01-20T10:00"
  if (!local) return "";
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

function defaultLocalPlusHours(hours: number) {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function ReminderQuickAdd({
  claimId,
  vessel,
  incident,
  location,
}: {
  claimId: string;
  vessel: string;
  incident: string;
  location: string;
}) {
  const templates = useMemo(
    () => [
      {
        key: "initial_pi",
        label: "Initial P&I / Underwriter Notification",
        to: "P&I Club / Underwriter",
        subject: `Claim ${claimId} – Initial Notification – ${vessel}`,
        context: `Please note initial notification of incident.\n\nVessel: ${vessel}\nLocation: ${location}\nIncident: ${incident}\n\nPlease confirm appointment of surveyor / next steps.\n\nRegards,\nNova Carriers`,
        dueHours: 2,
      },
      {
        key: "survey",
        label: "Survey Appointment / Attendance",
        to: "Surveyor / Class / Agent",
        subject: `Claim ${claimId} – Survey arrangements – ${vessel}`,
        context: `Please arrange / confirm survey attendance for the subject incident.\n\nVessel: ${vessel}\nLocation: ${location}\nIncident: ${incident}\n\nKindly advise ETA and required access.\n\nRegards,\nNova Carriers`,
        dueHours: 8,
      },
      {
        key: "docs",
        label: "Documents Chaser",
        to: "Ship Manager / Master / Agent",
        subject: `Claim ${claimId} – Documents required – ${vessel}`,
        context: `Please provide the following for claim handling:\n- Master’s statement\n- Log extracts\n- Photos\n- Relevant reports / class attendance\n- Repair estimates (if any)\n\nVessel: ${vessel}\nLocation: ${location}\nIncident: ${incident}\n\nRegards,\nNova Carriers`,
        dueHours: 24,
      },
      {
        key: "update",
        label: "Progress Follow-up (Club / Underwriter)",
        to: "P&I Club / Underwriter",
        subject: `Claim ${claimId} – Progress update request – ${vessel}`,
        context: `Kindly provide an update on handling status / next steps.\n\nVessel: ${vessel}\nIncident: ${incident}\nLocation: ${location}\n\nRegards,\nNova Carriers`,
        dueHours: 48,
      },
      {
        key: "settlement",
        label: "Settlement / Payment Follow-up",
        to: "P&I Club / Underwriter / Broker",
        subject: `Claim ${claimId} – Settlement / payment follow-up – ${vessel}`,
        context: `Kindly confirm settlement position and expected payment timeline.\n\nClaim: ${claimId}\nVessel: ${vessel}\n\nRegards,\nNova Carriers`,
        dueHours: 72,
      },
    ],
    [claimId, vessel, incident, location]
  );

  const [templateKey, setTemplateKey] = useState<string>(templates[0].key);
  const t = templates.find((x) => x.key === templateKey) || templates[0];

  const [to, setTo] = useState<string>(t.to);
  const [subject, setSubject] = useState<string>(t.subject);
  const [context, setContext] = useState<string>(t.context);
  const [dueLocal, setDueLocal] = useState<string>(defaultLocalPlusHours(t.dueHours));
  const [msg, setMsg] = useState<string>("");

  // When template changes, refresh fields
  function applyTemplate(key: string) {
    const nt = templates.find((x) => x.key === key) || templates[0];
    setTemplateKey(key);
    setTo(nt.to);
    setSubject(nt.subject);
    setContext(nt.context);
    setDueLocal(defaultLocalPlusHours(nt.dueHours));
  }

  async function createReminder() {
    setMsg("Saving reminder...");
    try {
      const dueAtIso = toIsoFromLocal(dueLocal);
      if (!dueAtIso) {
        setMsg("Please set a valid due date/time.");
        return;
      }

      const res = await fetch("/api/reminders/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          reminder: {
            to: (to || "").trim(),
            subject: (subject || "").trim(),
            context: context || "",
            dueAt: dueAtIso,
            channel: "email",
            status: "open",
          },
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

      setMsg("Reminder saved ✓ (go to /reminders or refresh)");
      setTimeout(() => setMsg(""), 1800);
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "Failed"}`);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Create Reminder</h3>
          <p className="text-xs text-gray-500 mt-1">Log follow-ups against this claim (shows in Reminders).</p>
        </div>
        <div className="text-xs text-gray-600">{msg}</div>
      </div>

      <div className="mt-4 grid gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">Template</div>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={templateKey}
            onChange={(e) => applyTemplate(e.target.value)}
          >
            {templates.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">To</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="P&I Club / Broker / Surveyor"
            />
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Due (local)</div>
            <input
              type="datetime-local"
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={dueLocal}
              onChange={(e) => setDueLocal(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">Subject</div>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={`Claim ${claimId} – Follow-up`}
          />
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">Context</div>
          <textarea
            className="w-full min-h-[120px] border rounded-lg px-3 py-2 text-sm"
            value={context}
            onChange={(e) => setContext(e.target.value)}
          />
        </div>

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
          onClick={createReminder}
        >
          Save reminder
        </button>

        <div className="text-[11px] text-gray-500">
          After saving: open <span className="font-mono">/reminders</span> (pending list), or refresh this page.
        </div>
      </div>
    </div>
  );
}
