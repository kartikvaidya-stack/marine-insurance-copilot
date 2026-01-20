import { listClaims } from "@/lib/claimStore";
import DraftActionsClient from "./draft-actions-client";

function fmt(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  // Force consistent formatting (avoid hydration issues)
  return d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

function overdue(dueAt: string) {
  const t = new Date(dueAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() > t;
}

type Row = {
  claimId: string;
  vessel: string;
  line: string;
  status: string;
  incident: string;
  location: string;
  dateTime: string;
  r: any;
  isOverdue: boolean;
};

export default async function RemindersPage() {
  const claims = await listClaims();

  const rows: Row[] = [];
  for (const c of claims) {
    const rems = Array.isArray((c as any).reminders) ? (c as any).reminders : [];
    for (const r of rems) {
      if (!r || r.status === "done") continue;
      rows.push({
        claimId: c.id,
        vessel: c.report?.vessel || "—",
        line: c.meta?.line_primary || "—",
        status: c.meta?.status || "open",
        incident: c.report?.incident_type || "—",
        location: c.report?.location || "—",
        dateTime: c.report?.date_time || "—",
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
          <p className="text-sm text-gray-600">
            Follow-ups across all claims (pending only). Draft emails straight from here.
          </p>
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
                  <th className="text-left font-medium px-3 py-2">Vessel / Incident</th>
                  <th className="text-left font-medium px-3 py-2">To / Subject</th>
                  <th className="text-left font-medium px-3 py-2">Draft emails</th>
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
                        {x.isOverdue ? "OVERDUE" : "Pending"} • {x.r.channel || "email"} •{" "}
                        {String(x.status).toUpperCase()}
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <a
                        className="text-blue-700 hover:underline font-semibold"
                        href={`/claims/${encodeURIComponent(x.claimId)}`}
                      >
                        {x.claimId}
                      </a>
                      <div className="text-xs text-gray-600 mt-1">
                        {x.line} • {x.location}
                      </div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="font-semibold">{x.vessel}</div>
                      <div className="text-xs text-gray-600 mt-1">{x.incident}</div>
                      <div className="text-xs text-gray-500 mt-1">DoI: {x.dateTime}</div>
                    </td>

                    <td className="px-3 py-2">
                      <div className="font-semibold">{x.r.to}</div>
                      <div className="text-xs text-gray-700 mt-1">{x.r.subject}</div>
                      {x.r.context && (
                        <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">
                          {x.r.context}
                        </div>
                      )}
                    </td>

                    <td className="px-3 py-2">
                      <DraftActions
                        claimId={x.claimId}
                        to={x.r.to}
                        subject={x.r.subject}
                        context={x.r.context || ""}
                        reminderId={x.r.id}
                      />
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

      <div className="text-xs text-gray-500">
        Tip: drafts are saved into the claim’s “Email Drafts” section.
      </div>
    </div>
  );
}

/**
 * Client component embedded in server page.
 */
function DraftActions(props: {
  claimId: string;
  to: string;
  subject: string;
  context: string;
  reminderId?: string;
}) {
  return (
    // @ts-expect-error Server/Client boundary handled by Next
    <DraftActionsClient {...props} />
  );
}
