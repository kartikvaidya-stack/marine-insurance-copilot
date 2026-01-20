"use client";

import { useMemo, useState } from "react";

type Draft = {
  id: string;
  claimId: string;
  createdAt: string;
  type: string;
  to: string;
  subject: string;
  body: string;
  status: "draft" | "sent";
  sentAt?: string;
};

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export default function DraftsPanel({
  claimId,
  drafts,
}: {
  claimId: string;
  drafts: Draft[];
}) {
  const [msg, setMsg] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = Array.isArray(drafts) ? drafts.slice() : [];
    // newest first
    arr.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return arr;
  }, [drafts]);

  async function copy(text: string) {
    setMsg("");
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Copied ✓");
      setTimeout(() => setMsg(""), 1200);
    } catch {
      setMsg("Copy failed (browser blocked clipboard).");
    }
  }

  async function markSent(draftId: string) {
    setMsg("Marking sent...");
    try {
      const res = await fetch("/api/drafts/sent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimId, draftId }),
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

      setMsg("Marked sent ✓ (refresh page)");
    } catch (e: any) {
      setMsg(`Error: ${e?.message || "Failed"}`);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Email Drafts</h3>
          <p className="text-xs text-gray-500 mt-1">
            Drafts saved against this claim. Copy + mark sent.
          </p>
        </div>
        <div className="text-xs text-gray-600">{msg}</div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-sm text-gray-600 mt-4">No drafts yet.</div>
      ) : (
        <ul className="divide-y border rounded-lg mt-4">
          {sorted.map((d) => {
            const isOpen = openId === d.id;
            return (
              <li key={d.id} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          "text-[11px] px-2 py-1 rounded-full " +
                          (d.status === "sent"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800")
                        }
                      >
                        {String(d.type || "draft").toUpperCase()} • {d.status.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        Created: {fmt(d.createdAt)}
                        {d.sentAt ? ` • Sent: ${fmt(d.sentAt)}` : ""}
                      </span>
                    </div>

                    <div className="mt-2 text-sm font-semibold truncate">{d.subject || "(no subject)"}</div>
                    <div className="text-xs text-gray-600 mt-1 truncate">To: {d.to || "—"}</div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      className="text-xs bg-gray-900 text-white px-3 py-2 rounded-md hover:bg-black"
                      onClick={() =>
                        copy(
                          `To: ${d.to}\nSubject: ${d.subject}\n\n${d.body || ""}`
                        )
                      }
                    >
                      Copy
                    </button>

                    <button
                      className="text-xs bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700"
                      onClick={() => setOpenId(isOpen ? null : d.id)}
                    >
                      {isOpen ? "Hide" : "View"}
                    </button>

                    {d.status !== "sent" && (
                      <button
                        className="text-xs bg-green-700 text-white px-3 py-2 rounded-md hover:bg-green-800"
                        onClick={() => markSent(d.id)}
                      >
                        Mark sent
                      </button>
                    )}
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-500 mb-2">
                      Body (editable copy from here if needed)
                    </div>
                    <textarea
                      className="w-full min-h-[180px] text-sm border rounded-lg p-3 font-mono"
                      value={d.body || ""}
                      readOnly
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
