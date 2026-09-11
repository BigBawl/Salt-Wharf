import {
  BOARD_SIZE,
  DELIVERIES_PER_STAGE,
  ITEMS,
  SAVE_VERSION,
  STAGE_COUNT,
  ensureStarterGens,
  item,
  piece,
  type Board,
  type Piece,
  type PlayChain,
} from "./catalog";
import {
  CELLS_FREED_PER_NODE,
  COVE_NODES,
  ENERGY_MAX,
  INBOX_CAP,
  ORDER_SLOTS,
  START_LOCKED,
  STARTER_UNLOCKED,
  STORAGE_SIZE,
  dayKey,
  emptyDaily,
  emptyStorage,
  freeLocked,
  freshClock,
  inferUnlocked,
  maxCharges,
  seedOrders,
  type Bubble,
  type DailyProgress,
  type GenClock,
  type LiveOrder,
} from "./loop";

export type KeepStatus = "open" | "fixed";

export type KeepNote = {
  at: number;
  text: string;
  status: KeepStatus;
  topic: string;
};

export type KeepLetter = {
  id: string;
  topic: string;
  title: string;
  body: string;
  status: KeepStatus;
  at: number;
  read: boolean;
};

export type KeepSlice = {
  keepLog: KeepNote[];
  keepRepairs: number;
  letters: KeepLetter[];
};

function finiteInt(n: unknown, fallback = 0, min = 0, max = 999_999): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function remapId(id: string): string {
  if (id === "energy-flask") return "energy-3";
  return id;
}

function validId(id: unknown): id is string {
  return typeof id === "string" && Boolean(ITEMS[remapId(id)]);
}

/**
 * Names a find used to carry. A Keep note saved before a rename still says the old
 * one, and this function resolves notes BY NAME to build a stable `art:<id>` topic.
 * Without this map a renamed item's old note falls back to `art:<old string>`, stops
 * matching new notes about the same find, and the player sees it twice.
 */
const LEGACY_NAMES: Record<string, string> = {
  "Iron Nail": "craft-1",
  "Rope Coil": "craft-2",
  "Hand Saw": "craft-4",
  "Toolbox": "craft-5",
  "Brass Lantern": "craft-7",
  "Beacon Lamp": "craft-10",
};
// "Claw Hammer" is deliberately absent. Holt still owns that name, so the live
// lookup resolves it to hammer-3 before this map is consulted. An old note saying
// "Claw Hammer" was ambiguous the moment two items shared the name -- it could
// have meant either -- and pointing it at craft-3 would break the notes that
// really were about the hammer. Resolving to the item that still holds the name
// is the only non-arbitrary answer.

export function topicFromLegacy(text: string): string {
  const raw = text.replace(/^The Keep:\s*/i, "");
  const pic = raw.match(/^(.+?) has no picture/i);
  if (pic) {
    const name = pic[1]!.trim();
    const hit = Object.values(ITEMS).find((i) => i.name === name);
    if (hit) return `art:${hit.id}`;
    const legacy = LEGACY_NAMES[name];
    return legacy ? `art:${legacy}` : `art:${name}`;
  }
  if (/notices were sitting/i.test(raw)) return "overlay";
  if (/starter crates/i.test(raw)) return "crates";
  if (/inbox/i.test(raw)) return "inbox";
  if (/orders redrawn/i.test(raw)) return "orders";
  return `note:${raw}`;
}

export function normalizeKeepNote(raw: unknown): KeepNote | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Partial<KeepNote> & { text?: unknown; at?: unknown };
  const text = typeof n.text === "string" && n.text.trim() ? n.text : "";
  if (!text) return null;
  const status: KeepStatus = n.status === "fixed" ? "fixed" : "open";
  const topic = typeof n.topic === "string" && n.topic ? n.topic : topicFromLegacy(text);
  return { at: finiteInt(n.at, Date.now()), text, status, topic };
}

export function normalizeKeepLetter(raw: unknown): KeepLetter | null {
  if (!raw || typeof raw !== "object") return null;
  const n = raw as Partial<KeepLetter>;
  if (typeof n.id !== "string" || typeof n.body !== "string") return null;
  return {
    id: n.id,
    topic: typeof n.topic === "string" ? n.topic : topicFromLegacy(n.body),
    title: typeof n.title === "string" ? n.title : "The Keep",
    body: n.body,
    status: n.status === "fixed" ? "fixed" : "open",
    at: finiteInt(n.at, Date.now()),
    read: Boolean(n.read),
  };
}

export function applyKeepScan(
  prevLog: KeepNote[],
  prevLetters: KeepLetter[],
  findings: Array<{ topic: string; text: string }>,
  now: number,
): {
  keepLog: KeepNote[];
  letters: KeepLetter[];
  opened: KeepLetter[];
  fixed: KeepLetter[];
} {
  const found = new Map(findings.map((f) => [f.topic, f]));
  const keepLog = prevLog.map((n) => ({ ...n }));
  const letters = prevLetters.map((l) => ({ ...l }));
  const opened: KeepLetter[] = [];
  const fixed: KeepLetter[] = [];
  let seq = 0;
  const uid = (topic: string) => `k${now.toString(36)}-${seq++}-${topic.replace(/[^a-z0-9:-]/gi, "").slice(0, 24)}`;

  for (const n of keepLog) {
    if (n.status !== "open") continue;
    if (found.has(n.topic)) continue;
    n.status = "fixed";
    n.at = now;
    const letter: KeepLetter = {
      id: uid(n.topic),
      topic: n.topic,
      title: "The Keep mended a fault",
      body: `${n.text.replace(/^The Keep:\s*/i, "")} — fixed.`,
      status: "fixed",
      at: now,
      read: false,
    };
    letters.push(letter);
    fixed.push(letter);
  }

  for (const f of findings) {
    const existing = keepLog.find((n) => n.topic === f.topic);
    const hasOpenLetter = letters.some((l) => l.topic === f.topic && l.status === "open");
    if (existing?.status === "open") {
      if (!hasOpenLetter) {
        const letter: KeepLetter = {
          id: uid(f.topic),
          topic: f.topic,
          title: "The Keep found a fault",
          body: f.text,
          status: "open",
          at: now,
          read: false,
        };
        letters.push(letter);
        opened.push(letter);
      }
      continue;
    }
    if (existing) {
      existing.status = "open";
      existing.text = f.text;
      existing.at = now;
    } else {
      keepLog.push({ at: now, text: f.text, status: "open", topic: f.topic });
    }
    const letter: KeepLetter = {
      id: uid(f.topic),
      topic: f.topic,
      title: "The Keep found a fault",
      body: f.text,
      status: "open",
      at: now,
      read: false,
    };
    letters.push(letter);
    opened.push(letter);
  }

  return {
    keepLog: keepLog.slice(-24),
    letters: letters.slice(-24),
    opened,
    fixed,
  };
}

function cleanBoard(board: unknown, notes: string[]): Board {
  const src = Array.isArray(board) ? board : [];
  const next: Board = Array.from({ length: BOARD_SIZE }, () => null);
  const seen = new Set<string>();
  let stripped = 0;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const p = src[i] as Piece | null | undefined;
    if (!p || typeof p !== "object") continue;
    if (!validId(p.itemId)) {
      stripped += 1;
      continue;
    }
    const itemId = remapId(p.itemId);
    let uid = typeof p.uid === "string" && p.uid.length > 0 ? p.uid : piece(itemId).uid;
    if (seen.has(uid)) uid = piece(itemId).uid;
    seen.add(uid);
    next[i] = { uid, itemId };
  }
  if (src.length !== BOARD_SIZE) notes.push("Dock planks reset to 7×8");
  if (stripped) notes.push(`Swept ${stripped} unknown finds`);
  return next;
}

function cleanStorage(storage: unknown, notes: string[]): Board {
  const src = Array.isArray(storage) ? storage : [];
  const next = emptyStorage();
  let n = 0;
  for (let i = 0; i < STORAGE_SIZE; i++) {
    const p = src[i] as Piece | null | undefined;
    if (!p || typeof p !== "object" || !validId(p.itemId)) continue;
    next[n] = { uid: typeof p.uid === "string" ? p.uid : piece(remapId(p.itemId)).uid, itemId: remapId(p.itemId) };
    n += 1;
  }
  if (src.length !== STORAGE_SIZE) notes.push("Cupboard resized");
  return next;
}

function cleanInbox(inbox: unknown, notes: string[]): string[] {
  const src = Array.isArray(inbox) ? inbox : [];
  const next = src.filter((id): id is string => validId(id)).map((id) => remapId(id)).slice(0, INBOX_CAP);
  if (src.length > INBOX_CAP) notes.push("Inbox trimmed to the Keep's shelf");
  if (next.length !== src.length && src.length <= INBOX_CAP) notes.push("Inbox unknown finds dropped");
  return next;
}

function cleanOrders(orders: unknown, stage: number, unlocked: PlayChain[], notes: string[]): LiveOrder[] {
  const src = Array.isArray(orders) ? (orders as LiveOrder[]) : [];
  const ok = src.filter((o) => {
    if (!o || typeof o !== "object") return false;
    if (!Array.isArray(o.requires) || o.requires.length < 1) return false;
    return o.requires.every((r) => validId(r.itemId) && finiteInt(r.count, 1, 1, 8) >= 1);
  });
  if (ok.length === ORDER_SLOTS) {
    return ok.map((o, slot) => ({
      ...o,
      slot,
      kind: o.kind === "auto" ? "auto" : "resident",
      pearls: finiteInt(o.pearls, 3, 0, 500),
      xp: finiteInt(o.xp, 10, 0, 500),
      requires: o.requires.map((r) => ({ itemId: r.itemId, count: finiteInt(r.count, 1, 1, 8) })),
    }));
  }
  notes.push("Orders redrawn");
  return seedOrders(stage, unlocked);
}

function cleanVisitor(v: unknown): LiveOrder | null {
  if (!v || typeof v !== "object") return null;
  const o = v as LiveOrder;
  if (!Array.isArray(o.requires) || o.requires.length < 1) return null;
  if (!o.requires.every((r) => validId(r.itemId))) return null;
  return o;
}

function cleanClocks(board: Board, clocks: unknown, now: number, notes: string[]): Record<string, GenClock> {
  const prev = clocks && typeof clocks === "object" ? (clocks as Record<string, GenClock>) : {};
  const next: Record<string, GenClock> = {};
  for (const p of board) {
    if (!p) continue;
    const def = item(p.itemId);
    if (def?.kind !== "generator") continue;
    const max = maxCharges(def.genLevel);
    const old = prev[p.uid];
    if (!old) {
      next[p.uid] = freshClock(now, def.genLevel);
      continue;
    }
    next[p.uid] = {
      charges: finiteInt(old.charges, max, 0, max),
      readyAt: finiteInt(old.readyAt, now, 0, now + 86_400_000),
      autoAt: finiteInt(old.autoAt, now + 90_000, 0, now + 86_400_000),
    };
  }
  if (Object.keys(prev).length > Object.keys(next).length) notes.push("Orphan crate clocks swept");
  return next;
}

function cleanBubbles(board: Board, bubbles: unknown, now: number): Bubble[] {
  if (!Array.isArray(bubbles)) return [];
  const out: Bubble[] = [];
  const used = new Set<number>();
  for (const b of bubbles as Bubble[]) {
    if (!b || typeof b !== "object") continue;
    if (!validId(b.itemId)) continue;
    const cell = finiteInt(b.cell, -1, 0, BOARD_SIZE - 1);
    if (cell < 0 || used.has(cell)) continue;
    if (!board[cell]) continue;
    used.add(cell);
    out.push({
      id: typeof b.id === "string" ? b.id : `b${cell}`,
      cell,
      itemId: b.itemId,
      bornAt: finiteInt(b.bornAt, now, now - 120_000, now),
    });
  }
  return out;
}

function cleanDaily(raw: unknown, day: unknown, now: number): { daily: DailyProgress; dailyDay: string } {
  const today = dayKey(now);
  const dailyDay = typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : today;
  const d = raw && typeof raw === "object" ? (raw as DailyProgress) : emptyDaily();
  const daily: DailyProgress = {
    orders: finiteInt(d.orders, 0, 0, 99),
    merges: finiteInt(d.merges, 0, 0, 999),
    nodes: finiteInt(d.nodes, 0, 0, 9),
    claimed: Boolean(d.claimed),
  };
  if (dailyDay !== today) return { daily: emptyDaily(), dailyDay: today };
  return { daily, dailyDay };
}

export type Healable = {
  version?: number;
  board?: Board;
  pearls?: number;
  xp?: number;
  taskIndex?: number;
  stage?: number;
  villageStage?: number;
  discovered?: string[];
  merges?: number;
  delivered?: number;
  luckyLeft?: number;
  orders?: LiveOrder[];
  storage?: Board;
  inbox?: string[];
  clocks?: Record<string, GenClock>;
  bubbles?: Bubble[];
  drySpawns?: Record<string, number>;
  coveNode?: number;
  coveStep?: number;
  unlocked?: PlayChain[];
  locked?: number[];
  lastTickAt?: number;
  orderSeed?: number;
  visitor?: LiveOrder | null;
  dailyDay?: string;
  daily?: DailyProgress;
  keepLog?: KeepNote[];
  keepRepairs?: number;
  letters?: KeepLetter[];
  energy?: number;
  lastEnergyAt?: number;
  [k: string]: unknown;
};

export function healSave<T extends Healable>(raw: T, now = Date.now()): { save: T; notes: string[] } {
  const notes: string[] = [];
  let board = cleanBoard(raw.board, notes);
  const gens = ensureStarterGens(board);
  if (gens.added.length) {
    board = gens.board;
    notes.push("Starter crates returned to the dock");
  }
  const storage = cleanStorage(raw.storage, notes);
  const inbox = cleanInbox(raw.inbox, notes);
  let coveNode = finiteInt(raw.coveNode, 0, 0, COVE_NODES.length);
  let coveStep = finiteInt(raw.coveStep, 0, 0, 12);
  const node = COVE_NODES[coveNode];
  if (node && coveStep >= node.steps.length) {
    coveStep = Math.max(0, node.steps.length - 1);
    notes.push("Cove step clamped");
  }
  const unlocked = inferUnlocked(board, storage, coveNode);
  let stage = finiteInt(raw.stage, 0, 0, STAGE_COUNT - 1);
  let taskIndex = finiteInt(raw.taskIndex, 0, 0, STAGE_COUNT * DELIVERIES_PER_STAGE);
  const maxTasks = STAGE_COUNT * DELIVERIES_PER_STAGE;
  if (taskIndex > maxTasks) taskIndex = maxTasks;
  const stageWas = stage;
  while (taskIndex >= (stage + 1) * DELIVERIES_PER_STAGE && stage < STAGE_COUNT - 1) {
    stage += 1;
  }
  const orders =
    stage !== stageWas ? seedOrders(stage, unlocked) : cleanOrders(raw.orders, stage, unlocked, notes);
  const visitor = cleanVisitor(raw.visitor);
  const clocks = cleanClocks(board, raw.clocks, now, notes);
  const bubbles = cleanBubbles(board, raw.bubbles, now);
  const { daily, dailyDay } = cleanDaily(raw.daily, raw.dailyDay, now);

  let locked = Array.isArray(raw.locked)
    ? raw.locked.map((n) => finiteInt(n, -1, 0, BOARD_SIZE - 1)).filter((n) => n >= 0)
    : [];
  if (!Array.isArray(raw.locked) && coveNode === 0 && board.filter(Boolean).length <= 10) {
    locked = START_LOCKED.filter((i) => !board[i]);
  }
  const tarpsRemain = Math.max(0, START_LOCKED.length - coveNode * CELLS_FREED_PER_NODE);
  if (locked.length > tarpsRemain) {
    locked = freeLocked(locked, locked.length - tarpsRemain).locked;
    notes.push("Tarps lifted to match the cove");
  }

  const keepLog = (Array.isArray(raw.keepLog) ? raw.keepLog : [])
    .map(normalizeKeepNote)
    .filter((n): n is KeepNote => n != null)
    .slice(-24);
  const letters = (Array.isArray(raw.letters) ? raw.letters : [])
    .map(normalizeKeepLetter)
    .filter((n): n is KeepLetter => n != null)
    .slice(-24);
  const patched = {
    ...raw,
    version: SAVE_VERSION,
    board,
    storage,
    inbox,
    orders,
    visitor,
    clocks,
    bubbles,
    pearls: finiteInt(raw.pearls, 0, 0, 999_999),
    energy: finiteInt(raw.energy, ENERGY_MAX, 0, ENERGY_MAX),
    lastEnergyAt: finiteInt(raw.lastEnergyAt, now, 0, now + 60_000),
    xp: finiteInt(raw.xp, 0, 0, 9_999_999),
    stage,
    taskIndex,
    villageStage: finiteInt(raw.villageStage, 0, 0, COVE_NODES.length),
    merges: finiteInt(raw.merges, 0, 0, 9_999_999),
    delivered: finiteInt(raw.delivered, 0, 0, 9_999_999),
    luckyLeft: finiteInt(raw.luckyLeft, 0, 0, 99),
    coveNode,
    coveStep,
    unlocked: unlocked.length ? unlocked : [...STARTER_UNLOCKED],
    locked,
    lastTickAt: finiteInt(raw.lastTickAt, now, 0, now + 60_000),
    orderSeed: finiteInt(raw.orderSeed, ORDER_SLOTS, 0, 9_999_999),
    dailyDay,
    daily,
    discovered: Array.isArray(raw.discovered)
      ? [...new Set(raw.discovered.filter((id) => validId(id)))]
      : [],
    drySpawns:
      raw.drySpawns && typeof raw.drySpawns === "object" && !Array.isArray(raw.drySpawns)
        ? raw.drySpawns
        : {},
    keepLog,
    keepRepairs: finiteInt(raw.keepRepairs, 0, 0, 9_999_999),
    letters,
  } as T;

  if (notes.length) {
    const stamped = notes.map((text) => ({
      at: now,
      text,
      status: "open" as const,
      topic: topicFromLegacy(text),
    }));
    (patched as Healable).keepLog = [...keepLog, ...stamped].slice(-24);
    (patched as Healable).keepRepairs = finiteInt(raw.keepRepairs, 0) + notes.length;
  }
  return { save: patched, notes };
}

export function keepLine(notes: string[]): string {
  if (!notes.length) return "";
  if (notes.length === 1) return `The Keep: ${notes[0]}`;
  return `The Keep mended ${notes.length} faults`;
}

function rectsOverlap(a: DOMRect, b: DOMRect, pad = 2): boolean {
  return !(
    a.right - pad < b.left + pad ||
    a.left + pad > b.right - pad ||
    a.bottom - pad < b.top + pad ||
    a.top + pad > b.bottom - pad
  );
}

export function scanOverlays(): string[] {
  if (typeof document === "undefined") return [];
  const notes: string[] = [];
  const harbor = document.querySelector("[data-harbor]");
  const hr = harbor?.getBoundingClientRect();
  const toasts = [...document.querySelectorAll("[data-toast]")].map((el) => el.getBoundingClientRect());
  const live = toasts.filter((r) => r.width > 4 && r.height > 4);
  if (!live.length) return notes;
  const blockers = [
    ...document.querySelectorAll("[data-fill], [data-cell], [data-store], [data-hud]"),
  ].map((el) => el.getBoundingClientRect());
  let hits = 0;
  for (const t of live) {
    if (hr && t.top >= hr.top - 4 && t.bottom <= hr.bottom + 4) continue;
    for (const b of blockers) {
      if (b.width < 8 || b.height < 8) continue;
      if (rectsOverlap(t, b)) hits += 1;
    }
  }
  if (hits) notes.push("Notices were sitting on the dock");
  return notes;
}
