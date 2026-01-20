import { promises as fs } from "fs";
import path from "path";

// --------------------
// Types
// --------------------

export type ClaimStatus = "open" | "in_progress" | "closed";
export type ClaimStage =
  | "intake"
  | "notification"
  | "survey"
  | "documentation"
  | "submission"
  | "settlement"
  | "recovery"
  | "closed";

export type ClaimLine = "H&M" | "P&I" | "Cargo" | "FD&D" | "War" | "Other";

export type TaskStatus = "open" | "done";
export type ReminderStatus = "pending" | "done";
export type DraftStatus = "draft" | "sent";

export type DraftType = "initial_notice" | "reminder" | "docs_request" | "update" | "settlement";

export interface ClaimReport {
  incident_type: string;
  date_time: string; // ISO
  location: string;
  vessel: string;
  summary: string;
  potential_claims: ClaimLine[];
  immediate_actions: string;
  missing_information: string;
  coverage_reasoning?: Record<string, string>;
  documents_checklist?: Record<string, string[]>;
}

export interface ClaimMeta {
  status: ClaimStatus;
  stage: ClaimStage;
  line_primary: ClaimLine;
  reference_external: string;
  handler: string;
  counterparty: string;
}

export interface ClaimFinancials {
  currency: string; // "USD", "SGD" etc.
  claim_value: number;
  reserve: number;
  paid: number;
  deductible: number;
  recovery_expected: number;
  recovery_received: number;
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  dueAt?: string;
}

export interface Reminder {
  id: string;
  createdAt: string;
  status: ReminderStatus;
  dueAt: string;
  to: string;
  channel?: "email" | "call" | "whatsapp";
  subject: string;
  context: string;
}

export interface Draft {
  id: string;
  createdAt: string;
  type: DraftType;
  status: DraftStatus;
  to: string;
  subject: string;
  body: string;
  sentAt?: string;
}

export interface TimelineEvent {
  id: string;
  type: "created" | "status_changed" | "stage_changed" | "financials_updated" | "task_updated" | "reminder_added" | "draft_created" | "draft_sent";
  message: string;
  createdAt: string;
}

export interface Claim {
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
  timeline: TimelineEvent[];
}

type Store = {
  counter: number;
  claims: Claim[];
};

// --------------------
// Storage helpers
// --------------------

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "claims.json");

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const seed: Store = { counter: 0, claims: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readStore(): Promise<Store> {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<Store>;
  return {
    counter: typeof parsed.counter === "number" ? parsed.counter : 0,
    claims: Array.isArray(parsed.claims) ? (parsed.claims as Claim[]) : [],
  };
}

async function writeStore(store: Store): Promise<void> {
  await ensureStore();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
}

function nowIso(): string {
  return new Date().toISOString();
}

function randId(len = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function safeNumber(x: unknown): number {
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : 0;
}

// --------------------
// Public API
// --------------------

export async function listClaims(): Promise<Claim[]> {
  const store = await readStore();
  // newest first
  return [...store.claims].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getClaimById(claimId: string): Promise<Claim | null> {
  const store = await readStore();
  const c = store.claims.find((x) => x.id === claimId);
  return c ?? null;
}

export async function createClaim(input: {
  id?: string;
  narrative: string;
  report: ClaimReport;
  tasks?: Task[];
  meta?: Partial<ClaimMeta>;
  financials?: Partial<ClaimFinancials>;
}): Promise<Claim> {
  const store = await readStore();

  const nextCounter = (store.counter || 0) + 1;
  store.counter = nextCounter;

  const today = new Date();
  const y = today.getUTCFullYear();
  const m = String(today.getUTCMonth() + 1).padStart(2, "0");
  const d = String(today.getUTCDate()).padStart(2, "0");

  const id =
    input.id && input.id.trim().length > 0
      ? input.id.trim()
      : `NC-${y}${m}${d}-${String(nextCounter).padStart(4, "0")}`;

  const createdAt = nowIso();

  const defaultMeta: ClaimMeta = {
    status: "open",
    stage: "intake",
    line_primary: (input.report?.potential_claims?.[0] ?? "Other") as ClaimLine,
    reference_external: "",
    handler: "",
    counterparty: "",
  };

  const defaultFin: ClaimFinancials = {
    currency: "USD",
    claim_value: 0,
    reserve: 0,
    paid: 0,
    deductible: 0,
    recovery_expected: 0,
    recovery_received: 0,
  };

  const claim: Claim = {
    id,
    createdAt,
    updatedAt: createdAt,
    narrative: input.narrative,
    report: input.report,
    meta: { ...defaultMeta, ...(input.meta ?? {}) },
    financials: { ...defaultFin, ...(input.financials ?? {}) },
    tasks: Array.isArray(input.tasks) ? input.tasks : [],
    reminders: [],
    drafts: [],
    timeline: [
      {
        id: `${id}-TL-${randId(8)}`,
        type: "created",
        message: "Claim created.",
        createdAt,
      },
    ],
  };

  store.claims.push(claim);
  await writeStore(store);
  return claim;
}

/**
 * ✅ IMPORTANT:
 * This is a PATCH / MERGE update.
 * It MUST accept partial meta/financials (so undefined is allowed).
 */
export async function updateClaimFields(
  claimId: string,
  patch: {
    meta?: Partial<ClaimMeta>;
    financials?: Partial<ClaimFinancials>;
  }
): Promise<Claim | null> {
  const store = await readStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const beforeStatus = claim.meta.status;
  const beforeStage = claim.meta.stage;

  if (patch.meta) {
    claim.meta = { ...claim.meta, ...patch.meta };
  }

  if (patch.financials) {
    // enforce numbers where needed (prevents UI weirdness)
    const f = patch.financials;
    claim.financials = {
      ...claim.financials,
      ...f,
      claim_value: f.claim_value !== undefined ? safeNumber(f.claim_value) : claim.financials.claim_value,
      reserve: f.reserve !== undefined ? safeNumber(f.reserve) : claim.financials.reserve,
      paid: f.paid !== undefined ? safeNumber(f.paid) : claim.financials.paid,
      deductible: f.deductible !== undefined ? safeNumber(f.deductible) : claim.financials.deductible,
      recovery_expected:
        f.recovery_expected !== undefined ? safeNumber(f.recovery_expected) : claim.financials.recovery_expected,
      recovery_received:
        f.recovery_received !== undefined ? safeNumber(f.recovery_received) : claim.financials.recovery_received,
    };
  }

  claim.updatedAt = nowIso();

  // timeline
  if (patch.meta?.status && patch.meta.status !== beforeStatus) {
    claim.timeline.unshift({
      id: `${claimId}-TL-${randId(8)}`,
      type: "status_changed",
      message: `Status: ${beforeStatus} → ${patch.meta.status}`,
      createdAt: claim.updatedAt,
    });
  }

  if (patch.meta?.stage && patch.meta.stage !== beforeStage) {
    claim.timeline.unshift({
      id: `${claimId}-TL-${randId(8)}`,
      type: "stage_changed",
      message: `Stage: ${beforeStage} → ${patch.meta.stage}`,
      createdAt: claim.updatedAt,
    });
  }

  if (patch.financials) {
    claim.timeline.unshift({
      id: `${claimId}-TL-${randId(8)}`,
      type: "financials_updated",
      message: "Financials updated (value/reserve/paid/deductible/recoveries).",
      createdAt: claim.updatedAt,
    });
  }

  await writeStore(store);
  return claim;
}

// ---- Tasks ----

export async function updateTaskStatus(claimId: string, taskId: string, status: TaskStatus): Promise<Task | null> {
  const store = await readStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;
  const t = claim.tasks.find((x) => x.id === taskId);
  if (!t) return null;

  t.status = status;
  claim.updatedAt = nowIso();

  claim.timeline.unshift({
    id: `${claimId}-TL-${randId(8)}`,
    type: "task_updated",
    message: `Task ${taskId} → ${status}`,
    createdAt: claim.updatedAt,
  });

  await writeStore(store);
  return t;
}

// Backward-compatible export name (some route files import this)
export const setTaskStatus = updateTaskStatus;

// ---- Reminders ----

export async function addReminder(claimId: string, reminder: Omit<Reminder, "id" | "createdAt" | "status">): Promise<Reminder | null> {
  const store = await readStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const created: Reminder = {
    id: `${claimId}-R${randId(6)}`,
    createdAt: nowIso(),
    status: "pending",
    dueAt: reminder.dueAt,
    to: reminder.to,
    channel: reminder.channel ?? "email",
    subject: reminder.subject,
    context: reminder.context,
  };

  claim.reminders.unshift(created);
  claim.updatedAt = nowIso();

  claim.timeline.unshift({
    id: `${claimId}-TL-${randId(8)}`,
    type: "reminder_added",
    message: `Reminder added: ${created.subject} → ${created.to}`,
    createdAt: claim.updatedAt,
  });

  await writeStore(store);
  return created;
}

export async function markReminderDone(claimId: string, reminderId: string): Promise<Reminder | null> {
  const store = await readStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const r = claim.reminders.find((x) => x.id === reminderId);
  if (!r) return null;

  r.status = "done";
  claim.updatedAt = nowIso();
  await writeStore(store);
  return r;
}

// ---- Drafts ----

export async function addDraft(claimId: string, draft: Omit<Draft, "id" | "createdAt" | "status">): Promise<Draft | null> {
  const store = await readStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const created: Draft = {
    id: `${claimId}-D${randId(6)}`,
    createdAt: nowIso(),
    status: "draft",
    type: draft.type,
    to: draft.to,
    subject: draft.subject,
    body: draft.body,
  };

  claim.drafts.unshift(created);
  claim.updatedAt = nowIso();

  claim.timeline.unshift({
    id: `${claimId}-TL-${randId(8)}`,
    type: "draft_created",
    message: `Draft created: ${created.type}`,
    createdAt: claim.updatedAt,
  });

  await writeStore(store);
  return created;
}

export async function markDraftSent(claimId: string, draftId: string): Promise<Draft | null> {
  const store = await readStore();
  const claim = store.claims.find((c) => c.id === claimId);
  if (!claim) return null;

  const d = claim.drafts.find((x) => x.id === draftId);
  if (!d) return null;

  d.status = "sent";
  d.sentAt = nowIso();
  claim.updatedAt = nowIso();

  claim.timeline.unshift({
    id: `${claimId}-TL-${randId(8)}`,
    type: "draft_sent",
    message: `Draft marked sent: ${draftId}`,
    createdAt: claim.updatedAt,
  });

  await writeStore(store);
  return d;
}
