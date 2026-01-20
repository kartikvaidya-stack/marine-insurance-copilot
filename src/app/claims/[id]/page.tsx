import { listClaims } from "@/lib/claimStore";
import TaskChecklist from "./task-checklist";
import ClaimControls from "./claim-controls";
import DraftsPanel from "./drafts-panel";
import ReminderQuickAdd from "./reminder-quick-add";

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const p = await params; // Next 16.1: params is a Promise
  const id = decodeURIComponent(String(p?.id || "").trim());

  if (!id) {
    return (
      <div className="grid gap-4">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold">Claim not found</h2>
          <p className="text-sm text-gray-600 mt-2">No claim ID provided.</p>
          <a className="inline-block mt-4 text-blue-700 hover:underline" href="/claims">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const claims = await listClaims();
  const claim: any = claims.find((c: any) => c?.id === id);

  if (!claim) {
    return (
      <div className="grid gap-4">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold">Claim not found</h2>
          <p className="text-sm text-gray-600 mt-2">
            No claim exists with ID: <span className="font-semibold">{id}</span>
          </p>
          <a className="inline-block mt-4 text-blue-700 hover:underline" href="/claims">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const fin = claim.financials || {};
  const meta = claim.meta || {};

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">{claim.id}</h2>
          <p className="text-sm text-gray-600">
            {claim.report?.vessel || "—"} • {claim.report?.incident_type || "—"} •{" "}
            {meta.line_primary || "—"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Status: <span className="font-semibold">{meta.status || "open"}</span> • Stage:{" "}
            <span className="font-semibold">{meta.stage || "intake"}</span>
          </p>
        </div>

        <div className="flex gap-3">
          <a className="text-sm text-blue-700 hover:underline" href="/claims">
            ← Back
          </a>
          <a className="text-sm text-blue-700 hover:underline" href="/finance">
            $ Dashboard
          </a>
          <a className="text-sm text-blue-700 hover:underline" href="/reminders">
            Reminders
          </a>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold">Summary</h3>
        <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
          {claim.report?.summary || claim.narrative || "—"}
        </p>

        <div className="grid md:grid-cols-3 gap-3 mt-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">Date/Time</div>
            <div>{claim.report?.date_time || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Location</div>
            <div>{claim.report?.location || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">External Ref</div>
            <div>{meta.reference_external || "—"}</div>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3 mt-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">Claim Value</div>
            <div>{(fin.currency || "USD").toUpperCase()} {Number(fin.claim_value || 0).toLocaleString("en-US")}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Reserve</div>
            <div>{(fin.currency || "USD").toUpperCase()} {Number(fin.reserve || 0).toLocaleString("en-US")}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Paid</div>
            <div>{(fin.currency || "USD").toUpperCase()} {Number(fin.paid || 0).toLocaleString("en-US")}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Recovery Received</div>
            <div>{(fin.currency || "USD").toUpperCase()} {Number(fin.recovery_received || 0).toLocaleString("en-US")}</div>
          </div>
        </div>
      </div>

      {/* Operations */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ClaimControls claim={claim} />
        <TaskChecklist claimId={claim.id} tasks={claim.tasks || []} />
      </div>

      {/* Reminders + Drafts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <ReminderQuickAdd claimId={claim.id} />
        <DraftsPanel claim={claim} />
      </div>

      {/* Coverage & Docs */}
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="text-lg font-semibold">Coverage & Documents</h3>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-sm font-semibold mb-2">Coverage reasoning</div>
            <pre className="text-xs bg-gray-50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap">
{JSON.stringify(claim.report?.coverage_reasoning || {}, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-sm font-semibold mb-2">Documents checklist</div>
            <pre className="text-xs bg-gray-50 border rounded-lg p-3 overflow-auto whitespace-pre-wrap">
{JSON.stringify(claim.report?.documents_checklist || {}, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
