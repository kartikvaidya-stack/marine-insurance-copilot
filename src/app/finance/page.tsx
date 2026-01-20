import { listClaims } from "@/lib/claimStore";

function money(n: any) {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return 0;
  return v;
}

function fmtMoney(currency: string, v: number) {
  return `${currency} ${v.toLocaleString()}`;
}

function exposure(c: any) {
  const f = c?.financials || {};
  // Simple operational exposure model
  // exposure = reserve - paid - deductible + recovery_expected - recovery_received
  return (
    money(f.reserve) -
    money(f.paid) -
    money(f.deductible) +
    money(f.recovery_expected) -
    money(f.recovery_received)
  );
}

type Bucket = {
  count: number;
  reserve: number;
  paid: number;
  claim_value: number;
  deductible: number;
  exposure: number;
  recovery_expected: number;
  recovery_received: number;
};

function emptyBucket(): Bucket {
  return {
    count: 0,
    reserve: 0,
    paid: 0,
    claim_value: 0,
    deductible: 0,
    exposure: 0,
    recovery_expected: 0,
    recovery_received: 0,
  };
}

function addTo(b: Bucket, c: any) {
  const f = c?.financials || {};
  b.count += 1;
  b.reserve += money(f.reserve);
  b.paid += money(f.paid);
  b.claim_value += money(f.claim_value);
  b.deductible += money(f.deductible);
  b.recovery_expected += money(f.recovery_expected);
  b.recovery_received += money(f.recovery_received);
  b.exposure += exposure(c);
}

export default async function FinancePage() {
  const claims = await listClaims();

  // NOTE: MVP assumes a single currency; we still show currency field per claim.
  // If mixed currencies, you can later FX-normalize.
  const currency = claims[0]?.financials?.currency || "USD";

  const totals = emptyBucket();
  const openTotals = emptyBucket();
  const closedTotals = emptyBucket();

  const byLine: Record<string, Bucket> = {};
  const byVessel: Record<string, Bucket> = {};
  const byStatus: Record<string, Bucket> = {};

  for (const c of claims) {
    addTo(totals, c);

    const status = c?.meta?.status || "open";
    if (!byStatus[status]) byStatus[status] = emptyBucket();
    addTo(byStatus[status], c);

    if (status === "closed") addTo(closedTotals, c);
    else addTo(openTotals, c);

    const line = c?.meta?.line_primary || "—";
    if (!byLine[line]) byLine[line] = emptyBucket();
    addTo(byLine[line], c);

    const vessel = c?.report?.vessel || "—";
    if (!byVessel[vessel]) byVessel[vessel] = emptyBucket();
    addTo(byVessel[vessel], c);
  }

  const topOpen = claims
    .filter((c: any) => (c?.meta?.status || "open") !== "closed")
    .map((c: any) => ({
      id: c.id,
      vessel: c?.report?.vessel || "—",
      line: c?.meta?.line_primary || "—",
      status: c?.meta?.status || "open",
      reserve: money(c?.financials?.reserve),
      paid: money(c?.financials?.paid),
      claim_value: money(c?.financials?.claim_value),
      deductible: money(c?.financials?.deductible),
      exposure: exposure(c),
      updatedAt: c?.updatedAt || c?.createdAt || "",
    }))
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 10);

  const lineRows = Object.entries(byLine)
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.exposure - a.exposure);

  const vesselRows = Object.entries(byVessel)
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.exposure - a.exposure);

  const statusRows = Object.entries(byStatus)
    .map(([k, v]) => ({ key: k, ...v }))
    .sort((a, b) => b.exposure - a.exposure);

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">$ Dashboard</h2>
          <p className="text-sm text-gray-600">
            Claims exposure, reserves, paid, recoveries — across Nova Carriers.
          </p>
        </div>
        <div className="flex gap-3">
          <a className="text-sm text-blue-700 hover:underline" href="/claims">
            Claims
          </a>
          <a className="text-sm text-blue-700 hover:underline" href="/reminders">
            Reminders
          </a>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-xs text-gray-500">Total exposure (simple)</div>
          <div className="text-2xl font-semibold mt-2">{fmtMoney(currency, totals.exposure)}</div>
          <div className="text-xs text-gray-500 mt-2">All claims • Count: {totals.count}</div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-xs text-gray-500">Open exposure</div>
          <div className="text-2xl font-semibold mt-2">{fmtMoney(currency, openTotals.exposure)}</div>
          <div className="text-xs text-gray-500 mt-2">
            Open/in-progress • Count: {openTotals.count}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <div className="text-xs text-gray-500">Closed (paid vs recovery)</div>
          <div className="text-2xl font-semibold mt-2">
            {fmtMoney(currency, closedTotals.paid)} paid
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Recovery received: {fmtMoney(currency, closedTotals.recovery_received)} • Count:{" "}
            {closedTotals.count}
          </div>
        </div>
      </div>

      {/* Breakdowns */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold">By status</h3>
          <div className="overflow-auto mt-3">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-right font-medium px-3 py-2">Count</th>
                  <th className="text-right font-medium px-3 py-2">Reserve</th>
                  <th className="text-right font-medium px-3 py-2">Paid</th>
                  <th className="text-right font-medium px-3 py-2">Exposure</th>
                </tr>
              </thead>
              <tbody>
                {statusRows.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="px-3 py-2 font-semibold">{r.key}</td>
                    <td className="px-3 py-2 text-right">{r.count}</td>
                    <td className="px-3 py-2 text-right">{money(r.reserve).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{money(r.paid).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(r.exposure).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-[11px] text-gray-500 mt-3">
            Exposure = reserve - paid - deductible + recovery_expected - recovery_received (MVP).
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="text-lg font-semibold">By line (primary)</h3>
          <div className="overflow-auto mt-3">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Line</th>
                  <th className="text-right font-medium px-3 py-2">Count</th>
                  <th className="text-right font-medium px-3 py-2">Reserve</th>
                  <th className="text-right font-medium px-3 py-2">Paid</th>
                  <th className="text-right font-medium px-3 py-2">Exposure</th>
                </tr>
              </thead>
              <tbody>
                {lineRows.map((r) => (
                  <tr key={r.key} className="border-t">
                    <td className="px-3 py-2 font-semibold">{r.key}</td>
                    <td className="px-3 py-2 text-right">{r.count}</td>
                    <td className="px-3 py-2 text-right">{money(r.reserve).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{money(r.paid).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(r.exposure).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Vessel breakdown */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold">By vessel</h3>
        <div className="overflow-auto mt-3">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-medium px-3 py-2">Vessel</th>
                <th className="text-right font-medium px-3 py-2">Count</th>
                <th className="text-right font-medium px-3 py-2">Reserve</th>
                <th className="text-right font-medium px-3 py-2">Paid</th>
                <th className="text-right font-medium px-3 py-2">Exposure</th>
              </tr>
            </thead>
            <tbody>
              {vesselRows.map((r) => (
                <tr key={r.key} className="border-t">
                  <td className="px-3 py-2 font-semibold">{r.key}</td>
                  <td className="px-3 py-2 text-right">{r.count}</td>
                  <td className="px-3 py-2 text-right">{money(r.reserve).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right">{money(r.paid).toLocaleString()}</td>
                  <td className="px-3 py-2 text-right font-semibold">{money(r.exposure).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top exposure */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold">Top 10 open exposures</h3>
        <p className="text-xs text-gray-500 mt-1">
          Largest operational exposures among open/in-progress claims.
        </p>

        {topOpen.length === 0 ? (
          <div className="text-sm text-gray-600 mt-4">No open claims.</div>
        ) : (
          <div className="overflow-auto mt-3">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Claim</th>
                  <th className="text-left font-medium px-3 py-2">Vessel</th>
                  <th className="text-left font-medium px-3 py-2">Line</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-right font-medium px-3 py-2">Exposure</th>
                  <th className="text-right font-medium px-3 py-2">Reserve</th>
                  <th className="text-right font-medium px-3 py-2">Paid</th>
                  <th className="text-right font-medium px-3 py-2">Deductible</th>
                </tr>
              </thead>
              <tbody>
                {topOpen.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2 font-semibold">
                      <a className="text-blue-700 hover:underline" href={`/claims/${encodeURIComponent(r.id)}`}>
                        {r.id}
                      </a>
                    </td>
                    <td className="px-3 py-2">{r.vessel}</td>
                    <td className="px-3 py-2">{r.line}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2 text-right font-semibold">{money(r.exposure).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{money(r.reserve).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{money(r.paid).toLocaleString()}</td>
                    <td className="px-3 py-2 text-right">{money(r.deductible).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-[11px] text-gray-500">
        MVP note: This dashboard assumes one currency. If you store SGD/INR/HKD, we’ll add FX normalization next.
      </div>
    </div>
  );
}
