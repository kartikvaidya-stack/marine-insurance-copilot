// src/lib/claimStore.ts
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { kv } from "@vercel/kv";

export type ClaimStatus = "open" | "in_progress" | "closed";
export type ClaimStage =
  | "intake"
  | "coverage"
  | "survey"
  | "repair"
  | "settlement"
  | "recovery"
  | "closed";

export type ClaimReport = {
  incident_type: string;
  date_time: string;
  location: string;
  vessel: string;
  summary: string;
  potential_claims: string[];
  immediate_actions: string;
  missing_information: string;
  coverage_reasoning?: Record<string, string>;
  documents_checklist?: Record<string, string[]>;
};

export type ClaimMeta = {
  status: ClaimStatus;
  stage: ClaimStage;
  line_primary: string;
  reference_external: string;
  handler: string;
  counterparty: string;
};

export type ClaimFinancials = {
  currency: string;
  claim_value: number;
  reserve: number;
  paid: number;
  deductible: number;
  recovery_expected: number;
  recovery_received: number;
};

export type Task = {
  id: string;
  title: string;
  status: "open" | "done";
  createdAt: string;
  dueAt?: string;
};

export type Reminder = {
  id: string;
  createdAt: string;
  status: "pending" | "done";
  dueAt: string;
  to: string;
  channel?: "email" | "call" | "whatsapp";
  subject: string;
  context: string;
};

export type Draft = {
  id: string;
  claimId: string;
  createdAt: string;
  type: "reminder" | "notification" | "update" | "demand" | "general";
  to: string;
  subject: string;
  body: string;
  status?: "draft" | "sent";
  sentAt?: string;
};

export type TimelineItem = {
  id: string;
  type:
    | "created"
    | "status_changed"
    | "stage_changed"
    | "task_updated"
    | "reminder_added"
    | "reminder_done"
    | "draft_created"
    | "draft_sent"
    | "financials_updated"
    | "meta_updated";
  message: string;
  createdAt: string;
};

export type Claim = {
  id: string;
  createdAt: string;
  updatedAt: string;
  narrative: string;
  report: ClaimReport;
  meta: ClaimMeta;
  financials: ClaimFinancials;
  tasks: Task[];
  reminders: Reminder[];
  drafts: Draft[];
  timeline: TimelineItem[];
};

type Store = { counter: number; claims: Claim[] };

const KV_KEY = "mic:claims:store:v1";

function nowIso() {
  return new Date().toISOString();
}

function rid(prefix: string) {
  return `${prefix}${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isVercelRuntime() {
  // On Vercel, this is always set. Locally it’s usually undefined.
  return Boolean(process.env.VERCEL);
}

async function loadLocalFileStore(): Promise<Store> {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "claims.json");
  try {
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.counter === "number" && Array.isArray(parsed.claims)) {
      return parsed as Store;
    }
  } catch {
    // ignore
  }
  return { counter: 0, claims: [] };
}

async function saveLocalFileStore(store: Store): Promise<void> {
  const dir = path.join(process.cwd(), ".data");
  const file = path.join(dir, "claims.json");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(file, JSON.stringify(store, null, 2), "utf-8");
}

async function loadStore(): Promise<Store> {
  if (isVercelRuntime()) {
    const v = await kv.get<Store>(KV_KEY);
    if (v && typeof v.counter === "number" && Array.isArray(v.claims)) return v;
    return { counter: 0, claims: [] };
  }
  return loadLocalFileStore();
}

async function saveStore(store: Store): Promise<void> {
  if (isVercelRuntime()) {
    await kv.set(KV_KEY, store);
    return;
  }
  await saveLocalFileStore(store);
}

function defaultMeta(partial?: Partial<ClaimMeta>): ClaimMeta {
  return {
    status: partial?.status ?? "open",
    stage: partial?.stage ?? "intake",
    line_primary: partial?.line_primary ?? "H&M",
    reference_external: partial?.reference_external ?? "",
    handler: partial?.handler ?? "",
    counterparty: partial?.counterparty ?? "",
  };
}

function defaultFinancials(partial?: Partial<ClaimFinancials>): ClaimFinancials {
  return {
    currency: partial?.currency ?? "USD",
    claim_value: safeNumber(partial?.claim_value, 0),
    reserve: safeNumber(partial?.reserve, 0),
    paid: safeNumber(partial?.paid, 0),
    deductible: safeNumber(partial?.deductible, 0),
    recovery_expected: safeNumber(partial?.recovery_expected, 0),
    recovery_received: safeNumber(partial?.recovery_received, 0),
  };
}

function defaultReport(narrative: string, partial?: Partial<ClaimReport>): ClaimReport {
  return {
    incident_type: partial?.incident_type ?? "Unknown",
    date_time: partial?.date_time ?? nowIso(),
    location: partial?.location ?? "Unknown",
    vessel: partial?.vessel ?? "Unknown",
    summary: partial?.summary ?? narrative.slice(0, 240),
    potential_claims: Array.isArray(partial?.potential_claims) ? partial!.potential_claims! : [],
    immediate_actions: partial?.immediate_actions ?? "",
    missing_information: partial?.missing_information ?? "",
    coverage_reasoning: partial?.coverage_reasoning ?? {},
    documents_checklist: partial?.documents_checklist ?? {},
  };
}

function makeClaimId(counter: number) {
  // e.g. NC-20260119-0001
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `NC-${y}${m}${day}-${String(counter).padStart(4, "0")}`;
}

function pushTimeline(claim: Claim, type: TimelineItem["type"], message: string) {
  claim.timeline = Array.isArray(claim.timeline) ? claim.timeline : [];
  claim.timeline.unshift({
    id: `${claim.id}-TL-${crypto.randomBytes(4).toString("hex")}`,
    type,
    message,
    createdAt: nowIso(),
  });
}

export async function listClaims(): Promise<Claim[]> {
  const store = await loadStore();
  return store.claims.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getClaimById(id: string): Promise<Claim | null> {
  const store = await loadStore();
  return store.claims.find((c) => c.id === id) ?? null;
}

// The new canonical createClaim signature (object input)
export async function createClaim(input: {
  narrative: string;
  report: ClaimReport;
  tasks?: Task[];
  meta?: Partial<ClaimMeta>;
  financials?: Partial<ClaimFinancials>;
  id?: string;
}): Promise<Claim> {
  const store = await loadStore();
  const nextCounter = (store.counter || 0) + 1;
  store.counter = nextCounter;

  const id = input.id?.trim() || makeClaimId(nextCounter);
  const t = nowIso();

  const claim: Claim = {
    id,
    createdAt: t,
    updatedAt: t,
    narrative: input.narrative,
    report: defaultReport(input.narrative, input.report),
    meta: defaultMeta(input.meta),
    financials: defaultFinancials(input.financials),
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    reminders: [],
    drafts: [],
    timeline: [],
  };

  pushTimeline(claim, "created", "Claim created.");
  store.claims.unshift(claim);
  await saveStore(store);
  return claim;
}

/**
 * Used by /api/claims/update
 * Merge meta + financials partials safely and persist.
 */
export async function updateClaimFields(
  claimId: string,
  patch: {
    meta?: Partial<ClaimMeta>;
    financials?: Partial<ClaimFinancials>;
  }
): Promise<Claim | null> {
  const store = await loadStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const beforeStatus = claim.meta?.status;
  const beforeStage = claim.meta?.stage;

  if (patch.meta) {
    claim.meta = defaultMeta({ ...claim.meta, ...patch.meta });
    pushTimeline(claim, "meta_updated", "Meta updated.");
    if (beforeStatus !== claim.meta.status) {
      pushTimeline(claim, "status_changed", `Status: ${beforeStatus} → ${claim.meta.status}`);
    }
    if (beforeStage !== claim.meta.stage) {
      pushTimeline(claim, "stage_changed", `Stage: ${beforeStage} → ${claim.meta.stage}`);
    }
  }

  if (patch.financials) {
    claim.financials = defaultFinancials({ ...claim.financials, ...patch.financials });
    pushTimeline(claim, "financials_updated", "Financials updated (value/reserve/paid/deductible/recoveries).");
  }

  claim.updatedAt = nowIso();
  await saveStore(store);
  return claim;
}

export async function updateTaskStatus(claimId: string, taskId: string, status: "open" | "done"): Promise<Task | null> {
  const store = await loadStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const tasks = Array.isArray(claim.tasks) ? claim.tasks : [];
  const idx = tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return null;

  tasks[idx] = { ...tasks[idx], status };
  claim.tasks = tasks;
  claim.updatedAt = nowIso();
  pushTimeline(claim, "task_updated", `Task ${taskId} marked ${status}.`);
  await saveStore(store);
  return tasks[idx];
}

export async function addReminder(claimId: string, reminder: Omit<Reminder, "id" | "createdAt" | "status">): Promise<Reminder | null> {
  const store = await loadStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const r: Reminder = {
    id: `${claimId}-R${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    createdAt: nowIso(),
    status: "pending",
    dueAt: reminder.dueAt,
    to: reminder.to,
    channel: reminder.channel ?? "email",
    subject: reminder.subject,
    context: reminder.context,
  };

  claim.reminders = Array.isArray(claim.reminders) ? claim.reminders : [];
  claim.reminders.unshift(r);
  claim.updatedAt = nowIso();
  pushTimeline(claim, "reminder_added", `Reminder created: ${r.subject}.`);
  await saveStore(store);
  return r;
}

export async function markReminderDone(claimId: string, reminderId: string): Promise<Reminder | null> {
  const store = await loadStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const rems = Array.isArray(claim.reminders) ? claim.reminders : [];
  const r = rems.find((x) => x.id === reminderId);
  if (!r) return null;

  r.status = "done";
  claim.updatedAt = nowIso();
  pushTimeline(claim, "reminder_done", `Reminder done: ${r.subject}.`);
  await saveStore(store);
  return r;
}

export async function addDraft(claimId: string, draft: Omit<Draft, "id" | "claimId" | "createdAt" | "status" | "sentAt">): Promise<Draft | null> {
  const store = await loadStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const d: Draft = {
    id: `${claimId}-D${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    claimId,
    createdAt: nowIso(),
    status: "draft",
    type: draft.type ?? "general",
    to: draft.to,
    subject: draft.subject,
    body: draft.body,
  };

  claim.drafts = Array.isArray(claim.drafts) ? claim.drafts : [];
  claim.drafts.unshift(d);
  claim.updatedAt = nowIso();
  pushTimeline(claim, "draft_created", `Draft created: ${d.subject}.`);
  await saveStore(store);
  return d;
}

export async function markDraftSent(claimId: string, draftId: string): Promise<Draft | null> {
  const store = await loadStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const drafts = Array.isArray(claim.drafts) ? claim.drafts : [];
  const d = drafts.find((x) => x.id === draftId);
  if (!d) return null;

  d.status = "sent";
  d.sentAt = nowIso();
  claim.updatedAt = nowIso();
  pushTimeline(claim, "draft_sent", `Draft sent: ${d.subject}.`);
  await saveStore(store);
  return d;
}
