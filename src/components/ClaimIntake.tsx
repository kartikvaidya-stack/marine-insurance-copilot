"use client";

import { useState } from "react";

type ClaimReport = {
  incident_type: string;
  date_time: string;
  location: string;
  vessel: string;
  summary: string;
  potential_claims: string[];
  immediate_actions: string;
  missing_information: string;
};

export default function ClaimIntake() {
  const [incidentText, setIncidentText] = useState("");
  const [claimId, setClaimId] = useState<string>("");
  const [report, setReport] = useState<ClaimReport | null>(null);
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleCreateClaim() {
    setLoading(true);
    setErrorText("");
    setReport(null);
    setClaimId("");

    try {
      const res = await fetch("/api/extract-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentText }),
      });

      const text = await res.text();

      if (!res.ok) {
        setErrorText(text || `Server error (${res.status})`);
        return;
      }

      if (!text) {
        setErrorText("Server returned an empty response.");
        return;
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        setErrorText(`Server returned non-JSON:\n${text}`);
        return;
      }

      setClaimId(data.claimId || "");
      setReport((data.report || null) as ClaimReport | null);
    } catch (e: any) {
      setErrorText(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      {/* Intake */}
      <section className="bg-white rounded-xl shadow p-6">
        <h2 className="text-2xl font-semibold mb-1">Nova Carrier – New Claim</h2>
        <p className="text-sm text-gray-600 mb-4">
          Paste the initial incident notification or type what happened.
        </p>

        <textarea
          className="w-full h-48 border rounded-md p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="During berthing at Qingdao on 12 Jan 2026, vessel contacted quay fender..."
          value={incidentText}
          onChange={(e) => setIncidentText(e.target.value)}
        />

        <div className="mt-4 flex items-center gap-3">
          <button
            className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 disabled:opacity-60"
            onClick={handleCreateClaim}
            disabled={loading || !incidentText.trim()}
          >
            {loading ? "Analysing..." : "Create Claim"}
          </button>

          <span className="text-xs text-gray-500">
            (MVP: saved in memory — DB later)
          </span>
        </div>

        {errorText && (
          <div className="mt-4 border border-red-200 bg-red-50 text-red-800 rounded-md p-3 text-sm whitespace-pre-wrap">
            {errorText}
          </div>
        )}
      </section>

      {/* Claim File View */}
      {report && (
        <section className="bg-white rounded-xl shadow p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold">First Report of Claim</h3>
                {claimId && (
                  <span className="text-xs bg-gray-100 border border-gray-200 px-2 py-1 rounded-full">
                    Claim ID: <span className="font-semibold">{claimId}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Generated from initial notification (retain original wording in the claim record).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {report.potential_claims?.map((c) => (
                <span
                  key={c}
                  className="text-xs bg-blue-50 text-blue-900 border border-blue-200 px-2 py-1 rounded-full"
                >
                  {c}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Incident type" value={report.incident_type} />
            <Field label="Date / time" value={report.date_time} />
            <Field label="Location" value={report.location} />
            <Field label="Vessel" value={report.vessel} />
          </div>

          <div className="mt-5">
            <label className="text-xs text-gray-500">Summary</label>
            <div className="mt-1 text-sm text-gray-900 whitespace-pre-wrap border rounded-md p-3 bg-gray-50">
              {report.summary}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Panel title="Immediate actions (next steps)">
              {splitList(report.immediate_actions).map((item, idx) => (
                <li key={idx} className="text-sm text-gray-900">
                  {item}
                </li>
              ))}
            </Panel>

            <Panel title="Missing information">
              {splitList(report.missing_information).map((item, idx) => (
                <li key={idx} className="text-sm text-gray-900">
                  {item}
                </li>
              ))}
            </Panel>
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-900 mt-1 whitespace-pre-wrap">
        {value || "—"}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-gray-500 mb-2">{title}</div>
      <ul className="list-disc pl-5 space-y-1">{children}</ul>
    </div>
  );
}

function splitList(text: string) {
  if (!text) return ["—"];
  const parts = text
    .split(/;|\n|,(?=\s*[A-Z])/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [text];
}
