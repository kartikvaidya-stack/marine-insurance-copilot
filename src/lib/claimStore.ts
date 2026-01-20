import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "claims.json");

type Task = {
  id: string;
  title: string;
  status: "open" | "done";
  createdAt: string;
  dueAt?: string;
};

type Reminder = {
  id: string;
  to: string;
  subject: string;
  context: string;
  dueAt: string;
  channel?: "email" | "whatsapp" | "call" | string;
  status?: "open" | "done";
  createdAt: string;
};

type Draft = {
  id: string;
  kind: string; // "email" etc
  to: string;
  subject: string;
  body: string;
  createdAt: string;
};

type TimelineEntry = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
};

type Claim = {
  id: string;
  createdAt: string;
  updatedAt: string;
  narrative: string;
  report: any;

  meta: {
    status: "open" | "in-progress" | "closed";
    stage: "intake" | "notified" | "survey" | "documents" | "reserve" | "settlement" | "closed";
    line_primary: string;
    reference_external?: string;
    handler?: string;
    counterparty?: string;
  };

  financials: {
    currency: string;
    claim_value: number;
    reserve: number;
    paid: number;
    deductible: number;
    recovery_expected: number;
    recovery_received: number;
  };

  tasks: Task[];
  reminders: Reminder[];
  drafts: Draft[];
  timeline: TimelineEntry[];
};

type Store = {
  counter: number;
  claims: Claim[];
};

function nowIso() {
  return new Date().toISOString();
}

function safeId(prefix: string) {
  return `${prefix}-${Math.random().toString(16).slice(2, 10)}`;
}

function num(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function ensureMeta(metaIn: any): Claim["meta"] {
  const m = metaIn || {};
  const status = (m.status || "open") as Claim["meta"]["status"];
  const stage = (m.stage || "intake") as Claim["meta"]["stage"];
  return {
    status: status === "closed" ? "closed" : status === "in-progress" ? "in-progress" : "open",
    stage: stage || "intake",
    line_primary: String(m.line_primary || "—"),
    reference_external: String(m.reference_external || ""),
    handler: String(m.handler || ""),
    counterparty: String(m.counterparty || ""),
  };
}

function ensureFinancials(finIn: any, fallbackCurrency = "USD"): Claim["financials"] {
  const f = finIn || {};
  return {
    currency: String(f.currency || fallbackCurrency || "USD"),
    claim_value: num(f.claim_value),
    reserve: num(f.reserve),
    paid: num(f.paid),
    deductible: num(f.deductible),
    recovery_expected: num(f.recovery_expected),
    recovery_received: num(f.recovery_received),
  };
}

async function ensureStoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    const init: Store = { counter: 0, claims: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(init, null, 2), "utf-8");
  }
}

async function readStore(): Promise<Store> {
  await ensureStoreFile();
  const raw = await fs.readFile(STORE_PATH, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return {
      counter: Number(parsed?.counter || 0),
      claims: Array.isArray(parsed?.claims) ? parsed.claims : [],
    };
  } catch {
    // If file ever gets corrupted, reset safely
    const init: Store = { counter: 0, claims: [] };
    await fs.writeFile(STORE_PATH, JSON.stringify(init, null, 2), "utf-8");
    return init;
  }
}

async function writeStore(store: Store) {
  await ensureStoreFile();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

function nextClaimId(counter: number) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const seq = String(counter).padStart(4, "0");
  return `NC-${yyyy}${mm}${dd}-${seq}`;
}

export async function listClaims(): Promise<Claim[]> {
  const store = await readStore();
  // newest first
  return store.claims.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getClaim(id: string): Promise<Claim | null> {
  const store = await readStore();
  const c = store.claims.find((x) => x.id === id);
  return c || null;
}

export async function createClaim(narrative: string, report: any, tasks: Task[] = []): Promise<Claim> {
  const store = await readStore();

  const counter = Number(store.counter || 0) + 1;
  store.counter = counter;

  const id = nextClaimId(counter);
  const createdAt = nowIso();

  const claim: Claim = {
    id,
    createdAt,
    updatedAt: createdAt,
    narrative: narrative || "",
    report: report || {},

    meta: ensureMeta({
      status: "open",
      stage: "intake",
      line_primary: (report?.potential_claims && report.potential_claims[0]) || "—",
    }),

    financials: ensureFinancials({ currency: "USD" }),

    tasks: Array.isArray(tasks) ? tasks : [],
    reminders: [],
    drafts: [],
    timeline: [
      {
        id: safeId(`${id}-TL`),
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
 * ✅ This is the critical function. It MUST deep-merge and MUST persist paid/recovery fields.
 */
export async function updateClaimFields(
  claimId: string,
  patch: { meta?: Partial<Claim["meta"]>; financials?: Partial<Claim["financials"]> }
): Promise<Claim | null> {
  const store = await readStore();
  const idx = store.claims.findIndex((c) => c.id === claimId);
  if (idx < 0) return null;

  const prev = store.claims[idx];
  const updatedAt = nowIso();

  // Deep merge meta
  const nextMeta = ensureMeta({
    ...prev.meta,
    ...(patch.meta || {}),
  });

  // Deep merge financials (THIS is where paid & recoveries must be preserved)
  const nextFinancials = ensureFinancials(
    {
      ...prev.financials,
      ...(patch.financials || {}),
    },
    prev.financials?.currency || "USD"
  );

  const timeline: TimelineEntry[] = Array.isArray(prev.timeline) ? prev.timeline.slice() : [];

  // Timeline - meta changes
  if (prev.meta?.status !== nextMeta.status) {
    timeline.push({
      id: safeId(`${claimId}-TL`),
      type: "status_changed",
      message: `Status: ${prev.meta?.status || "—"} → ${nextMeta.status}`,
      createdAt: updatedAt,
    });
  }
  if (prev.meta?.stage !== nextMeta.stage) {
    timeline.push({
      id: safeId(`${claimId}-TL`),
      type: "stage_changed",
      message: `Stage: ${prev.meta?.stage || "—"} → ${nextMeta.stage}`,
      createdAt: updatedAt,
    });
  }

  // Timeline - financial changes (paid/recovery included!)
  const finKeys: Array<keyof Claim["financials"]> = [
    "currency",
    "claim_value",
    "reserve",
    "paid",
    "deductible",
    "recovery_expected",
    "recovery_received",
  ];

  const finChanged = finKeys.some((k) => {
    const a = (prev.financials as any)?.[k];
    const b = (nextFinancials as any)?.[k];
    return String(a) !== String(b);
  });

  if (finChanged) {
    timeline.push({
      id: safeId(`${claimId}-TL`),
      type: "financials_updated",
      message: `Financials updated (value/reserve/paid/deductible/recoveries).`,
      createdAt: updatedAt,
    });
  }

  const next: Claim = {
    ...prev,
    meta: nextMeta,
    financials: nextFinancials,
    updatedAt,
    timeline,
  };

  store.claims[idx] = next;
  await writeStore(store);
  return next;
}

export async function updateTaskStatus(
  claimId: string,
  taskId: string,
  status: "open" | "done"
): Promise<Claim | null> {
  const store = await readStore();
  const idx = store.claims.findIndex((c) => c.id === claimId);
  if (idx < 0) return null;

  const prev = store.claims[idx];
  const tasks = Array.isArray(prev.tasks) ? prev.tasks.slice() : [];
  const tIdx = tasks.findIndex((t) => t.id === taskId);
  if (tIdx < 0) return prev;

  tasks[tIdx] = { ...tasks[tIdx], status };

  const updatedAt = nowIso();
  const timeline: TimelineEntry[] = Array.isArray(prev.timeline) ? prev.timeline.slice() : [];
  timeline.push({
    id: safeId(`${claimId}-TL`),
    type: "task_updated",
    message: `Task ${taskId} → ${status}`,
    createdAt: updatedAt,
  });

  const next: Claim = { ...prev, tasks, updatedAt, timeline };
  store.claims[idx] = next;
  await writeStore(store);
  return next;
}

export async function addReminder(claimId: string, reminderIn: any): Promise<Reminder | null> {
  const store = await readStore();
  const idx = store.claims.findIndex((c) => c.id === claimId);
  if (idx < 0) return null;

  const prev = store.claims[idx];
  const reminders = Array.isArray(prev.reminders) ? prev.reminders.slice() : [];
  const createdAt = nowIso();

  const reminder: Reminder = {
    id: reminderIn?.id || safeId(`${claimId}-R`),
    to: String(reminderIn?.to || "").trim(),
    subject: String(reminderIn?.subject || "").trim(),
    context: String(reminderIn?.context || ""),
    dueAt: String(reminderIn?.dueAt || ""),
    channel: reminderIn?.channel || "email",
    status: reminderIn?.status || "open",
    createdAt,
  };

  reminders.push(reminder);

  const timeline: TimelineEntry[] = Array.isArray(prev.timeline) ? prev.timeline.slice() : [];
  timeline.push({
    id: safeId(`${claimId}-TL`),
    type: "reminder_added",
    message: `Reminder added: ${reminder.to} — ${reminder.subject}`,
    createdAt,
  });

  const next: Claim = { ...prev, reminders, updatedAt: createdAt, timeline };
  store.claims[idx] = next;
  await writeStore(store);

  return reminder;
}

export async function markReminderDone(claimId: string, reminderId: string): Promise<boolean> {
  const store = await readStore();
  const idx = store.claims.findIndex((c) => c.id === claimId);
  if (idx < 0) return false;

  const prev = store.claims[idx];
  const reminders = Array.isArray(prev.reminders) ? prev.reminders.slice() : [];
  const rIdx = reminders.findIndex((r) => r.id === reminderId);
  if (rIdx < 0) return false;

  reminders[rIdx] = { ...reminders[rIdx], status: "done" };

  const updatedAt = nowIso();
  const timeline: TimelineEntry[] = Array.isArray(prev.timeline) ? prev.timeline.slice() : [];
  timeline.push({
    id: safeId(`${claimId}-TL`),
    type: "reminder_done",
    message: `Reminder marked done: ${reminderId}`,
    createdAt: updatedAt,
  });

  store.claims[idx] = { ...prev, reminders, updatedAt, timeline };
  await writeStore(store);
  return true;
}

export async function addDraft(claimId: string, draftIn: any): Promise<Draft | null> {
  const store = await readStore();
  const idx = store.claims.findIndex((c) => c.id === claimId);
  if (idx < 0) return null;

  const prev = store.claims[idx];
  const drafts = Array.isArray(prev.drafts) ? prev.drafts.slice() : [];
  const createdAt = nowIso();

  const draft: Draft = {
    id: draftIn?.id || safeId(`${claimId}-D`),
    kind: String(draftIn?.kind || "email"),
    to: String(draftIn?.to || ""),
    subject: String(draftIn?.subject || ""),
    body: String(draftIn?.body || ""),
    createdAt,
  };

  drafts.push(draft);

  const timeline: TimelineEntry[] = Array.isArray(prev.timeline) ? prev.timeline.slice() : [];
  timeline.push({
    id: safeId(`${claimId}-TL`),
    type: "draft_created",
    message: `Draft created: ${draft.kind} — ${draft.subject}`,
    createdAt,
  });

  store.claims[idx] = { ...prev, drafts, updatedAt: createdAt, timeline };
  await writeStore(store);
  return draft;
}
