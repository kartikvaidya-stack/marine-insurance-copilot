import Link from "next/link";
import { notFound } from "next/navigation";
import { getClaimById } from "@/lib/claimStore";

import TaskChecklist from "./task-checklist";
import ClaimControls from "./claim-controls";
import ReminderQuickAdd from "./reminder-quick-add";
import DraftsPanel from "./drafts-panel";

export default async function ClaimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = raw ? decodeURIComponent(String(raw)) : "";

  const claim = await getClaimById(id);
  if (!claim) return notFound();

  const vessel = claim.report?.vessel || "—";
  const incident = claim.report?.incident_type || "—";
  const location = claim.report?.location || "—";

  return (
    <div className="grid gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold">Claim {claim.id}</h2>
          <p className="text-sm text-gray-600">
            {vessel} • {incident} • {location}
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <Link className="text-blue-700 hover:underline" href="/claims">
            ← Back to Claims
          </Link>
          <Link className="text-blue-700 hover:underline" href="/finance">
            $ Dashboard
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow p-6">
        <ClaimControls claim={claim} />
      </div>

      {/* Tasks */}
      <div className="bg-white rounded-xl shadow p-6">
        <TaskChecklist claimId={claim.id} tasks={claim.tasks || []} reminders={claim.reminders || []} />
      </div>

      {/* Reminders + Drafts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow p-6">
          <ReminderQuickAdd
            claimId={claim.id}
            vessel={vessel}
            incident={incident}
            location={location}
          />
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <DraftsPanel claimId={claim.id} drafts={claim.drafts || []} />
        </div>
      </div>
    </div>
  );
}
