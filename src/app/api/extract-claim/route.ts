import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClaim } from "@/lib/claimStore";
import type { ClaimReport } from "@/lib/claimStore";

export const runtime = "nodejs";

type ExtractReq = {
  incidentText?: string;
};

function fallbackReport(incidentText: string): ClaimReport {
  // Minimal safe defaults so createClaim() always has a valid report
  return {
    incident_type: "Unknown / To be confirmed",
    date_time: new Date().toISOString(),
    location: "Unknown",
    vessel: "Unknown",
    summary: incidentText.slice(0, 400),
    potential_claims: ["H&M"],
    immediate_actions:
      "Notify broker/club/underwriters; Preserve evidence; Appoint surveyor; Collect documents; Record chronology.",
    missing_information:
      "Vessel name; exact date/time; exact location; cause; extent of damage; photos; logs; repair estimates; survey report.",
    coverage_reasoning: {
      "H&M": "Potential physical damage / machinery / hull involvement (to be confirmed).",
      "P&I": "Potential third party liability / pollution / personal injury (to be confirmed).",
      "FD&D": "Potential contractual / dispute / recovery issues (to be confirmed).",
    },
    documents_checklist: {
      "H&M": [
        "Master’s statement / incident report",
        "Engine logbook / deck logbook extracts",
        "Photos/videos",
        "Damage report",
        "Repair quotation / estimate",
        "Survey report",
      ],
      "P&I": [
        "Master’s statement / incident report",
        "Statement of facts / chronology",
        "Photos/videos",
        "Correspondence with port/third parties",
        "Any protests / notices",
      ],
      "FD&D": [
        "Relevant contracts (CP/COA/B/L)",
        "Correspondence with counterparties",
        "Timeline / chronology",
        "Evidence supporting recovery",
      ],
    },
  };
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    const cleaned = s
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ExtractReq;
    const incidentText = String(body?.incidentText || "").trim();

    if (!incidentText) {
      return NextResponse.json({ error: "Missing incidentText" }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // 1) Build report (AI if possible, else fallback)
    let report: ClaimReport = fallbackReport(incidentText);

    if (apiKey) {
      try {
        const client = new OpenAI({ apiKey });

        const prompt = `
You are a marine insurance claims assistant.

Return ONLY valid JSON with EXACT keys:
incident_type, date_time (ISO string), location, vessel, summary,
potential_claims (array of strings like "H&M","P&I","FD&D"),
immediate_actions (string), missing_information (string),
coverage_reasoning (object with keys "H&M","P&I","FD&D" as strings),
documents_checklist (object with keys "H&M","P&I","FD&D" each an array of strings).

Incident text:
${incidentText}
`.trim();

        const resp = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        });

        const raw = resp.choices?.[0]?.message?.content?.trim() || "";
        const parsed = safeJsonParse(raw);

        if (parsed && typeof parsed === "object") {
          // Merge into fallback (so missing keys don’t break anything)
          report = {
            ...report,
            ...parsed,
            coverage_reasoning: {
              ...report.coverage_reasoning,
              ...(parsed.coverage_reasoning || {}),
            },
            documents_checklist: {
              ...report.documents_checklist,
              ...(parsed.documents_checklist || {}),
            },
          } as ClaimReport;
        }
      } catch {
        // AI failed; keep fallback report
      }
    }

    // 2) Create claim using the object signature your store expects
    const claim = await createClaim({
      narrative: incidentText,
      report,
    });

    return NextResponse.json({ ok: true, claimId: claim.id, claim }, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Unhandled server error in /api/extract-claim", details: msg },
      { status: 500 }
    );
  }
}
