import { NextResponse } from "next/server";
import OpenAI from "openai";
import { addDraft, getClaim } from "@/lib/claimStore";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

    const body = await req.json();
    const claimId = String(body?.claimId || "").trim();
    const intent = String(body?.intent || "reminder").trim();
    const to = String(body?.to || "Unknown recipient").trim();
    const subjectHint = String(body?.subjectHint || "").trim();
    const context = String(body?.context || "").trim();

    if (!claimId) return NextResponse.json({ error: "Missing claimId" }, { status: 400 });

    const claim = await getClaim(claimId);
    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

    const openai = new OpenAI({ apiKey });

    const prompt = `
You are a senior marine insurance claims handler drafting professional emails for Nova Carriers.

Constraints:
- Clear subject line
- Short paragraphs
- Bullet points for documents/info requested
- Professional tone (P&I / H&M context)
- Do not invent facts not in claim narrative/report; if needed, request them.

Claim ID: ${claim.id}
Vessel: ${claim.report.vessel}
Incident: ${claim.report.incident_type}
Location: ${claim.report.location}
Date/Time: ${claim.report.date_time}

Narrative:
${claim.narrative}

Key missing info:
${claim.report.missing_information}

Intent: ${intent}
Recipient: ${to}
Subject hint: ${subjectHint}
Additional context: ${context}

Return STRICT JSON:
{"subject":"...","body":"..."}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return NextResponse.json({ error: "Draft model output not JSON", raw }, { status: 500 });
    }

    const jsonLike = raw.slice(start, end + 1).replace(/,\s*([}\]])/g, "$1");
    const parsed = JSON.parse(jsonLike);

    const saved = await addDraft(claimId, {
      type: intent === "task_followup" ? "task_followup" : intent === "club_notification" ? "club_notification" : "reminder",
      to,
      subject: parsed.subject || subjectHint || `Claim ${claimId} – Follow-up`,
      body: parsed.body || "",
    });

    return NextResponse.json({ ok: true, draft: saved }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unhandled error creating draft", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
