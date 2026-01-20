import { NextResponse } from "next/server";
import { updateTaskStatus } from "@/lib/claimStore";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      claimId?: string;
      taskId?: string;
      status?: "open" | "done";
    };

    const claimId = String(body?.claimId || "").trim();
    const taskId = String(body?.taskId || "").trim();
    const status = body?.status;

    if (!claimId || !taskId || (status !== "open" && status !== "done")) {
      return NextResponse.json(
        { error: "Missing/invalid claimId, taskId or status" },
        { status: 400 }
      );
    }

    const updated = await updateTaskStatus(claimId, taskId, status);

    if (!updated) {
      return NextResponse.json(
        { error: "Claim or task not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, task: updated }, { status: 200 });
  } catch (err: unknown) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Unhandled server error in /api/tasks/set-status", details },
      { status: 500 }
    );
  }
}
