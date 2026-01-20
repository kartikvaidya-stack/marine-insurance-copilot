import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClaim } from "@/lib/claimStore";

function extractJsonObject(raw: string) {
  // Grab the first {...} block from the response
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return "";
  return raw.slice(start, end + 1);
}

function repairJson(jsonLike: string) {
  // Fix common LLM JSON issues:
  // 1) trailing commas before } or ]
  // 2) smart quotes
  // 3) BOM / weird whitespace
  return jsonLike
    .replace(/\uFEFF/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, "$1");
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is missing. Check .env.local and restart `npm run dev`." },
        { status: 500 }
      );
    }

    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const incidentText = String(body?.incidentText || "").trim();
    if (!incidentText) {
      return NextResponse.json({ error: "No incident text provided" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    const prompt = `
You are a senior marine insurance claims handler for Nova Carrier.

Return STRICT JSON only (no markdown, no commentary). If unknown, write "Unknown".
Use these allowed insurance lines only: ["P&I","H&M","Charterers Liability","Cargo","FD&D"].

JSON structure:
{
  "incident_type": "",
  "date_time": "",
  "location": "",
  "vessel": "",
  "summary": "",
  "potential_claims": [],
  "immediate_actions": "",
  "missing_information": "",
  "coverage_reasoning": {},
  "documents_checklist": {}
}

Rules:
- potential_claims must include at least 1 allowed line.
- immediate_actions: semicolon-separated checklist (actions to take now).
- missing_information: semicolon-separated missing items.
- coverage_reasoning: object keyed by each line in potential_claims (value = short reasoning).
- documents_checklist: object keyed by each line in potential_claims (value = array of documents/evidence).

Incident description:
"""
${incidentText}
"""
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) {
      return NextResponse.json({ error: "OpenAI returned empty response" }, { status: 500 });
    }

    // ✅ robust parse
    const jsonBlock = extractJsonObject(raw);
    if (!jsonBlock) {
      return NextResponse.json(
        { error: "Could not find JSON in model output", raw },
        { status: 500 }
      );
    }

    const repaired = repairJson(jsonBlock);

    let report: any;
    try {
      report = JSON.parse(repaired);
    } catch {
      return NextResponse.json(
        { error: "Still failed to parse JSON after repair", raw, repaired },
        { status: 500 }
      );
    }

    // Light sanity (keep it simple)
    if (!Array.isArray(report.potential_claims) || report.potential_claims.length === 0) {
      report.potential_claims = ["P&I"]; // fallback
    }
    if (!report.coverage_reasoning || typeof report.coverage_reasoning !== "object") {
      report.coverage_reasoning = {};
    }
    if (!report.documents_checklist || typeof report.documents_checklist !== "object") {
      report.documents_checklist = {};
    }

    const claim = await createClaim(incidentText, report);

    return NextResponse.json({ claimId: claim.id, report: claim.report }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unhandled server error in /api/extract-claim", details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
