"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ExtractResponse =
  | { claimId: string; report?: unknown }
  | { error: string; details?: string };

export default function ClaimIntake() {
  const router = useRouter();
  const [incidentText, setIncidentText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return incidentText.trim().length >= 10 && !isLoading;
  }, [incidentText, isLoading]);

  async function onSubmit() {
    setErr(null);
    setOk(null);

    const text = incidentText.trim();
    if (text.length < 10) {
      setErr("Please enter at least a short incident description (10+ characters).");
      return;
    }

    setIsLoading(true);

    try {
      // IMPORTANT: make sure we always see failures
      const res = await fetch("/api/extract-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incidentText: text }),
      });

      const data = (await res.json()) as ExtractResponse;

      if (!res.ok) {
        const msg =
          "error" in data
            ? `${data.error}${data.details ? ` — ${data.details}` : ""}`
            : `Request failed (${res.status})`;
        setErr(msg);
        return;
      }

      if (!("claimId" in data) || !data.claimId) {
        setErr("API returned OK but missing claimId. Check /api/extract-claim response.");
        return;
      }

      setOk(`Created: ${data.claimId}`);
      // Navigate immediately
      router.push(`/claims/${encodeURIComponent(data.claimId)}`);
      router.refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(`Client error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6 grid gap-4">
      <div>
        <h1 className="text-xl font-semibold">Nova Carrier – New Claim</h1>
        <p className="text-sm text-gray-600">
          Paste the initial incident notification or type what happened.
        </p>
      </div>

      <textarea
        className="w-full min-h-[180px] rounded-lg border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
        placeholder="During berthing at Qingdao on 12 Jan 2026, vessel contacted quay fender..."
        value={incidentText}
        onChange={(e) => setIncidentText(e.target.value)}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className={[
            "px-4 py-2 rounded-lg text-sm font-medium",
            canSubmit ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-200 text-gray-500",
          ].join(" ")}
        >
          {isLoading ? "Creating..." : "Create Claim"}
        </button>

        <div className="text-xs text-gray-500">
          {isLoading ? "Calling /api/extract-claim…" : "(MVP: saved in store — DB later)"}
        </div>
      </div>

      {err ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
          {err}
        </div>
      ) : null}

      {ok ? (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
          {ok}
        </div>
      ) : null}
    </div>
  );
}
