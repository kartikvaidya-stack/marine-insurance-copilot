import { NextResponse } from "next/server";
import { markDraftSent } from "@/lib/claimStore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const claimId = String(body?.claimId || "").trim();
    const draftId = String(body?.draftId || "").trim();

    if (!claimId || !draftId) {
      return NextResponse.json({ error: "Missing claimId or draftId" }, { status: 400 });
    }

    const updated = await markDraftSent(claimId, draftId);
    if (!updated) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, claim: updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unhandled error marking draft sent", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
