import { NextResponse } from "next/server";
import { addReminder } from "@/lib/claimStore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const claimId = String(body?.claimId || "").trim();
    const reminder = body?.reminder;

    if (!claimId || !reminder) {
      return NextResponse.json({ error: "Missing claimId or reminder" }, { status: 400 });
    }

    const created = await addReminder(claimId, reminder);
    if (!created) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, reminder: created }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unhandled error adding reminder", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
