import { NextResponse } from "next/server";
import { markReminderDone } from "@/lib/claimStore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const claimId = String(body?.claimId || "").trim();
    const reminderId = String(body?.reminderId || "").trim();

    if (!claimId || !reminderId) {
      return NextResponse.json({ error: "Missing claimId or reminderId" }, { status: 400 });
    }

    const updated = await markReminderDone(claimId, reminderId);
    if (!updated) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, claim: updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unhandled error marking reminder done", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
