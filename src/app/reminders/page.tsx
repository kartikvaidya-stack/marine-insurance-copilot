import { listClaims } from "@/lib/claimStore";

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function overdue(dueAt: string) {
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() > t;
}

export default async function RemindersPage() {
  const claims = await listClaims();

  const rows: Array<{
    claimId: string;
    vessel: string;
    line: string;
    status: string;
    r: any;
    isOverdue: boolean;
  }> = [];

  for (const c of claims) {
    const rems = Array.isArray((c as any).reminders) ? (c as any).reminders : [];
    for (const r of rems) {
      if (!r || r.status === "done") continue;
      rows.push({
        claimId: c.id,
        vessel: c.report?.vessel || "—",
        line: c.meta?.line_primary || "—",
        status: c.meta?.status || "open",
        r,
        isOverdue: overdue(r.dueAt),
      });
    }
  }

  rows.sort((a, b) => {
    const ao = a.isOverdue ? 0 : 1;
    const bo = b.isOverdue ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return new Date(a.r.dueAt).getTime() - new Date(b.r.dueAt).getTime();
  });

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Reminders</h2>
          <p className="text-sm text-gray-600">Follow-ups across all claims (pending only).</p>
        </div>
        <div className="flex gap-3">
          <a className="text-sm text-blue-700 hover:underline" href="/claims">
            Claims
          </a>
          <a className="text-sm text-blue-700 hover:underline" href="/finance">
            $ Dashboard
          </a>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        {rows.length === 0 ? (
          <div className="text-sm text-gray-600">No pending reminders.</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left font-medium px-3 py-2">Due</th>
                  <th className="text-left font-medium px-3 py-2">Claim</th>
                  <th className="text-left font-medium px-3 py-2">Vessel</th>
                  <th className="text-left font-medium px-3 py-2">Line</th>
                  <th className="text-left font-medium px-3 py-2">To</th>
                  <th className="text-left font-medium px-3 py-2">Subject</th>
                  <th className="text-left font-medium px-3 py-2">Open</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((x) => (
                  <tr key={x.r.id} className="border-t align-top">
                    <td className="px-3 py-2">
                      <div className={x.isOverdue ? "text-red-700 font-semibold" : ""}>
                        {fmt(x.r.dueAt)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {x.isOverdue ? "OVERDUE" : "Pending"} • {x.r.channel || "email"}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-semibold">
                      <a className="text-blue-700 hover:underline" href={`/claims/${encodeURIComponent(x.claimId)}`}>
                        {x.claimId}
                      </a>
                      <div className="text-xs text-gray-500 mt-1">Status: {x.status}</div>
                    </td>
                    <td className="px-3 py-2">{x.vessel}</td>
                    <td className="px-3 py-2">{x.line}</td>
                    <td className="px-3 py-2">{x.r.to}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{x.r.subject}</div>
                      <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{x.r.context}</div>
                    </td>
                    <td className="px-3 py-2">
                      <a
                        className="inline-block text-sm bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700"
                        href={`/claims/${encodeURIComponent(x.claimId)}`}
                      >
                        Open claim
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
