import { NextResponse } from "next/server";
import { updateClaimFields } from "@/lib/claimStore";

const FIN_KEYS = [
  "currency",
  "claim_value",
  "reserve",
  "paid",
  "deductible",
  "recovery_expected",
  "recovery_received",
];

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const claimId = String(body?.claimId || "").trim();
    const metaIn = body?.meta || {};
    const finIn = body?.financials || {};

    if (!claimId) {
      return NextResponse.json({ error: "Missing claimId" }, { status: 400 });
    }

    // Only keep known keys (prevents accidental junk), but includes recoveries.
    const financials: Record<string, any> = {};
    for (const k of FIN_KEYS) {
      if (k in finIn) financials[k] = finIn[k];
    }

    const meta = metaIn || {};

    const updated = await updateClaimFields(claimId, { meta, financials });

    if (!updated) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, claim: updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Unhandled server error in /api/claims/update",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
