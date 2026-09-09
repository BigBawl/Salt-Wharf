import { create } from "zustand";
import {
  BOARD_SIZE,
  COLS,
  DELIVERIES_PER_STAGE,
  EMPTY_COSMETICS,
  LUCKY_CHARGES,
  SAVE_KEY,
  SAVE_VERSION,
  STAGE_COUNT,
  boostById,
  canMerge,
  chainUnlocked,
  CRATES,
  ITEMS,
  ensureStarterGens,
  item,
  levelFromXp,
  lookById,
  makeInitialBoard,
  nearestEmpty,
  nextItemId,
  piece,
  prevItemId,
  prizeAfterMerge,
  hasProducer,
  villageForStage,
  stageName,
  type Board,
  type BoostId,
  type CosmeticId,
  type Cosmetics,
  type Piece,
  type PlayChain,
} from "./catalog";
import {
  AUTO_CATCHUP_MAX,
  AUTO_TICK_MS,
  BUBBLE_CHANCE,
  BUBBLE_TAKE_COST,
  BUBBLE_WAIT_MS,
  COVE_NODES,
  OFFLINE_CAP_MS,
  ORDER_SLOTS,
  START_LOCKED,
  STARTER_UNLOCKED,
  STORAGE_SIZE,
  canFillOrder,
  canPayStep,
  chestDrops,
  dailyComplete,
  dayKey,
  emptyDaily,
  emptyStorage,
  firstEmptyStorage,
  freeLocked,
  freshClock,
  inferUnlocked,
  makeVisitor,
  maxCharges,
  neededFromOrders,
  neighborEmpty,
  payStep,
  pityRoll,
  placeOrInbox,
  printerMaxOnBoard,
  rechargeMs,
  regenEnergy,
  spendEnergy,
  ENERGY_MAX,
  SIP_ENERGY,
  TAP_ENERGY,
  replaceOrder,
  seedOrders,
  takeFromPools,
  type Bubble,
  type DailyProgress,
  type GenClock,
  type LiveOrder,
  type UndoSell,
  INBOX_CAP,
} from "./loop";
import { healSave, keepLine, scanOverlays, applyKeepScan, normalizeKeepLetter, normalizeKeepNote, type KeepLetter, type KeepNote } from "./watch";
import { sfx } from "./audio";

export type Toast = { id: string; text: string; kind?: "ok" | "warn"; count?: number };
export type FxBurst = { id: string; x: number; y: number; text?: string };
export type LastMerge = {
  index: number;
  uid: string;
  chain: string;
  tier: number;
  capstone: boolean;
};

export type SaveSlice = {
  version: number;
  board: Board;
  energy: number;
  lastEnergyAt: number;
  pearls: number;
  xp: number;
  taskIndex: number;
  stage: number;
  villageStage: number;
  discovered: string[];
  merges: number;
  delivered: number;
  won: boolean;
  seenHowTo: boolean;
  sfxOn: boolean;
  started: boolean;
  cosmetics: Cosmetics;
  luckyLeft: number;
  orders: LiveOrder[];
  storage: Board;
  inbox: string[];
  clocks: Record<string, GenClock>;
  bubbles: Bubble[];
  drySpawns: Record<string, number>;
  coveNode: number;
  coveStep: number;
  lastTickAt: number;
  orderSeed: number;
  visitor: LiveOrder | null;
  dailyDay: string;
  daily: DailyProgress;
  seenLoop: boolean;
  keepLog: KeepNote[];
  keepRepairs: number;
  letters: KeepLetter[];
  unlocked: PlayChain[];
  locked: number[];
};

export type LastRestore = {
  id: string;
  name: string;
  story: string;
  mail: string[];
};

export type GameState = SaveSlice & {
  hydrated: boolean;
  selected: number | null;
  toasts: Toast[];
  fx: FxBurst[];
  popUid: string | null;
  lastMerge: LastMerge | null;
  /** live-session only; deliberately absent from snapshot() */
  comboCount: number;
  comboLastAt: number;
  lastRestore: LastRestore | null;
  undo: UndoSell | null;
  armedSplit: boolean;
  hydrate: () => void;
  start: () => void;
  newTide: () => void;
  tapGenerator: (index: number) => boolean;
  movePiece: (from: number, to: number) => boolean;
  mergePieces: (from: number, to: number) => boolean;
  useConsumable: (index: number) => boolean;
  select: (index: number | null) => void;
  sellAt: (index: number, opts?: { confirmed?: boolean }) => boolean;
  undoSell: () => boolean;
  deliver: (slot?: number) => boolean;
  deliverVisitor: () => boolean;
  unlockStage: () => boolean;
  buyLook: (id: CosmeticId) => boolean;
  buyBoost: (id: BoostId) => boolean;
  buyCrate: (chain: PlayChain) => boolean;
  storeFromBoard: (index: number) => boolean;
  storeToBoard: (slot: number) => boolean;
  pullInbox: () => boolean;
  takeBubble: (id: string) => boolean;
  payCove: () => boolean;
  splitAt: (index: number) => boolean;
  disarmSplit: () => void;
  claimDaily: () => boolean;
  tick: (now?: number) => void;
  scanKeep: (quiet?: boolean) => void;
  noteArtFault: (itemId: string) => void;
  readKeepMail: () => void;
  dismissHowTo: () => void;
  toggleSfx: () => void;
  breakCombo: () => void;
  pushToast: (text: string, kind?: Toast["kind"]) => void;
  spawnFx: (burst: Omit<FxBurst, "id">) => void;
  clearFx: (id: string) => void;
  dismissRestore: () => void;
};

function snapshot(s: SaveSlice): SaveSlice {
  return {
    version: SAVE_VERSION,
    board: s.board,
    energy: s.energy,
    lastEnergyAt: s.lastEnergyAt,
    pearls: s.pearls,
    xp: s.xp,
    taskIndex: s.taskIndex,
    stage: s.stage,
    villageStage: s.villageStage,
    discovered: s.discovered,
    merges: s.merges,
    delivered: s.delivered,
    won: s.won,
    seenHowTo: s.seenHowTo,
    sfxOn: s.sfxOn,
    started: s.started,
    cosmetics: { ...s.cosmetics },
    luckyLeft: s.luckyLeft,
    orders: s.orders,
    storage: s.storage,
    inbox: [...s.inbox],
    clocks: { ...s.clocks },
    bubbles: s.bubbles,
    drySpawns: { ...s.drySpawns },
    coveNode: s.coveNode,
    coveStep: s.coveStep,
    lastTickAt: s.lastTickAt,
    orderSeed: s.orderSeed,
    visitor: s.visitor,
    dailyDay: s.dailyDay,
    daily: { ...s.daily },
    seenLoop: s.seenLoop,
    keepLog: Array.isArray(s.keepLog) ? s.keepLog.slice(-24) : [],
    keepRepairs: s.keepRepairs ?? 0,
    letters: Array.isArray(s.letters) ? s.letters.slice(-24) : [],
    unlocked: Array.isArray(s.unlocked) && s.unlocked.length ? [...s.unlocked] : [...STARTER_UNLOCKED],
    locked: Array.isArray(s.locked) ? [...s.locked] : [],
  };
}

function clocksForBoard(board: Board, now: number, prev: Record<string, GenClock> = {}): Record<string, GenClock> {
  const next: Record<string, GenClock> = {};
  for (const p of board) {
    if (!p) continue;
    const def = item(p.itemId);
    if (def?.kind !== "generator") continue;
    next[p.uid] = prev[p.uid] ?? freshClock(now, def.genLevel);
  }
  return next;
}

function freshSave(): SaveSlice {
  const now = Date.now();
  const board = makeInitialBoard();
  const discovered = board
    .filter((p): p is Piece => p != null)
    .map((p) => p.itemId);
  return {
    version: SAVE_VERSION,
    board,
    energy: ENERGY_MAX,
    lastEnergyAt: now,
    pearls: 8,
    xp: 0,
    taskIndex: 0,
    stage: 0,
    villageStage: 0,
    discovered,
    merges: 0,
    delivered: 0,
    won: false,
    seenHowTo: false,
    sfxOn: true,
    started: false,
    cosmetics: { ...EMPTY_COSMETICS },
    luckyLeft: 0,
    orders: seedOrders(0, STARTER_UNLOCKED),
    storage: emptyStorage(),
    inbox: [],
    clocks: clocksForBoard(board, now),
    bubbles: [],
    drySpawns: {},
    coveNode: 0,
    coveStep: 0,
    lastTickAt: now,
    orderSeed: ORDER_SLOTS,
    visitor: null,
    dailyDay: dayKey(now),
    daily: emptyDaily(),
    seenLoop: false,
    keepLog: [],
    keepRepairs: 0,
    letters: [],
    unlocked: [...STARTER_UNLOCKED],
    locked: [...START_LOCKED],
  };
}

function migrate(raw: unknown): SaveSlice {
  const base = freshSave();
  if (!raw || typeof raw === "undefined" || typeof raw !== "object") return base;
  const s = raw as Partial<SaveSlice>;
  const prevVersion = typeof s.version === "number" ? s.version : 0;
  const board =
    Array.isArray(s.board) && s.board.length === BOARD_SIZE
      ? (s.board as Board)
      : base.board;
  const healed = ensureStarterGens(board);
  const storage =
    Array.isArray(s.storage) && s.storage.length === STORAGE_SIZE ? s.storage : emptyStorage();
  const coveNode =
    typeof s.coveNode === "number"
      ? Math.max(0, Math.min(COVE_NODES.length, Math.floor(s.coveNode)))
      : Math.max(0, Math.min(COVE_NODES.length, s.villageStage ?? 0));
  const unlocked = inferUnlocked(healed.board, storage, coveNode);
  const locked =
    prevVersion >= 7 && Array.isArray(s.locked)
      ? s.locked
          .map((n) => Math.floor(Number(n)))
          .filter((n) => n >= 0 && n < BOARD_SIZE)
      : prevVersion >= 6 && Array.isArray(s.locked)
        ? s.locked
            .map((n) => Math.floor(Number(n)))
            .filter((n) => n >= 0 && n < BOARD_SIZE && !healed.board[n])
        : prevVersion >= 6
          ? [...START_LOCKED]
          : [];
  const draft: SaveSlice = {
    ...base,
    ...s,
    version: SAVE_VERSION,
    board: healed.board,
    discovered: Array.isArray(s.discovered)
      ? [...new Set([...s.discovered, ...healed.added])]
      : [...base.discovered, ...healed.added],
    cosmetics: {
      lanterns: Boolean(s.cosmetics?.lanterns),
      painted: Boolean(s.cosmetics?.painted),
      lights: Boolean(s.cosmetics?.lights),
    },
    luckyLeft:
      typeof s.luckyLeft === "number" && Number.isFinite(s.luckyLeft)
        ? Math.max(0, Math.floor(s.luckyLeft))
        : 0,
    stage:
      typeof s.stage === "number" && Number.isFinite(s.stage)
        ? Math.max(0, Math.min(STAGE_COUNT - 1, Math.floor(s.stage)))
        : Math.max(
            0,
            Math.min(
              STAGE_COUNT - 1,
              Math.floor((typeof s.taskIndex === "number" ? s.taskIndex : 0) / DELIVERIES_PER_STAGE),
            ),
          ),
    xp: typeof s.xp === "number" && Number.isFinite(s.xp) ? Math.max(0, s.xp) : base.xp,
    orders:
      Array.isArray(s.orders) && s.orders.length === ORDER_SLOTS
        ? s.orders
        : seedOrders(typeof s.stage === "number" ? s.stage : 0, unlocked),
    storage,
    inbox: Array.isArray(s.inbox) ? s.inbox.filter((x) => typeof x === "string") : [],
    clocks: clocksForBoard(healed.board, Date.now(), s.clocks ?? {}),
    bubbles: Array.isArray(s.bubbles) ? s.bubbles : [],
    drySpawns: s.drySpawns && typeof s.drySpawns === "object" ? s.drySpawns : {},
    coveNode,
    coveStep: typeof s.coveStep === "number" ? Math.max(0, Math.floor(s.coveStep)) : 0,
    lastTickAt: typeof s.lastTickAt === "number" ? s.lastTickAt : Date.now(),
    orderSeed: typeof s.orderSeed === "number" ? s.orderSeed : ORDER_SLOTS,
    visitor: s.visitor && typeof s.visitor === "object" ? s.visitor : null,
    dailyDay: typeof s.dailyDay === "string" ? s.dailyDay : dayKey(),
    daily:
      s.daily && typeof s.daily === "object"
        ? {
            orders: Number(s.daily.orders) || 0,
            merges: Number(s.daily.merges) || 0,
            nodes: Number(s.daily.nodes) || 0,
            claimed: Boolean(s.daily.claimed),
          }
        : emptyDaily(),
    seenLoop: prevVersion >= 6 ? Boolean(s.seenLoop) : false,
    keepLog: (Array.isArray(s.keepLog) ? s.keepLog : [])
      .map(normalizeKeepNote)
      .filter((n): n is KeepNote => n != null)
      .slice(-24),
    keepRepairs: typeof s.keepRepairs === "number" ? s.keepRepairs : 0,
    letters: (Array.isArray(s.letters) ? s.letters : [])
      .map(normalizeKeepLetter)
      .filter((n): n is KeepLetter => n != null)
      .slice(-24),
    unlocked,
    locked,
    energy: prevVersion < 8 ? ENERGY_MAX : typeof s.energy === "number" ? s.energy : ENERGY_MAX,
    lastEnergyAt: typeof s.lastEnergyAt === "number" ? s.lastEnergyAt : Date.now(),
  };
  return healSave(draft, Date.now()).save;
}

function loadSave(): SaveSlice {
  if (typeof window === "undefined") return freshSave();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    return migrate(JSON.parse(raw));
  } catch {
    try {
      const bak = localStorage.getItem(`${SAVE_KEY}-bak`);
      if (bak) return migrate(JSON.parse(bak));
    } catch {
      /* ignore */
    }
    return freshSave();
  }
}

function progressOf(s: {
  delivered: number;
  taskIndex: number;
  merges: number;
  xp: number;
}) {
  return s.delivered + s.taskIndex + s.merges + s.xp;
}

let saveTimer: number | null = null;
function queueSave(s: SaveSlice, immediate = false) {
  if (typeof window === "undefined") return;
  const blob = JSON.stringify(snapshot(s));
  const flush = () => {
    try {
      localStorage.setItem(SAVE_KEY, blob);
      localStorage.setItem(`${SAVE_KEY}-bak`, blob);
    } catch {
      /* private mode / quota */
    }
  };
  if (saveTimer) window.clearTimeout(saveTimer);
  if (immediate) {
    saveTimer = null;
    flush();
    return;
  }
  saveTimer = window.setTimeout(flush, 180);
}

function discover(list: string[], id: string): string[] {
  if (list.includes(id)) return list;
  return [...list, id];
}

function play(s: GameState, fn: () => void) {
  if (s.sfxOn) fn();
}

function withDaily(s: SaveSlice, field: "orders" | "merges" | "nodes", now = Date.now()): {
  dailyDay: string;
  daily: DailyProgress;
} {
  const today = dayKey(now);
  const daily = s.dailyDay === today ? { ...s.daily } : emptyDaily();
  daily[field] += 1;
  return { dailyDay: today, daily };
}

function maybeVisitor(board: Board, stage: number, seed: number, current: LiveOrder | null): LiveOrder | null {
  if (current) return current;
  const printer = printerMaxOnBoard(board);
  if (!printer) return null;
  return makeVisitor(stage, seed, printer);
}

export const useGame = create<GameState>((set, get) => ({
  ...freshSave(),
  hydrated: false,
  selected: null,
  toasts: [],
  fx: [],
  popUid: null,
  comboCount: 0,
  comboLastAt: 0,
  lastMerge: null,
  lastRestore: null,
  undo: null,
  armedSplit: false,

  hydrate: () => {
    const s = get();
    if (s.hydrated) return;
    const loaded = loadSave();
    const disk = progressOf(loaded);
    const mem = progressOf(s);
    if (s.started && mem > disk) {
      set({ hydrated: true });
      queueSave(s, true);
      return;
    }
    const started =
      loaded.started || loaded.taskIndex > 0 || loaded.delivered > 0 || loaded.xp > 0;
    set({ ...loaded, hydrated: true, started, undo: null, lastRestore: null });
    get().tick(Date.now());
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        const cur = useGame.getState();
        if (cur.hydrated) cur.scanKeep(true);
      }, 1400);
    }
  },

  start: () => {
    set((s) => {
      const next = { ...s, started: true };
      queueSave(next, true);
      return next;
    });
  },

  newTide: () => {
    const next = { ...freshSave(), hydrated: true, started: true };
    queueSave(next, true);
    set({
      ...next,
      selected: null,
      toasts: [],
      fx: [],
      popUid: null,
      lastMerge: null,
      lastRestore: null,
      undo: null,
      armedSplit: false,
      comboCount: 0,
      comboLastAt: 0,
    });
  },

  tapGenerator: (index) => {
    const s = get();
    const p = s.board[index];
    const def = p ? item(p.itemId) : undefined;
    if (!p || !def || def.kind !== "generator") return false;
    const now = Date.now();
    const clock = s.clocks[p.uid] ?? freshClock(now, def.genLevel);
    if (clock.charges < 1) {
      play(s, sfx.invalid);
      return false;
    }
    const paid = spendEnergy(s.energy, s.lastEnergyAt, now, TAP_ENERGY);
    if (!paid.ok) {
      play(s, sfx.invalid);
      return false;
    }
    const board = s.board.slice();
    const empty = nearestEmpty(index, board, COLS, new Set(s.locked));
    if (empty < 0) {
      get().pushToast("The board is full — merge, store, or sell", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const chain = (def.produces ?? "tide") as PlayChain;
    const rolled = pityRoll(chain, def.genLevel, s.drySpawns[chain] ?? 0, Math.random, s.luckyLeft > 0);
    const drop = piece(rolled.id);
    board[empty] = drop;
    const max = maxCharges(def.genLevel);
    const charges = clock.charges - 1;
    const clocks = {
      ...s.clocks,
      [p.uid]: {
        ...clock,
        charges,
        readyAt: charges < max ? (clock.charges >= max ? now + rechargeMs(def.genLevel) : clock.readyAt) : clock.readyAt,
      },
    };
    const luckyLeft = s.luckyLeft > 0 ? s.luckyLeft - 1 : 0;
    const next: Partial<GameState> = {
      board,
      energy: paid.energy,
      lastEnergyAt: paid.lastEnergyAt,
      discovered: discover(s.discovered, rolled.id),
      selected: empty,
      popUid: drop.uid,
      luckyLeft,
      clocks,
      drySpawns: { ...s.drySpawns, [chain]: rolled.dry },
      undo: null,
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.spawn);
    if (s.luckyLeft === 1) get().pushToast("The lucky tide eases");
    return true;
  },

  movePiece: (from, to) => {
    const s = get();
    if (from === to) return false;
    const a = s.board[from];
    if (!a || s.board[to]) return false;
    if (s.locked.includes(from) || s.locked.includes(to)) {
      get().pushToast("Those planks are still tarped", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const board = s.board.slice();
    board[to] = a;
    board[from] = null;
    const next = { board, selected: to };
    set(next);
    queueSave({ ...s, ...next });
    play(s, sfx.tap);
    return true;
  },

  mergePieces: (from, to) => {
    const s = get();
    const a = s.board[from];
    const b = s.board[to];
    if (!a || !b || from === to) return false;
    if (!canMerge(a.itemId, b.itemId)) {
      play(s, sfx.invalid);
      return false;
    }
    if (s.locked.includes(from) && !s.locked.includes(to)) {
      const swap = from;
      from = to;
      to = swap;
    }
    const nextId = nextItemId(a.itemId);
    if (!nextId) return false;
    const merged = piece(nextId);
    const mergedDef = item(nextId);
    const board = s.board.slice();
    board[from] = null;
    board[to] = merged;
    const merges = s.merges + 1;
    let discovered = discover(s.discovered, nextId);
    const prizeId = prizeAfterMerge({ merges, stage: s.stage, mergedId: nextId, unlocked: s.unlocked });
    let placed = { board, inbox: s.inbox, at: -1 as number };
    if (prizeId) {
      placed = placeOrInbox(board, s.inbox, prizeId, to, s.locked);
    }
    let bubbles = s.bubbles.filter((b) => b.cell !== from && b.cell !== to);
    if ((mergedDef?.tier ?? 0) >= 4 && Math.random() < BUBBLE_CHANCE) {
      bubbles = [
        ...bubbles,
        {
          id: `b${Date.now().toString(36)}`,
          cell: to,
          itemId: nextId,
          bornAt: Date.now(),
        },
      ];
    }
    const capstone = Boolean(mergedDef && !mergedDef.nextId && mergedDef.kind === "item");
    // Combo is action-reset, not a clock. The abandonment cap only stops a streak
    // surviving overnight; it is never a play rule and is never checked in tick().
    const comboAt = Date.now();
    const comboCount =
      s.comboCount > 0 && comboAt - s.comboLastAt <= COMBO_ABANDON_MS ? s.comboCount + 1 : 1;
    const clocks = { ...s.clocks };
    if (item(a.itemId)?.kind === "generator") delete clocks[a.uid];
    if (item(b.itemId)?.kind === "generator") delete clocks[b.uid];
    if (mergedDef?.kind === "generator") clocks[merged.uid] = freshClock(Date.now(), mergedDef.genLevel);
    let locked = s.locked;
    if (locked.includes(to)) {
      locked = locked.filter((i) => i !== to);
    }
    const next = {
      board: placed.board,
      inbox: placed.inbox,
      selected: to,
      merges,
      discovered: prizeId ? discover(discovered, prizeId) : discovered,
      popUid: merged.uid,
      comboCount,
      comboLastAt: comboAt,
      lastMerge: {
        index: to,
        uid: merged.uid,
        chain: mergedDef?.chain ?? "tide",
        tier: mergedDef?.tier ?? 1,
        capstone,
      },
      bubbles,
      clocks,
      locked,
      undo: null,
      visitor: maybeVisitor(placed.board, s.stage, s.orderSeed, s.visitor),
      ...withDaily(s, "merges"),
    };
    set(next);
    queueSave({ ...s, ...next });
    play(s, () => sfx.merge(mergedDef?.tier ?? 1, capstone, mergedDef?.chain ?? "tide", comboCount));
    if (s.locked.includes(to) && !locked.includes(to)) {
      get().pushToast("A tarp comes off the plank");
    }
    if (placed.at >= 0 && prizeId) {
      const prizeName = item(prizeId)?.name ?? "A find";
      get().pushToast(prizeId === "pearl-pouch" ? "A prize from the last merge" : `${prizeName} on the dock`);
    } else if (prizeId && placed.at < 0) {
      get().pushToast("Inbox · a prize waits");
    }
    return true;
  },

  useConsumable: (index) => {
    const s = get();
    const p = s.board[index];
    const def = p ? item(p.itemId) : undefined;
    if (!def || def.kind !== "consumable" || !def.consume) return false;
    let board = s.board.slice();
    board[index] = null;
    let inbox = s.inbox;
    let discovered = s.discovered;
    if (def.consume.split) {
      // arming shears is splitAt by another name, so it ends a streak.
      // The energy / charges / chest / pouch branches below do not.
      const next = { board, selected: null, undo: null, armedSplit: true, comboCount: 0, comboLastAt: 0 };
      set(next);
      queueSave({ ...s, ...next } as SaveSlice);
      play(s, sfx.tap);
      get().pushToast("Tap a find to split · tap empty to put the shears back");
      return true;
    }
    if (def.consume.charges) {
      const now = Date.now();
      const clocks = { ...s.clocks };
      for (const cell of board) {
        if (!cell) continue;
        const g = item(cell.itemId);
        if (g?.kind !== "generator") continue;
        const clock = clocks[cell.uid] ?? freshClock(now, g.genLevel);
        const max = maxCharges(g.genLevel);
        clocks[cell.uid] = {
          ...clock,
          charges: Math.min(max, clock.charges + def.consume.charges),
        };
      }
      const next = { board, clocks, selected: null, undo: null };
      set(next);
      queueSave({ ...s, ...next } as SaveSlice);
      play(s, sfx.spawn);
      get().pushToast(`Crates topped · +${def.consume.charges}`);
      return true;
    }
    if (def.consume.energy) {
      const regen = regenEnergy(s.energy, s.lastEnergyAt, Date.now());
      const energy = Math.min(ENERGY_MAX, regen.energy + def.consume.energy);
      const next = {
        board,
        energy,
        lastEnergyAt: energy >= ENERGY_MAX ? Date.now() : regen.lastEnergyAt,
        selected: null,
        undo: null,
      };
      set(next);
      queueSave({ ...s, ...next } as SaveSlice);
      play(s, sfx.spawn);
      get().pushToast(`+${def.consume.energy} energy`);
      return true;
    }
    if (def.consume.drops) {
      const drops = chestDrops(def.consume.drops, s.stage, Math.random, s.unlocked);
      for (const id of drops) {
        const placed = placeOrInbox(board, inbox, id, index, s.locked);
        board = placed.board;
        inbox = placed.inbox;
        discovered = discover(discovered, id);
      }
      const next = { board, inbox, discovered, selected: null, undo: null };
      set(next);
      queueSave({ ...s, ...next } as SaveSlice);
      play(s, sfx.spawn);
      get().pushToast(`Opened · ${drops.length} finds`);
      return true;
    }
    const pearls = s.pearls + (def.consume.pearls ?? 0);
    const next = { board, pearls, selected: null, undo: null };
    set(next);
    queueSave({ ...s, ...next });
    play(s, sfx.sell);
    return true;
  },

  select: (index) => set({ selected: index }),

  sellAt: (index, opts) => {
    const s = get();
    const p = s.board[index];
    const def = p ? item(p.itemId) : undefined;
    if (!p || !def) return false;
    if (s.locked.includes(index)) {
      get().pushToast("Merge onto the tarp to free it", "warn");
      play(s, sfx.invalid);
      return false;
    }
    if (def.kind === "generator") {
      get().pushToast("Crates stay on the dock", "warn");
      play(s, sfx.invalid);
      return false;
    }
    // Risky sells need confirming. This is the single choke point every sell path
    // goes through (double-tap, drag to the sell well, the Sell button, the cupboard
    // sell well), so the guard cannot be bypassed by adding another caller.
    const needed = neededFromOrders(s.orders);
    const onOrder = needed.has(p.itemId);
    if ((onOrder || def.tier >= 6) && !opts?.confirmed) {
      set({ selected: index });
      get().pushToast(
        onOrder ? "Wanted on an order — use Sell to confirm" : "High find — use Sell to confirm",
        "warn",
      );
      play(s, sfx.invalid);
      return false;
    }
    const board = s.board.slice();
    board[index] = null;
    const pearls = s.pearls + def.sell;
    const next = {
      board,
      pearls,
      selected: null,
      undo: { index, piece: p, pearlsSpent: def.sell },
      bubbles: s.bubbles.filter((b) => b.cell !== index),
    };
    set(next);
    queueSave({ ...s, ...next });
    play(s, sfx.sell);
    get().breakCombo();
    return true;
  },

  undoSell: () => {
    const s = get();
    if (!s.undo) return false;
    if (s.pearls < s.undo.pearlsSpent) {
      get().pushToast("Not enough pearls to undo", "warn");
      return false;
    }
    const board = s.board.slice();
    let index = s.undo.index;
    if (board[index]) {
      const empty = nearestEmpty(index, board, COLS, new Set(s.locked));
      if (empty < 0) {
        get().pushToast("No room to undo", "warn");
        return false;
      }
      index = empty;
    }
    board[index] = s.undo.piece;
    const next = { board, pearls: s.pearls - s.undo.pearlsSpent, undo: null, selected: index };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.tap);
    get().pushToast("Undid the sale");
    return true;
  },

  deliver: (slot) => {
    const s = get();
    const cap = (s.stage + 1) * DELIVERIES_PER_STAGE;
    if (s.taskIndex >= cap) return false;
    const order =
      slot != null
        ? s.orders.find((o) => o.slot === slot)
        : s.orders.find((o) => canFillOrder(s.board, s.storage, o, s.locked));
    if (!order || !canFillOrder(s.board, s.storage, order, s.locked)) return false;
    const taken = takeFromPools(s.board, s.storage, order, s.locked);
    let board = taken.board;
    const storage = taken.storage;
    let inbox = s.inbox;
    let discovered = s.discovered;
    if (order.rewardItem) {
      const placed = placeOrInbox(board, inbox, order.rewardItem, Math.floor(BOARD_SIZE / 2), s.locked);
      board = placed.board;
      inbox = placed.inbox;
      discovered = discover(discovered, order.rewardItem);
    }
    const taskIndex = s.taskIndex + 1;
    const lastStageDone = s.stage >= STAGE_COUNT - 1 && taskIndex >= STAGE_COUNT * DELIVERIES_PER_STAGE;
    const xp = s.xp + order.xp;
    const prevLevel = levelFromXp(s.xp);
    const nextLevel = levelFromXp(xp);
    const orderSeed = s.orderSeed + 1;
    let stage = s.stage;
    let orders = replaceOrder(s.orders, order.slot, s.stage, orderSeed, s.unlocked);
    let villageStage = Math.max(s.villageStage, villageForStage(s.stage));
    let advanced = false;
    if (taskIndex >= (stage + 1) * DELIVERIES_PER_STAGE && stage < STAGE_COUNT - 1) {
      stage += 1;
      orders = seedOrders(stage, s.unlocked);
      villageStage = Math.max(villageStage, villageForStage(stage));
      advanced = true;
    }
    if (nextLevel > prevLevel) {
      const placed = placeOrInbox(board, inbox, "chest-1", Math.floor(BOARD_SIZE / 2), s.locked);
      board = placed.board;
      inbox = placed.inbox;
      discovered = discover(discovered, "chest-1");
    }
    const next = {
      board,
      storage,
      inbox,
      pearls: s.pearls + order.pearls,
      xp,
      taskIndex,
      stage,
      villageStage,
      delivered: s.delivered + 1,
      won: lastStageDone,
      discovered,
      orders,
      orderSeed,
      selected: null,
      undo: null,
      visitor: maybeVisitor(board, stage, orderSeed, s.visitor),
      ...withDaily(s, "orders"),
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice, true);
    play(s, nextLevel > prevLevel ? sfx.level : sfx.deliver);
    if (advanced) get().pushToast(`${stageName(stage)} is open`);
    else if (nextLevel > prevLevel) get().pushToast(`The tide rises — level ${nextLevel + 1}`);
    get().breakCombo();
    return true;
  },

  deliverVisitor: () => {
    const s = get();
    const order = s.visitor;
    if (!order || !canFillOrder(s.board, s.storage, order, s.locked)) return false;
    const taken = takeFromPools(s.board, s.storage, order, s.locked);
    let board = taken.board;
    const storage = taken.storage;
    let inbox = s.inbox;
    let discovered = s.discovered;
    if (order.rewardItem) {
      const placed = placeOrInbox(board, inbox, order.rewardItem, Math.floor(BOARD_SIZE / 2), s.locked);
      board = placed.board;
      inbox = placed.inbox;
      discovered = discover(discovered, order.rewardItem);
    }
    const next = {
      board,
      storage,
      inbox,
      pearls: s.pearls + order.pearls,
      xp: s.xp + order.xp,
      delivered: s.delivered + 1,
      discovered,
      visitor: null,
      selected: null,
      undo: null,
      ...withDaily(s, "orders"),
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice, true);
    play(s, sfx.deliver);
    get().breakCombo();
    return true;
  },

  unlockStage: () => {
    const s = get();
    if (s.stage >= STAGE_COUNT - 1) {
      get().pushToast("The last reach is already open");
      return false;
    }
    if (s.taskIndex < (s.stage + 1) * DELIVERIES_PER_STAGE) {
      get().pushToast("Finish this reach first", "warn");
      return false;
    }
    const stage = s.stage + 1;
    const next = {
      stage,
      orders: seedOrders(stage, s.unlocked),
      villageStage: Math.max(s.villageStage, villageForStage(stage)),
    };
    set(next);
    queueSave({ ...s, ...next });
    play(s, sfx.level);
    get().pushToast(`${stageName(stage)} is open`);
    get().breakCombo();
    return true;
  },

  buyLook: (id) => {
    const s = get();
    const look = lookById(id);
    if (!look) return false;
    if (s.cosmetics[id]) {
      get().pushToast("Already on the dock");
      return false;
    }
    if (s.pearls < look.cost) {
      get().pushToast("Not enough pearls", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const cosmetics = { ...s.cosmetics, [id]: true };
    const next = { pearls: s.pearls - look.cost, cosmetics };
    set(next);
    queueSave({ ...s, ...next });
    play(s, sfx.level);
    get().pushToast(look.name);
    get().breakCombo();
    return true;
  },

  buyBoost: (id) => {
    const s = get();
    const boost = boostById(id);
    if (!boost) return false;
    if (s.pearls < boost.cost) {
      get().pushToast("Not enough pearls", "warn");
      play(s, sfx.invalid);
      return false;
    }
    if (id === "sip") {
      const regen = regenEnergy(s.energy, s.lastEnergyAt, Date.now());
      if (regen.energy >= ENERGY_MAX) {
        get().pushToast("Energy is already full");
        return false;
      }
      const energy = Math.min(ENERGY_MAX, regen.energy + SIP_ENERGY);
      const next = {
        pearls: s.pearls - boost.cost,
        energy,
        lastEnergyAt: energy >= ENERGY_MAX ? Date.now() : regen.lastEnergyAt,
      };
      set(next);
      queueSave({ ...s, ...next });
      play(s, sfx.spawn);
      get().pushToast(`+${SIP_ENERGY} energy`);
      return true;
    }
    if (id === "lucky") {
      const next = {
        pearls: s.pearls - boost.cost,
        luckyLeft: s.luckyLeft + LUCKY_CHARGES,
      };
      set(next);
      queueSave({ ...s, ...next });
      play(s, sfx.sell);
      get().breakCombo();
      get().pushToast(`Lucky tide · ${next.luckyLeft}`);
      return true;
    }
    if (id === "shears") {
      const placed = placeOrInbox(s.board.slice(), s.inbox, "shears", Math.floor(BOARD_SIZE / 2), s.locked);
      if (placed.at < 0 && placed.inbox.length === s.inbox.length) {
        get().pushToast("The board is full — merge, store, or sell", "warn");
        play(s, sfx.invalid);
        return false;
      }
      const drop = placed.at >= 0 ? placed.board[placed.at] : null;
      const next = {
        pearls: s.pearls - boost.cost,
        board: placed.board,
        inbox: placed.inbox,
        discovered: discover(s.discovered, "shears"),
        selected: placed.at >= 0 ? placed.at : s.selected,
        popUid: drop?.uid ?? null,
      };
      set(next);
      queueSave({ ...s, ...next } as SaveSlice);
      play(s, sfx.spawn);
      get().breakCombo();
      get().pushToast("Holt's shears");
      return true;
    }
    const needId = s.orders.flatMap((o) => o.requires.map((r) => r.itemId)).find((id) => {
      const need = s.orders.reduce((n, o) => n + o.requires.filter((r) => r.itemId === id).reduce((a, r) => a + r.count, 0), 0);
      const have = s.board.filter((p) => p?.itemId === id).length + s.storage.filter((p) => p?.itemId === id).length;
      return have < need;
    });
    if (!needId) {
      get().pushToast("The orders are already on the dock");
      return false;
    }
    const placed = placeOrInbox(s.board.slice(), s.inbox, needId, Math.floor(BOARD_SIZE / 2), s.locked);
    if (placed.at < 0 && placed.inbox.length === s.inbox.length) {
      get().pushToast("The board is full — merge, store, or sell", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const drop = placed.at >= 0 ? placed.board[placed.at] : null;
    const next = {
      pearls: s.pearls - boost.cost,
      board: placed.board,
      inbox: placed.inbox,
      discovered: discover(s.discovered, needId),
      selected: placed.at >= 0 ? placed.at : s.selected,
      popUid: drop?.uid ?? null,
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.spawn);
    get().breakCombo();
    get().pushToast(item(needId)?.name ?? "Parcel");
    return true;
  },

  buyCrate: (chain) => {
    const s = get();
    const crate = CRATES.find((c) => c.id === chain);
    if (!crate) return false;
    if (hasProducer(s.board, chain)) {
      get().pushToast("Already on the dock");
      return false;
    }
    if (s.pearls < crate.cost) {
      get().pushToast("Not enough pearls", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const board = s.board.slice();
    const empty = nearestEmpty(42, board, COLS, new Set(s.locked));
    if (empty < 0) {
      get().pushToast("The board is full — merge or sell", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const drop = piece(crate.itemId);
    board[empty] = drop;
    const gen = item(crate.itemId);
    const next = {
      pearls: s.pearls - crate.cost,
      board,
      discovered: discover(s.discovered, crate.itemId),
      selected: empty,
      popUid: drop.uid,
      clocks: {
        ...s.clocks,
        [drop.uid]: freshClock(Date.now(), gen?.genLevel),
      },
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.spawn);
    get().pushToast(crate.name);
    get().breakCombo();
    return true;
  },

  storeFromBoard: (index) => {
    const s = get();
    const p = s.board[index];
    if (!p) return false;
    if (s.locked.includes(index)) {
      get().pushToast("Merge onto the tarp to free it", "warn");
      play(s, sfx.invalid);
      return false;
    }
    if (item(p.itemId)?.kind === "generator") {
      get().pushToast("Crates stay on the dock", "warn");
      return false;
    }
    const slot = firstEmptyStorage(s.storage);
    if (slot < 0) {
      get().pushToast("The cupboard is full", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const board = s.board.slice();
    const storage = s.storage.slice();
    board[index] = null;
    storage[slot] = p;
    const next = {
      board,
      storage,
      selected: null,
      bubbles: s.bubbles.filter((b) => b.cell !== index),
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.tap);
    return true;
  },

  storeToBoard: (slot) => {
    const s = get();
    const p = s.storage[slot];
    if (!p) return false;
    const board = s.board.slice();
    const empty = nearestEmpty(27, board, COLS, new Set(s.locked));
    if (empty < 0) {
      get().pushToast("The board is full — merge or sell", "warn");
      play(s, sfx.invalid);
      return false;
    }
    board[empty] = p;
    const storage = s.storage.slice();
    storage[slot] = null;
    const next = { board, storage, selected: empty, popUid: p.uid };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.spawn);
    return true;
  },

  pullInbox: () => {
    const s = get();
    if (!s.inbox.length) return false;
    const id = s.inbox[0]!;
    const placed = placeOrInbox(s.board.slice(), s.inbox.slice(1), id, 27, s.locked);
    if (placed.at < 0) {
      get().pushToast("The board is full — merge or sell", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const drop = placed.board[placed.at];
    const clocks = { ...s.clocks };
    const def = item(id);
    if (drop && def?.kind === "generator") {
      clocks[drop.uid] = freshClock(Date.now(), def.genLevel);
    }
    const next = {
      board: placed.board,
      inbox: placed.inbox,
      selected: placed.at,
      popUid: drop?.uid ?? null,
      discovered: discover(s.discovered, id),
      clocks,
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.spawn);
    return true;
  },

  takeBubble: (id) => {
    const s = get();
    const bubble = s.bubbles.find((b) => b.id === id);
    if (!bubble) return false;
    if (s.pearls < BUBBLE_TAKE_COST) {
      get().pushToast("Not enough pearls", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const placed = placeOrInbox(s.board.slice(), s.inbox, bubble.itemId, bubble.cell, s.locked);
    const next = {
      pearls: s.pearls - BUBBLE_TAKE_COST,
      board: placed.board,
      inbox: placed.inbox,
      bubbles: s.bubbles.filter((b) => b.id !== id),
      discovered: discover(s.discovered, bubble.itemId),
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.spawn);
    get().pushToast(item(bubble.itemId)?.name ?? "Taken");
    return true;
  },

  payCove: () => {
    const s = get();
    const node = COVE_NODES[s.coveNode];
    if (!node) {
      get().pushToast("The cove is restored");
      return false;
    }
    const step = node.steps[s.coveStep];
    if (!step) return false;
    if (!canPayStep(s.board, s.storage, s.pearls, step, s.locked)) {
      get().pushToast("Need tools and pearls", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const paid = payStep(s.board, s.storage, step, s.locked);
    if (!paid.ok) return false;
    let coveStep = s.coveStep + 1;
    let coveNode = s.coveNode;
    let villageStage = s.villageStage;
    let inbox = s.inbox;
    let unlocked = s.unlocked;
    let locked = s.locked;
    let orders = s.orders;
    let orderSeed = s.orderSeed;
    let discovered = s.discovered;
    let board = paid.board;
    let clocks = { ...s.clocks };
    let finished = false;
    let mailedOnDock = false;
    let lastRestore: LastRestore | null = s.lastRestore;
    if (coveStep >= node.steps.length) {
      coveStep = 0;
      coveNode += 1;
      villageStage = Math.max(villageStage, Math.min(coveNode, COVE_NODES.length));
      finished = true;
      for (const id of node.mail) {
        const placed = placeOrInbox(board, inbox, id, 27, locked);
        board = placed.board;
        inbox = placed.inbox;
        discovered = discover(discovered, id);
        const drop = placed.at >= 0 ? board[placed.at] : null;
        const def = item(id);
        if (drop && def?.kind === "generator") {
          clocks[drop.uid] = freshClock(Date.now(), def.genLevel);
          mailedOnDock = true;
        }
      }
      if (node.unlocks && !unlocked.includes(node.unlocks)) {
        unlocked = [...unlocked, node.unlocks];
        orderSeed += 1;
        orders = replaceOrder(orders, 0, s.stage, orderSeed, unlocked);
      }
      if (locked.length) {
        locked = freeLocked(locked).locked;
      }
      lastRestore = {
        id: node.id,
        name: node.name,
        story: node.story,
        mail: [...node.mail],
      };
    }
    const next = {
      board,
      storage: paid.storage,
      pearls: s.pearls - step.pearls,
      coveNode,
      coveStep,
      villageStage,
      inbox,
      unlocked,
      locked,
      orders,
      orderSeed,
      discovered,
      clocks,
      lastRestore,
      ...withDaily(s, "nodes"),
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.level);
    if (finished) {
      const mailed = node.mail.map((id) => item(id)?.name ?? id).join(" · ");
      get().pushToast(
        mailedOnDock
          ? `${node.name} · ${mailed} on the dock`
          : mailed
            ? `${node.name} · inbox · ${mailed}`
            : node.name,
      );
    } else {
      get().pushToast(`${node.name} · step ${coveStep}/${node.steps.length}`);
    }
    get().breakCombo();
    return true;
  },

  splitAt: (index) => {
    const s = get();
    if (!s.armedSplit) return false;
    const refund = () => {
      const placed = placeOrInbox(s.board.slice(), s.inbox, "shears", index, s.locked);
      const drop = placed.at >= 0 ? placed.board[placed.at] : null;
      set({
        board: placed.board,
        inbox: placed.inbox,
        armedSplit: false,
        selected: placed.at >= 0 ? placed.at : s.selected,
        popUid: drop?.uid ?? null,
        discovered: discover(s.discovered, "shears"),
      });
      queueSave({
        ...s,
        board: placed.board,
        inbox: placed.inbox,
        armedSplit: false,
        discovered: discover(s.discovered, "shears"),
      } as SaveSlice);
    };
    const p = s.board[index];
    const def = p ? item(p.itemId) : undefined;
    if (!p || !def) {
      refund();
      get().pushToast("Shears back on the dock");
      return false;
    }
    if (s.locked.includes(index)) {
      get().pushToast("Merge onto the tarp to free it", "warn");
      play(s, sfx.invalid);
      return false;
    }
    if (def.kind === "generator") {
      get().pushToast("Crates cannot be split", "warn");
      play(s, sfx.invalid);
      return false;
    }
    const prev = prevItemId(p.itemId);
    if (!prev) {
      get().pushToast("Nothing lower to split into", "warn");
      play(s, sfx.invalid);
      refund();
      return false;
    }
    const board = s.board.slice();
    const empty = nearestEmpty(index, board, COLS, new Set(s.locked));
    if (empty < 0) {
      get().pushToast("Need one empty plank to split", "warn");
      play(s, sfx.invalid);
      return false;
    }
    board[index] = piece(prev);
    board[empty] = piece(prev);
    const next = {
      board,
      armedSplit: false,
      selected: index,
      popUid: board[empty]!.uid,
      discovered: discover(s.discovered, prev),
      undo: null,
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.merge);
    get().pushToast(`Split into ${item(prev)?.name ?? "finds"}`);
    get().breakCombo();
    return true;
  },

  dismissRestore: () => set({ lastRestore: null }),

  disarmSplit: () => {
    const s = get();
    if (!s.armedSplit) return;
    const placed = placeOrInbox(s.board.slice(), s.inbox, "shears", 27, s.locked);
    const drop = placed.at >= 0 ? placed.board[placed.at] : null;
    const next = {
      board: placed.board,
      inbox: placed.inbox,
      armedSplit: false,
      selected: placed.at >= 0 ? placed.at : s.selected,
      popUid: drop?.uid ?? null,
      discovered: discover(s.discovered, "shears"),
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
  },

  claimDaily: () => {
    const s = get();
    const today = dayKey();
    const daily = s.dailyDay === today ? s.daily : emptyDaily();
    if (!dailyComplete(daily) || daily.claimed) {
      get().pushToast("Morning tide is not done", "warn");
      return false;
    }
    const placed = placeOrInbox(s.board.slice(), s.inbox, "chest-1", Math.floor(BOARD_SIZE / 2), s.locked);
    const drop = placed.at >= 0 ? placed.board[placed.at] : null;
    const next = {
      board: placed.board,
      inbox: placed.inbox,
      pearls: s.pearls + 6,
      dailyDay: today,
      daily: { ...daily, claimed: true },
      discovered: discover(s.discovered, "chest-1"),
      selected: placed.at >= 0 ? placed.at : s.selected,
      popUid: drop?.uid ?? null,
    };
    set(next);
    queueSave({ ...s, ...next } as SaveSlice);
    play(s, sfx.level);
    get().pushToast("Morning tide · oddments and pearls");
    return true;
  },

  tick: (now = Date.now()) => {
    const s = get();
    const broken =
      !Number.isFinite(s.pearls) ||
      !Number.isFinite(s.energy) ||
      !Number.isFinite(s.xp) ||
      !Array.isArray(s.board) ||
      s.board.length !== BOARD_SIZE ||
      (Array.isArray(s.inbox) && s.inbox.length > INBOX_CAP) ||
      (typeof s.coveStep === "number" && s.coveStep > 12);
    if (broken) {
      const healed = healSave(s, now);
      set({ ...healed.save, lastTickAt: now } as SaveSlice);
      queueSave(healed.save);
      if (healed.notes.length) get().pushToast(keepLine(healed.notes));
      return;
    }
    const elapsed = Math.min(OFFLINE_CAP_MS, Math.max(0, now - (s.lastTickAt || now)));
    if (!s.hydrated && elapsed < 400) return;
    if (s.taskIndex >= (s.stage + 1) * DELIVERIES_PER_STAGE && s.stage < STAGE_COUNT - 1) {
      const stage = s.stage + 1;
      const next = {
        stage,
        orders: seedOrders(stage, s.unlocked),
        villageStage: Math.max(s.villageStage, villageForStage(stage)),
        lastTickAt: now,
      };
      set(next);
      queueSave({ ...s, ...next } as SaveSlice);
      get().pushToast(`${stageName(stage)} is open`);
      return;
    }
    let board = s.board.slice();
    let inbox = s.inbox;
    let pearls = s.pearls;
    const clocks = { ...s.clocks };
    let dirty = false;
    const regen = regenEnergy(s.energy, s.lastEnergyAt, now);
    let energy = regen.energy;
    let lastEnergyAt = regen.lastEnergyAt;
    if (energy !== s.energy) dirty = true;
    for (const p of board) {
      if (!p) continue;
      const def = item(p.itemId);
      if (def?.kind !== "generator") continue;
      const clock = clocks[p.uid] ?? freshClock(now, def.genLevel);
      const max = maxCharges(def.genLevel);
      const gap = rechargeMs(def.genLevel);
      let charges = clock.charges;
      let readyAt = clock.readyAt;
      if (readyAt - now > gap) {
        readyAt = now + gap;
        dirty = true;
      }
      while (charges < max && readyAt <= now) {
        charges += 1;
        readyAt += gap;
        dirty = true;
      }
      let autoAt = clock.autoAt || now + AUTO_TICK_MS;
      if (autoAt - now > AUTO_TICK_MS) {
        autoAt = now + AUTO_TICK_MS;
        dirty = true;
      }
      if (def.genLevel === 2) {
        // Cap the backlog itself, not just the drops emitted per tick. Without this the
        // loop stops after AUTO_CATCHUP_MAX but leaves autoAt in the past, so the next
        // tick (1s later) pays out another full batch, and so on for hundreds of ticks.
        // Skipping whole intervals keeps the sub-interval remainder, so leftover time
        // toward the next drop still carries over.
        const behind = now - autoAt;
        if (behind >= 0) {
          const due = Math.floor(behind / AUTO_TICK_MS) + 1;
          if (due > AUTO_CATCHUP_MAX) {
            autoAt += (due - AUTO_CATCHUP_MAX) * AUTO_TICK_MS;
            dirty = true;
          }
        }
        let autos = 0;
        while (autoAt <= now && autos < AUTO_CATCHUP_MAX) {
          const idx = board.findIndex((cell) => cell?.uid === p.uid);
          const n = idx >= 0 ? neighborEmpty(idx, board, COLS, s.locked) : -1;
          const chain = (def.produces ?? "tide") as PlayChain;
          const rolled = pityRoll(chain, 2, 0, Math.random, false);
          if (n < 0) {
            if (inbox.length < INBOX_CAP) inbox = [...inbox, rolled.id];
          } else {
            board[n] = piece(rolled.id);
          }
          dirty = true;
          autos += 1;
          autoAt += AUTO_TICK_MS;
        }
      }
      clocks[p.uid] = { charges, readyAt, autoAt };
    }
    const still: Bubble[] = [];
    for (const b of s.bubbles) {
      if (now - b.bornAt >= BUBBLE_WAIT_MS) {
        pearls += 3;
        dirty = true;
      } else still.push(b);
    }
    if (!dirty && elapsed < 1000) {
      return;
    }
    const today = dayKey(now);
    const daily = s.dailyDay === today ? s.daily : emptyDaily();
    const visitor = maybeVisitor(board, s.stage, s.orderSeed, s.visitor);
    if (!dirty) {
      set({ lastTickAt: now, clocks, dailyDay: today, daily, visitor, energy, lastEnergyAt });
      return;
    }
    const next = {
      board,
      inbox,
      pearls,
      energy,
      lastEnergyAt,
      clocks,
      bubbles: still,
      lastTickAt: now,
      dailyDay: today,
      daily,
      visitor,
    };
    const healed = healSave({ ...s, ...next } as SaveSlice, now);
    set({ ...next, ...healed.save });
    queueSave(healed.save);
    if (healed.notes.length) get().pushToast(keepLine(healed.notes));
  },

  scanKeep: (quiet = false) => {
    const now = Date.now();
    const healed = healSave(get(), now);
    set({ ...healed.save } as SaveSlice);
    queueSave(healed.save);

    const finish = (artMiss: Array<{ topic: string; text: string }>) => {
      const overlay = scanOverlays();
      const findings = [
        ...artMiss,
        ...overlay.map((text) => ({ topic: "overlay", text })),
      ];
      const s = get();
      const result = applyKeepScan(s.keepLog, s.letters, findings, Date.now());
      const changed = result.opened.length + result.fixed.length;
      if (changed) {
        const keepRepairs = s.keepRepairs + changed;
        set({ keepLog: result.keepLog, letters: result.letters, keepRepairs });
        queueSave({ ...s, keepLog: result.keepLog, letters: result.letters, keepRepairs });
      }
      if (result.opened.length) {
        const first = result.opened[0]!;
        get().pushToast(
          result.opened.length === 1 ? `The Keep: ${first.body}` : `The Keep found ${result.opened.length} faults`,
          "warn",
        );
      } else if (result.fixed.length) {
        get().pushToast(
          result.fixed.length === 1 ? "The Keep mended a fault" : `The Keep mended ${result.fixed.length} faults`,
        );
      } else if (healed.notes.length) {
        get().pushToast(keepLine(healed.notes));
      } else if (!quiet) {
        get().pushToast("The Keep: dock is clean");
      }
    };

    if (typeof window === "undefined") {
      finish([]);
      return;
    }
    void (async () => {
      const ids = Object.keys(ITEMS);
      const flags = await Promise.all(
        ids.map(async (id) => {
          const def = ITEMS[id];
          if (!def?.src) return { topic: `art:${id}`, text: `${def?.name ?? id} has no picture` };
          const ok = await probeArt(def.src);
          return ok ? null : { topic: `art:${id}`, text: `${def.name} has no picture` };
        }),
      );
      finish(flags.filter((x): x is { topic: string; text: string } => x != null));
    })();
  },

  noteArtFault: (itemId) => {
    const def = item(itemId);
    if (!def) return;
    const s = get();
    const now = Date.now();
    const result = applyKeepScan(s.keepLog, s.letters, [{ topic: `art:${itemId}`, text: `${def.name} has no picture` }], now);
    if (!result.opened.length) return;
    const keepRepairs = s.keepRepairs + result.opened.length;
    set({ keepLog: result.keepLog, letters: result.letters, keepRepairs });
    queueSave({ ...s, keepLog: result.keepLog, letters: result.letters, keepRepairs });
  },

  readKeepMail: () => {
    set((s) => {
      if (!s.letters.some((l) => !l.read)) return s;
      const letters = s.letters.map((l) => (l.read ? l : { ...l, read: true }));
      queueSave({ ...s, letters });
      return { letters };
    });
  },

  dismissHowTo: () => {
    set((s) => {
      const next = { ...s, seenHowTo: true, seenLoop: true };
      queueSave(next);
      return { seenHowTo: true, seenLoop: true };
    });
  },

  toggleSfx: () => {
    set((s) => {
      const sfxOn = !s.sfxOn;
      queueSave({ ...s, sfxOn });
      return { sfxOn };
    });
  },

  breakCombo: () => {
    if (get().comboCount === 0) return;
    set({ comboCount: 0, comboLastAt: 0 });
  },

  pushToast: (text, kind = "ok") => {
    const id = uidToast();
    set((s) => {
      const last = s.toasts[s.toasts.length - 1];
      const next =
        last && last.text === text && last.kind === kind
          ? [...s.toasts.slice(0, -1), { id, text, kind, count: (last.count ?? 1) + 1 }]
          : [...s.toasts.slice(-1), { id, text, kind, count: 1 }];
      return { toasts: next };
    });
    if (typeof window === "undefined") return;
    window.setTimeout(
      () => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      },
      kind === "warn" ? 2600 : 1600,
    );
  },

  spawnFx: (burst) => {
    const id = uidToast();
    set((s) => ({ fx: [...s.fx, { ...burst, id }] }));
    if (typeof window === "undefined") return;
    window.setTimeout(() => get().clearFx(id), 700);
  },

  clearFx: (id) => set((s) => ({ fx: s.fx.filter((f) => f.id !== id) })),
}));

/** Hygiene only: stops a streak surviving an overnight gap. Not a play clock. */
const COMBO_ABANDON_MS = 30_000;

let toastN = 0;
function uidToast() {
  toastN += 1;
  return `t${toastN}`;
}

function probeArt(src: string): Promise<boolean> {
  if (typeof Image === "undefined") return Promise.resolve(true);
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    window.setTimeout(() => done(true), 2500);
    img.src = src;
  });
}

export function flushSave() {
  const s = useGame.getState();
  if (!s.hydrated) return;
  try {
    const blob = JSON.stringify(snapshot(s));
    localStorage.setItem(SAVE_KEY, blob);
    localStorage.setItem(`${SAVE_KEY}-bak`, blob);
  } catch {
    /* ignore */
  }
}

if (typeof window !== "undefined") {
  (window as unknown as { __saltwharf: typeof useGame }).__saltwharf = useGame;
}
