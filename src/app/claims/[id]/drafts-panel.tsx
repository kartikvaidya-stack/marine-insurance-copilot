"use client";

import { useMemo, useState } from "react";

type StoreDraft = {
  id: string;
  createdAt?: string;
  type: string; // "reminder" | "notification" | "update" | etc.
  to: string;
  subject: string;
  body: string;
  sentAt?: string;
  // NOTE: no claimId here (drafts live inside the claim)
};

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

  const ct = res.headers.get("content-type") || "";
  const text = await res.text();
  const isJson = ct.includes("application/json");

  if (!res.ok) {
    throw new Error(isJson ? text : `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return isJson ? JSON.parse(text) : text;
}

export default function DraftsPanel(props: { claimId: string; drafts: StoreDraft[] }) {
  const claimId = props.claimId;
  const drafts = useMemo(() => (Array.isArray(props.drafts) ? props.drafts : []), [props.drafts]);

  const [selectedId, setSelectedId] = useState<string>(drafts[0]?.id || "");
  const [status, setStatus] = useState<string>("");

  const selected = drafts.find((d) => d.id === selectedId) || drafts[0];

  async function markSent(draftId: string) {
    setStatus("Marking as sent...");
    try {
      await postJSON("/api/drafts/sent", { claimId, draftId });
      setStatus("Marked sent. Refresh page to see updated timestamp.");
      setTimeout(() => setStatus(""), 1200);
    } catch (e: any) {
      setStatus(`Failed: ${e?.message || String(e)}`);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied");
      setTimeout(() => setStatus(""), 800);
    } catch {
      setStatus("Copy failed (browser blocked clipboard)");
      setTimeout(() => setStatus(""), 1200);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Drafts</h3>
          <p className="text-sm text-gray-600">Email drafts generated for this claim.</p>
        </div>
        <div className="text-xs text-gray-500">{status}</div>
      </div>

      {drafts.length === 0 ? (
        <div className="text-sm text-gray-600">No drafts yet.</div>
      ) : (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm text-gray-600">Select:</label>
            <select
              className="border rounded-md px-2 py-1 text-sm bg-white"
              value={selected?.id || ""}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {drafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.type} • {d.subject.slice(0, 40)}
                </option>
              ))}
            </select>

            <button
              className="text-sm bg-gray-900 text-white px-3 py-2 rounded-md hover:bg-black"
              onClick={() => selected && copy(selected.body)}
              disabled={!selected}
            >
              Copy body
            </button>

            <button
              className="text-sm bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700"
              onClick={() => selected && markSent(selected.id)}
              disabled={!selected}
            >
              Mark sent
            </button>
          </div>

          {selected ? (
            <div className="border rounded-xl p-4 bg-white">
              <div className="grid gap-2">
                <div className="text-xs text-gray-500">
                  Created: {fmt(selected.createdAt)} • Sent: {fmt(selected.sentAt)}
                </div>

                <div className="text-sm">
                  <div>
                    <span className="text-gray-600">To:</span>{" "}
                    <span className="font-semibold">{selected.to}</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-gray-600">Subject:</span>{" "}
                    <span className="font-semibold">{selected.subject}</span>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="text-xs text-gray-600 mb-1">Body</div>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 border rounded-lg p-3">
                    {selected.body}
                  </pre>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
