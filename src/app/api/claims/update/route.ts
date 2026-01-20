import { NextResponse } from "next/server";
import { updateClaimFields, ClaimFinancials, ClaimMeta } from "@/lib/claimStore";

export const runtime = "nodejs";

type UpdateBody = {
  claimId?: string;
  meta?: Partial<ClaimMeta>;
  financials?: Partial<ClaimFinancials>;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as UpdateBody;

    const claimId = String(body?.claimId || "").trim();
    if (!claimId) {
      return NextResponse.json({ error: "Missing claimId" }, { status: 400 });
    }

    const updated = await updateClaimFields(claimId, {
      meta: body.meta,
      financials: body.financials,
    });

    if (!updated) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, claim: updated }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Unhandled error updating claim", details: msg }, { status: 500 });
  }
}
