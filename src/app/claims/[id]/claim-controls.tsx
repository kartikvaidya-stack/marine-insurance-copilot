"use client";

import { useMemo, useState } from "react";

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function ClaimControls({ claim }: { claim: any }) {
  const meta0 = claim?.meta || {};
  const fin0 = claim?.financials || {};

  const STAGES = useMemo(
    () => [
      "intake",
      "notified",
      "survey",
      "documents",
      "reserve",
      "settlement",
      "closed",
    ],
    []
  );

  const STATUSES = useMemo(() => ["open", "in-progress", "closedS", "closed"], []);
  // Note: "S" typo protection; we normalize below

  const [status, setStatus] = useState<string>(meta0.status || "open");
  const [stage, setStage] = useState<string>(meta0.stage || "intake");
  const [linePrimary, setLinePrimary] = useState<string>(meta0.line_primary || "—");
  const [externalRef, setExternalRef] = useState<string>(meta0.reference_external || "");
  const [handler, setHandler] = useState<string>(meta0.handler || "");
  const [counterparty, setCounterparty] = useState<string>(meta0.counterparty || "");

  const [currency, setCurrency] = useState<string>(fin0.currency || "USD");
  const [claimValue, setClaimValue] = useState<string>(String(fin0.claim_value ?? 0));
  const [reserve, setReserve] = useState<string>(String(fin0.reserve ?? 0));
  const [paid, setPaid] = useState<string>(String(fin0.paid ?? 0));
  const [deductible, setDeductible] = useState<string>(String(fin0.deductible ?? 0));
  const [recoveryExpected, setRecoveryExpected] = useState<string>(
    String(fin0.recovery_expected ?? 0)
  );
  const [recoveryReceived, setRecoveryReceived] = useState<string>(
    String(fin0.recovery_received ?? 0)
  );

  const [msg, setMsg] = useState<string>("");

  async function save() {
    setMsg("Saving...");

    // Normalize status if someone accidentally had weird value
    const cleanStatus = status === "S" || status === "R" || status === "T" ? "open" : status;

    const payload = {
      claimId: claim.id,
      meta: {
        status: cleanStatus,
        stage,
        line_primary: linePrimary,
        reference_external: externalRef,
        handler,
        counterparty,
      },
      financials: {
        currency,
        claim_value: num(claimValue),
        reserve: num(reserve),
        paid: num(paid),
        deductible: num(deductible),
        recovery_expected: num(recoveryExpected),
        recovery_received: num(recoveryReceived),
      },
    };

    try {
      const res = await fetch("/api/claims/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        setMsg("Save failed: API did not return JSON.");
        return;
      }

      if (!res.ok) {
        setMsg(`Save failed: ${json?.error || "Unknown"}${json?.details ? " — " + json.details : ""}`);
        return;
      }

      setMsg("Saved ✓");
      // Force refresh so Server Component (claim page) pulls latest .data file.
      window.location.reload();
    } catch (e: any) {
      setMsg(`Save failed: ${e?.message || "Unknown error"}`);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Claim Controls</h3>
          <p className="text-xs text-gray-500 mt-1">Update status, stage, financials (incl. paid & recoveries).</p>
        </div>
        <div className="text-xs text-gray-600">{msg}</div>
      </div>

      <div className="mt-4 grid gap-4">
        {/* Meta */}
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Status</div>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {["open", "in-progress", "closed"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Stage</div>
            <select
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Primary line</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={linePrimary}
              onChange={(e) => setLinePrimary(e.target.value)}
              placeholder="P&I / H&M / Charterers Liability"
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">External reference</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={externalRef}
              onChange={(e) => setExternalRef(e.target.value)}
              placeholder="Club ref / broker ref"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Handler</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={handler}
              onChange={(e) => setHandler(e.target.value)}
              placeholder="Assigned handler"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Counterparty</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              placeholder="Ship manager / terminal / charterer"
            />
          </div>
        </div>

        {/* Financials */}
        <div className="grid md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Currency</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              placeholder="USD"
            />
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Claim value</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={claimValue}
              onChange={(e) => setClaimValue(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Reserve</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={reserve}
              onChange={(e) => setReserve(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Paid</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Deductible</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={deductible}
              onChange={(e) => setDeductible(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Recovery expected</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={recoveryExpected}
              onChange={(e) => setRecoveryExpected(e.target.value)}
            />
          </div>

          <div>
            <div className="text-xs text-gray-500 mb-1">Recovery received</div>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm"
              value={recoveryReceived}
              onChange={(e) => setRecoveryReceived(e.target.value)}
            />
          </div>
        </div>

        <button
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
          onClick={save}
        >
          Save changes
        </button>

        <div className="text-[11px] text-gray-500">
          If a number is blank/invalid, it saves as 0. This avoids “string vs number” bugs in the file store.
        </div>
      </div>
    </div>
  );
}
