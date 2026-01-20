import { listClaims } from "@/lib/claimStore";

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function money(currency: string, v: any) {
  const n = Number(v);
  const val = Number.isFinite(n) ? n : 0;
  const cur = String(currency || "USD").toUpperCase();
  return `${cur} ${Math.round(val).toLocaleString("en-US")}`;
}

export default async function ClaimsPage() {
  const claims = await listClaims();

  // newest first
  const rows = [...claims].sort(
    (a: any, b: any) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime()
  );

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Claims</h2>
          <p className="text-sm text-gray-600">All claims (local file store).</p>
        </div>
        <div className="flex gap-3">
          <a className="text-sm text-blue-700 hover:underline" href="/">
            New Claim
          </a>
          <a className="text-sm text-blue-700 hover:underline" href="/finance">
            $ Dashboard
          </a>
          <a className="text-sm text-blue-700 hover:underline" href="/reminders">
            Reminders
          </a>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        {rows.length === 0 ? (
          <div className="text-sm text-gray-600">No claims yet.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Claim ID</th>
                  <th className="text-left font-medium px-3 py-2">Vessel</th>
                  <th className="text-left font-medium px-3 py-2">Incident</th>
                  <th className="text-left font-medium px-3 py-2">Line</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-left font-medium px-3 py-2">Stage</th>
                  <th className="text-right font-medium px-3 py-2">Paid</th>
                  <th className="text-right font-medium px-3 py-2">Recovery</th>
                  <th className="text-left font-medium px-3 py-2">Updated</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((c: any) => {
                  const href = `/claims/${encodeURIComponent(c.id)}`; // IMPORTANT
                  const fin = c.financials || {};
                  const meta = c.meta || {};

                  return (
                    <tr key={c.id} className="border-t align-top">
                      <td className="px-3 py-2 font-semibold">
                        <a className="text-blue-700 hover:underline" href={href}>
                          {c.id}
                        </a>
                        <div className="text-xs text-gray-500 mt-1">
                          {c.report?.location || "—"}
                        </div>
                      </td>

                      <td className="px-3 py-2">{c.report?.vessel || "—"}</td>
                      <td className="px-3 py-2">{c.report?.incident_type || "—"}</td>
                      <td className="px-3 py-2">{meta.line_primary || "—"}</td>
                      <td className="px-3 py-2">{meta.status || "open"}</td>
                      <td className="px-3 py-2">{meta.stage || "—"}</td>

                      <td className="px-3 py-2 text-right">
                        {money(fin.currency || "USD", fin.paid)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {money(fin.currency || "USD", fin.recovery_received)}
                      </td>

                      <td className="px-3 py-2 text-gray-600">
                        {fmt(c.updatedAt || c.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
