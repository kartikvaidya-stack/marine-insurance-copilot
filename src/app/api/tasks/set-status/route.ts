import { NextResponse } from "next/server";
import { setTaskStatus } from "@/lib/claimStore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const claimId = String(body?.claimId || "").trim();
    const taskId = String(body?.taskId || "").trim();
    const status = body?.status as "open" | "done";

    if (!claimId || !taskId || (status !== "open" && status !== "done")) {
      return NextResponse.json(
        { error: "Missing/invalid claimId, taskId, or status (open|done)" },
        { status: 400 }
      );
    }

    const updated = await setTaskStatus(claimId, taskId, status);
    if (!updated) {
      return NextResponse.json({ error: "Claim or task not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unhandled error updating task status", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
