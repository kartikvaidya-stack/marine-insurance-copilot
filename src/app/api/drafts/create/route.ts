import { NextResponse } from "next/server";
import OpenAI from "openai";
import { addDraft, getClaimById } from "@/lib/claimStore";

export const runtime = "nodejs";

type Body = {
  claimId?: string;
  type?: string; // "reminder" etc
  to?: string;
  subject?: string;
  context?: string; // user notes
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const claimId = String(body?.claimId || "").trim();
    const type = String(body?.type || "reminder").trim() as any;

    if (!claimId) {
      return NextResponse.json({ error: "Missing claimId" }, { status: 400 });
    }

    const claim = await getClaimById(claimId);
    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // If you already have OPENAI_API_KEY in .env.local, this works.
    // If not, we'll still create a basic draft without AI.
    const apiKey = process.env.OPENAI_API_KEY;

    let to = String(body?.to || "P&I Club / Underwriters / Broker").trim();
    let subject = String(body?.subject || `Claim ${claimId} – Follow Up`).trim();
    let context = String(body?.context || "").trim();

    let draftBody = `Dear [Recipient],\n\nPlease see our follow up for Claim ${claimId}.\n\n${context ? context + "\n\n" : ""}Best regards,\n\n[Your Name]\nNova Carriers\n`;

    if (apiKey) {
      try {
        const client = new OpenAI({ apiKey });

        const prompt = `
You are a marine insurance claims professional drafting a clear, polite email.

Claim ID: ${claim.id}
Vessel: ${claim.report?.vessel || ""}
Incident: ${claim.report?.incident_type || ""}
Location: ${claim.report?.location || ""}
Date/Time (ISO): ${claim.report?.date_time || ""}
Summary: ${claim.report?.summary || ""}

User context / request:
${context || "(none)"}

Write a concise email draft with:
- subject line consistent with the subject we pass
- a short incident reference
- specific request for missing info/docs if present
- professional closing
`;

        const resp = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        });

        const ai = resp.choices?.[0]?.message?.content?.trim();
        if (ai) draftBody = ai;
      } catch {
        // fall back to basic draftBody
      }
    }

    const created = await addDraft(claimId, {
      type,
      to,
      subject,
      body: draftBody,
    });

    if (!created) {
      return NextResponse.json({ error: "Failed to create draft" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, draft: created }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Unhandled error creating draft", details: msg }, { status: 500 });
  }
}
