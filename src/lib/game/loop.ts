import { asset } from "../utils";
import {
  CHAINS,
  CHARACTERS,
  COLS,
  ITEMS,
  nearestEmpty,
  piece,
  stageName,
  type Board,
  type Piece,
  type PlayChain,
  type TaskDef,
} from "./catalog";

export const ORDER_SLOTS = 4;
export const LAST_N = 5;
export const STORAGE_SIZE = 8;
export const GEN_CHARGES = 10;
export const GEN_CHARGES_L2 = 14;
export const GEN_RECHARGE_MS = 7_000;
export const GEN_RECHARGE_L2_MS = 5_000;
export const AUTO_TICK_MS = 32_000;
export const AUTO_CATCHUP_MAX = 24;
export const ENERGY_MAX = 100;
export const ENERGY_REGEN_MS = 15_000;
export const TAP_ENERGY = 1;
export const FLASK_ENERGY = 25;
export const SIP_ENERGY = 25;
export const SIP_COST = 18;
export const BUBBLE_CHANCE = 0.2;
export const BUBBLE_WAIT_MS = 25_000;
export const BUBBLE_TAKE_COST = 8;
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;
export const INBOX_CAP = 24;

export type ToolId = "hammer" | "paint" | "lamp";

/**
 * A condition is a BONUS, never a gate. There is no reroll and no skip in this
 * game: an order holds its slot until it is delivered. A condition that gated
 * delivery and could go permanently false -- thrift, the first time the player
 * sells -- would soft-lock one of four dock slots for the rest of the run.
 * So the items always deliver the order; meeting the condition pays extra.
 */
export type OrderCondition =
  | { kind: "deep"; itemId: string }
  | { kind: "thrift" }
  | { kind: "streak"; need: number };

export type LiveOrder = TaskDef & {
  slot: number;
  kind: "resident" | "auto";
  /** absent on every order written before 2b, which is why it must stay optional */
  condition?: OrderCondition;
  progress?: { clean?: boolean; best?: number };
  bonus?: number;
};

export const CONDITION_BONUS = 6;

/** Absent condition counts as met; the bonus is 0 either way, so old orders are unaffected. */
export function conditionMet(order: LiveOrder, discovered: readonly string[]): boolean {
  const c = order.condition;
  if (!c) return true;
  if (c.kind === "deep") return discovered.includes(c.itemId);
  if (c.kind === "thrift") return order.progress?.clean !== false;
  return (order.progress?.best ?? 0) >= c.need;
}

export function conditionLine(order: LiveOrder): string | null {
  const c = order.condition;
  if (!c) return null;
  if (c.kind === "deep") return `and a ${ITEMS[c.itemId]?.name ?? "find"} you have never made`;
  if (c.kind === "thrift") return "without selling anything first";
  return `land a run of ${c.need} merges while it waits`;
}

export type Bubble = {
  id: string;
  cell: number;
  itemId: string;
  bornAt: number;
};

export type GenClock = {
  charges: number;
  readyAt: number;
  autoAt: number;
};

export type CoveStep = {
  pearls: number;
  hammer?: number;
  paint?: number;
  lamp?: number;
};

export type CoveNode = {
  id: string;
  name: string;
  line: string;
  story: string;
  mail: string[];
  unlocks?: PlayChain;
  x: number;
  y: number;
  steps: CoveStep[];
};

export type UndoSell = {
  index: number;
  piece: Piece;
  pearlsSpent: number;
};

export const STARTER_UNLOCKED: PlayChain[] = ["tide", "hearth"];
export const UNLOCK_ORDER: PlayChain[] = ["tide", "hearth", "craft", "net", "bloom", "wreck", "keep"];
export const START_LOCKED: number[] = Array.from({ length: 14 }, (_, i) => i);
export const CELLS_FREED_PER_NODE = 4;

export const COVE_NODES: CoveNode[] = [
  {
    id: "stoop",
    name: "Swept Stoop",
    line: "Mae's shutters. One honest hinge at a time.",
    story: "The inn breathes. A Tackle Box waits in the mail — craft for the pier.",
    mail: ["gen-craft-1"],
    unlocks: "craft",
    x: 34,
    y: 46,
    steps: [
      { pearls: 6, lamp: 1 },
      { pearls: 10, hammer: 1 },
      { pearls: 16, lamp: 2 },
    ],
  },
  {
    id: "gull",
    name: "The Gull Reopens",
    line: "Lila will not serve until the trim is teal again.",
    story: "Flour in the air. A second pantry basket — merge it for a hamper that ticks.",
    mail: ["gen-hearth-1"],
    x: 50,
    y: 48,
    steps: [
      { pearls: 10, paint: 1 },
      { pearls: 14, paint: 2 },
      { pearls: 20, hammer: 2 },
    ],
  },
  {
    id: "pier",
    name: "Painted Pier",
    line: "Holt's boards. The boats remember the slips.",
    story: "The creel is in the mail. Catch opens — clownfish on up to the great white.",
    mail: ["gen-net-1"],
    unlocks: "net",
    x: 78,
    y: 74,
    steps: [
      { pearls: 12, hammer: 2 },
      { pearls: 18, hammer: 3 },
      { pearls: 24, lamp: 2 },
    ],
  },
  {
    id: "garden",
    name: "Mae's Garden",
    line: "Salt-tough beds behind the inn. Something wants to grow.",
    story: "A Seed Tin on the stoop. Bloom is Mae's window coming back.",
    mail: ["gen-bloom-1"],
    unlocks: "bloom",
    x: 24,
    y: 16,
    steps: [
      { pearls: 14, paint: 2 },
      { pearls: 20, lamp: 3 },
      { pearls: 26, paint: 3 },
    ],
  },
  {
    id: "slip",
    name: "The Old Slip",
    line: "A dinghy on the rocks. Cork and rope still honest.",
    story: "Wreck salvage. The crate smells of salt and a winter at sea.",
    mail: ["gen-wreck-1"],
    unlocks: "wreck",
    x: 18,
    y: 74,
    steps: [
      { pearls: 16, hammer: 3 },
      { pearls: 22, lamp: 3 },
      { pearls: 28, hammer: 4 },
    ],
  },
  {
    id: "lanterns",
    name: "First Lanterns",
    line: "Warm glass along the rail. Evening has a place to sit.",
    story: "A second creel. Merge the two and the channel ticks by itself.",
    mail: ["gen-net-1"],
    x: 68,
    y: 64,
    steps: [
      { pearls: 18, lamp: 3 },
      { pearls: 24, paint: 3 },
      { pearls: 32, lamp: 4 },
    ],
  },
  {
    id: "shed",
    name: "Holt's Shed",
    line: "Nails in jars. The latches still sing.",
    story: "A coin chest from the old mint. Keep prizes live here now.",
    mail: ["gen-keep-1"],
    unlocks: "keep",
    x: 82,
    y: 26,
    steps: [
      { pearls: 22, hammer: 4 },
      { pearls: 28, paint: 4 },
      { pearls: 36, hammer: 5 },
    ],
  },
  {
    id: "lights",
    name: "Harbor Lights",
    line: "Bunting, boats, and a feast for the cove that stayed.",
    story: "The square remembers how to shine. A better chest, and another tackle box.",
    mail: ["chest-2", "gen-craft-1"],
    x: 44,
    y: 58,
    steps: [
      { pearls: 24, paint: 4 },
      { pearls: 32, lamp: 4 },
      { pearls: 40, hammer: 5 },
      { pearls: 52, hammer: 5, paint: 5, lamp: 5 },
    ],
  },
];

export function siteArt(id: string, restored: boolean): string {
  return asset(`/village/sites/${id}-${restored ? "restored" : "ruined"}.jpg`);
}

export function orderWindow(unlocked: readonly PlayChain[]): PlayChain[] {
  const ordered = UNLOCK_ORDER.filter((c) => unlocked.includes(c));
  const src = ordered.length ? ordered : STARTER_UNLOCKED;
  return src.slice(-LAST_N);
}

export function inferUnlocked(board: Board, storage: Board, coveNode: number): PlayChain[] {
  const have = new Set<PlayChain>(STARTER_UNLOCKED);
  for (const p of [...board, ...storage]) {
    if (!p) continue;
    const def = ITEMS[p.itemId];
    if (def?.kind === "generator" && def.produces) have.add(def.produces);
  }
  for (let i = 0; i < coveNode; i++) {
    const u = COVE_NODES[i]?.unlocks;
    if (u) have.add(u);
  }
  return UNLOCK_ORDER.filter((c) => have.has(c));
}

export function freeLocked(locked: number[], n = CELLS_FREED_PER_NODE): { locked: number[]; freed: number[] } {
  const sorted = [...locked].sort((a, b) => a - b);
  return { freed: sorted.slice(0, n), locked: sorted.slice(n) };
}

export function maxCharges(genLevel: 1 | 2 | undefined): number {
  return genLevel === 2 ? GEN_CHARGES_L2 : GEN_CHARGES;
}

export function rechargeMs(genLevel: 1 | 2 | undefined): number {
  return genLevel === 2 ? GEN_RECHARGE_L2_MS : GEN_RECHARGE_MS;
}

export function regenEnergy(
  energy: number,
  lastEnergyAt: number,
  now: number,
): { energy: number; lastEnergyAt: number } {
  let e = Number.isFinite(energy) ? Math.floor(energy) : 0;
  e = Math.max(0, Math.min(ENERGY_MAX, e));
  let at = Number.isFinite(lastEnergyAt) && lastEnergyAt > 0 ? lastEnergyAt : now;
  if (e >= ENERGY_MAX) return { energy: ENERGY_MAX, lastEnergyAt: now };
  const elapsed = Math.max(0, now - at);
  const gained = Math.floor(elapsed / ENERGY_REGEN_MS);
  if (gained <= 0) return { energy: e, lastEnergyAt: at };
  const next = Math.min(ENERGY_MAX, e + gained);
  return {
    energy: next,
    lastEnergyAt: next >= ENERGY_MAX ? now : at + gained * ENERGY_REGEN_MS,
  };
}

export function spendEnergy(
  energy: number,
  lastEnergyAt: number,
  now: number,
  cost: number,
): { energy: number; lastEnergyAt: number; ok: boolean } {
  const r = regenEnergy(energy, lastEnergyAt, now);
  if (r.energy < cost) return { ...r, ok: false };
  const next = r.energy - cost;
  return {
    energy: next,
    lastEnergyAt: r.energy >= ENERGY_MAX ? now : r.lastEnergyAt,
    ok: true,
  };
}

export function energyWaitSec(energy: number, lastEnergyAt: number, now: number): number {
  const r = regenEnergy(energy, lastEnergyAt, now);
  if (r.energy >= ENERGY_MAX) return 0;
  return Math.max(1, Math.ceil((r.lastEnergyAt + ENERGY_REGEN_MS - now) / 1000));
}

export function freshClock(now: number, genLevel: 1 | 2 | undefined): GenClock {
  const max = maxCharges(genLevel);
  return { charges: max, readyAt: now + rechargeMs(genLevel), autoAt: now + AUTO_TICK_MS };
}

const WHO: Array<"mae" | "lila" | "holt"> = ["mae", "lila", "holt"];
const TOOL_BY_WHO: Record<"mae" | "lila" | "holt", string> = {
  holt: "hammer-1",
  lila: "paint-1",
  mae: "lamp-1",
};

function itemIdAt(chain: PlayChain, tier: number): string {
  const cap = CHAINS[chain].length;
  return `${chain}-${Math.min(cap, Math.max(1, tier))}`;
}

/**
 * Order shapes. Phase 2a.
 *
 * Every random-looking choice in this file is a pure hash of (stage, slot, seed)
 * plus a DRAW domain. The domain is required, never defaulted: two draw sites that
 * share a stream become correlated, and when the two moduli share a factor the
 * second draw collapses to a single value. That is the exact bug this file was
 * written to remove -- the old picker was `seed * 5 % span`, which froze three of
 * the four dock slots to one tier each for stages 20-24 and to two tiers each from
 * stage 45 to the end of the game.
 */
export const DRAW = { shape: 1, tier: 2, chain: 3, second: 4, text: 5, cond: 6, condKind: 7, condArg: 8 } as const;
export type DrawKind = (typeof DRAW)[keyof typeof DRAW];

export function mix(a: number, b: number, c: number, d: DrawKind): number {
  let h =
    (Math.imul(a | 0, 374761393) +
      Math.imul(b | 0, 668265263) +
      Math.imul(c | 0, 2246822519) +
      Math.imul(d | 0, 3266489917)) >>>
    0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Tier band for one chain. Computed per chain because caps differ (tide 10,
 * net 8, wreck 6) -- a shared band would ask for a wreck-7 that does not exist.
 * The ceiling formula is unchanged from launch. The floor is new: it rises with
 * stage so tier-1 asks retire, and is clamped to hi-2 so the band is never
 * narrower than three tiers and never inverts.
 */
export function tierBand(
  stage: number,
  slot: number,
  chain: PlayChain,
): { cap: number; lo: number; hi: number } {
  const cap = CHAINS[chain].length;
  const hi = Math.min(cap, 1 + Math.floor(stage / 5) + (slot === 3 ? 1 : 0));
  const lo = Math.max(1, Math.min(hi - 2, 1 + Math.floor(stage / 10)));
  return { cap, lo, hi };
}

export type OrderShape = "fetch" | "haul" | "ladder" | "assorted" | "pair";

type Req = { itemId: string; count: number };
type ShapeCtx = {
  stage: number;
  slot: number;
  seed: number;
  chains: readonly PlayChain[];
  avoid: Set<string>;
};

/**
 * Fetch holds three tickets so it stays the common ask as the other shapes
 * unlock: 100% -> 75% -> 60% -> 50% -> 43%.
 */
export function shapePool(
  stage: number,
  slot: number,
  chains: readonly PlayChain[],
): OrderShape[] {
  const pool: OrderShape[] = ["fetch", "fetch", "fetch"];
  if (stage >= 6) pool.push("haul");
  if (stage >= 12 && chains.length >= 3) pool.push("assorted");
  // Pair draws both stacks at their chain floor, and the floor is still 1 until
  // stage 15. Gated at 18 so it never asks for four tier-1 pieces at once.
  if (stage >= 18 && chains.length >= 2) pool.push("pair");
  const primary = chains[slot % chains.length] ?? chains[0]!;
  const b = tierBand(stage, slot, primary);
  // Width alone would switch ladder on at stage 5 for slot 3, whose ceiling runs
  // one tier ahead. The stage floor keeps the opening reaches to fetch and haul.
  if (stage >= 10 && b.hi - b.lo >= 2) pool.push("ladder");
  return pool;
}

function primaryChain(ctx: ShapeCtx): PlayChain {
  return ctx.chains[ctx.slot % ctx.chains.length] ?? ctx.chains[0]!;
}

/** Total. Never returns null -- a duplicate across slots is the allowed degradation. */
function buildFetch(ctx: ShapeCtx): Req[] {
  const { stage, slot, seed, chains, avoid } = ctx;
  let chain = primaryChain(ctx);
  const b = tierBand(stage, slot, chain);
  const tier = b.lo + (mix(stage, slot, seed, DRAW.tier) % (b.hi - b.lo + 1));
  let id = itemIdAt(chain, tier);
  if (avoid.has(id) && chains.length > 1) {
    for (let k = 1; k < chains.length; k++) {
      const alt = chains[(chains.indexOf(chain) + k) % chains.length]!;
      const altId = itemIdAt(alt, tierBand(stage, slot, alt).lo);
      if (!avoid.has(altId)) {
        chain = alt;
        id = altId;
        break;
      }
    }
  }
  const requires: Req[] = [{ itemId: id, count: 1 }];
  // Shipped since launch. Kept deliberately: without it, two-chain orders would
  // vanish for stages 2-15 while Assorted waits at 16. The `else if` is load
  // bearing -- slot 3 doubles only when the two-chain branch did not fire.
  if (slot >= 2 && chains.length >= 3 && stage >= 2) {
    const chainB = chains[(chains.indexOf(chain) + 1) % chains.length]!;
    const idB = itemIdAt(chainB, tierBand(stage, slot, chainB).lo);
    if (idB !== id && !avoid.has(idB)) requires.push({ itemId: idB, count: 1 });
  } else if (slot === 3 && stage >= 4) {
    requires[0]!.count = 2;
  }
  return requires;
}

/** Volume, not depth: three stacks one tier under the floor. */
function buildHaul(ctx: ShapeCtx): Req[] | null {
  const { stage, slot, avoid } = ctx;
  const chain = primaryChain(ctx);
  const b = tierBand(stage, slot, chain);
  const tier = Math.max(1, b.lo - 1);
  const id = itemIdAt(chain, tier);
  if (avoid.has(id)) return null;
  return [{ itemId: id, count: 3 }];
}

/** Depth: T and T+2 in one chain. T is drawn from [lo, hi-2] so T+2 never passes the ceiling. */
function buildLadder(ctx: ShapeCtx): Req[] | null {
  const { stage, slot, seed, avoid } = ctx;
  const chain = primaryChain(ctx);
  const b = tierBand(stage, slot, chain);
  if (b.hi - b.lo < 2) return null;
  const span = b.hi - 2 - b.lo + 1;
  const low = b.lo + (mix(stage, slot, seed, DRAW.tier) % span);
  const idLow = itemIdAt(chain, low);
  const idHigh = itemIdAt(chain, low + 2);
  if (idLow === idHigh) return null;
  if (avoid.has(idLow) || avoid.has(idHigh)) return null;
  return [
    { itemId: idLow, count: 1 },
    { itemId: idHigh, count: 1 },
  ];
}

/** Breadth: one from each of three chains, each at its own floor. */
function buildAssorted(ctx: ShapeCtx): Req[] | null {
  const { stage, slot, seed, chains, avoid } = ctx;
  if (chains.length < 3) return null;
  const start = mix(stage, slot, seed, DRAW.chain) % chains.length;
  const out: Req[] = [];
  const used = new Set<string>();
  for (let k = 0; k < chains.length && out.length < 3; k++) {
    const ch = chains[(start + k) % chains.length]!;
    const b = tierBand(stage, slot, ch);
    let picked: string | null = null;
    for (let d = 0; d <= b.hi - b.lo; d++) {
      const id = itemIdAt(ch, b.lo + ((mix(stage, slot, seed + k, DRAW.tier) + d) % (b.hi - b.lo + 1)));
      if (!avoid.has(id) && !used.has(id)) { picked = id; break; }
    }
    if (!picked) continue;
    used.add(picked);
    out.push({ itemId: picked, count: 1 });
  }
  return out.length === 3 ? out : null;
}

/** Two mid-floor stacks. Volume across chains; depth is Ladder's job. */
function buildPair(ctx: ShapeCtx): Req[] | null {
  const { stage, slot, seed, chains, avoid } = ctx;
  if (chains.length < 2) return null;
  const start = mix(stage, slot, seed, DRAW.second) % chains.length;
  const out: Req[] = [];
  const used = new Set<string>();
  for (let k = 0; k < chains.length && out.length < 2; k++) {
    const ch = chains[(start + k) % chains.length]!;
    const b = tierBand(stage, slot, ch);
    let picked: string | null = null;
    for (let d = 0; d <= b.hi - b.lo; d++) {
      const id = itemIdAt(ch, b.lo + ((mix(stage, slot, seed + k, DRAW.second) + d) % (b.hi - b.lo + 1)));
      if (!avoid.has(id) && !used.has(id)) { picked = id; break; }
    }
    if (!picked) continue;
    used.add(picked);
    out.push({ itemId: picked, count: 2 });
  }
  return out.length === 2 ? out : null;
}

const SHAPE_LINES: Record<OrderShape, readonly string[]> = {
  fetch: ["Bring {names}.", "{names}, when the tide allows.", "Set {names} aside for me."],
  haul: ["A full stack, then. {names}.", "Nothing clever. {names}, the lot of it.", "{names}. Load the barrow."],
  ladder: [
    "{names} -- the shallow one and the deep one.",
    "Two off the same run: {names}.",
    "{names}. One is easy. One is not.",
  ],
  assorted: [
    "A little of everything: {names}.",
    "{names}, one from each corner.",
    "Spread the net wide. {names}.",
  ],
  pair: ["Two and two: {names}.", "{names}, a pair of each.", "Double it up. {names}."],
};

export function makeLiveOrder(args: {
  stage: number;
  slot: number;
  seed: number;
  avoid: Set<string>;
  unlocked: readonly PlayChain[];
  kind?: "resident" | "auto";
  forceId?: string;
  discovered?: readonly string[];
}): LiveOrder {
  const { stage, slot, seed, avoid, unlocked, kind = "resident", forceId, discovered = [] } = args;
  if (kind === "auto" && forceId) {
    const def = ITEMS[forceId];
    return {
      id: `auto-${seed}`,
      slot,
      kind: "auto",
      character: WHO[slot % 3]!,
      title: "Someone from the channel",
      body: `A visitor will take ${def?.name ?? "a find"} off your hands. Rich pay.`,
      requires: [{ itemId: forceId, count: 1 }],
      pearls: 12 + stage * 2,
      xp: 18 + stage,
      rewardItem: "chest-1",
    };
  }
  const window = orderWindow(unlocked);
  const chains = window.length ? window : STARTER_UNLOCKED;
  const ctx: ShapeCtx = { stage, slot, seed, chains, avoid };

  const pool = shapePool(stage, slot, chains);
  const picked = pool[mix(stage, slot, seed, DRAW.shape) % pool.length]!;
  let shape: OrderShape = picked;
  let requires: Req[] | null =
    picked === "haul"
      ? buildHaul(ctx)
      : picked === "ladder"
        ? buildLadder(ctx)
        : picked === "assorted"
          ? buildAssorted(ctx)
          : picked === "pair"
            ? buildPair(ctx)
            : null;
  if (!requires) {
    shape = "fetch";
    requires = buildFetch(ctx);
  }

  const who = WHO[(stage + slot) % WHO.length]!;
  const extra = requires.length > 1 || (requires[0]?.count ?? 1) > 1 ? 4 : 0;
  const pearls = 3 + Math.floor(stage / 3) + extra + (kind === "auto" ? 8 : 0);
  const tool = TOOL_BY_WHO[who];
  const rewardItem = slot === 3 && stage % 3 === 1 ? "chest-1" : tool;
  const names = requires.map(
    (r) => `${r.count > 1 ? r.count + "× " : ""}${ITEMS[r.itemId]?.name ?? "a find"}`,
  );
  const lines = SHAPE_LINES[shape];
  const line = lines[mix(stage, slot, seed, DRAW.text) % lines.length]!;

  // Roughly one order in four carries a condition, on its own draw domain so it
  // does not correlate with shape, tier, chain or text.
  let condition: OrderCondition | undefined;
  if (mix(stage, slot, seed, DRAW.cond) % 4 === 0) {
    // Order matters. Thrift and streak are always evaluable; deep is opportunistic
    // and comes up empty for a player who has already made everything in reach.
    // So the reliable ones open first and deep layers on as spice -- otherwise
    // stages 14-19 had deep as the only kind and produced no conditions at all.
    const kinds: Array<OrderCondition["kind"]> = [];
    if (stage >= 14) kinds.push("thrift");
    if (stage >= 18) kinds.push("streak");
    if (stage >= 20) kinds.push("deep");
    if (kinds.length) {
      const start = mix(stage, slot, seed, DRAW.condKind) % kinds.length;
      // Try the picked kind, then the others in turn. Deep can legitimately come
      // up empty -- if the player has already made everything in range there is
      // nothing new to ask for -- and a silent drop there cost 2b most of its
      // conditions in play-testing: 7 of 312 orders carried one instead of ~1 in 4.
      for (let k = 0; k < kinds.length && !condition; k++) {
        const pick = kinds[(start + k) % kinds.length]!;
        if (pick === "deep") {
          const ch = primaryChain(ctx);
          const b = tierBand(stage, slot, ch);
          const have = new Set(discovered);
          // Search from two tiers ABOVE the band ceiling. Everything inside the
          // band is what the orders already ask for, so by the time deep unlocks
          // the player has made all of it and a band-only search finds nothing.
          // hi+2 is a genuine "go one deeper" ask and still inside the chain.
          const top = Math.min(CHAINS[ch].length, b.hi + 2);
          for (let t = top; t >= b.lo; t--) {
            const id = itemIdAt(ch, t);
            if (!have.has(id)) {
              condition = { kind: "deep", itemId: id };
              break;
            }
          }
        } else if (pick === "thrift") {
          condition = { kind: "thrift" };
        } else {
          condition = { kind: "streak", need: 4 + (mix(stage, slot, seed, DRAW.condArg) % 3) };
        }
      }
    }
  }

  return {
    id: `o${stage}-${slot}-${seed}`,
    slot,
    kind,
    character: who,
    title: `${names.join(" & ")} for ${CHARACTERS[who].role.toLowerCase()}`,
    body: `${line.replace("{names}", names.join(" and "))} ${stageName(stage)}.`,
    requires,
    pearls,
    xp: 10 + stage + slot + extra,
    rewardItem,
    ...(condition ? { condition, bonus: CONDITION_BONUS } : {}),
  };
}

export function seedOrders(
  stage: number,
  unlocked: readonly PlayChain[] = STARTER_UNLOCKED,
  discovered: readonly string[] = [],
): LiveOrder[] {
  const avoid = new Set<string>();
  const out: LiveOrder[] = [];
  for (let slot = 0; slot < ORDER_SLOTS; slot++) {
    const o = makeLiveOrder({ stage, slot, seed: slot + 1, avoid, unlocked, discovered });
    for (const r of o.requires) avoid.add(r.itemId);
    out.push(o);
  }
  return out;
}

export function replaceOrder(
  orders: LiveOrder[],
  slot: number,
  stage: number,
  seed: number,
  unlocked: readonly PlayChain[] = STARTER_UNLOCKED,
  discovered: readonly string[] = [],
): LiveOrder[] {
  const avoid = new Set(
    orders.filter((o) => o.slot !== slot).flatMap((o) => o.requires.map((r) => r.itemId)),
  );
  const next = makeLiveOrder({ stage, slot, seed, avoid, unlocked, discovered });
  return orders.map((o) => (o.slot !== slot ? o : next));
}

export function neededFromOrders(orders: LiveOrder[]): Set<string> {
  const s = new Set<string>();
  for (const o of orders) for (const r of o.requires) s.add(r.itemId);
  return s;
}

export function countEverywhere(
  board: Board,
  storage: Board,
  itemId: string,
  locked: readonly number[] = [],
): number {
  const skip = new Set(locked);
  let n = 0;
  for (let i = 0; i < board.length; i++) {
    if (skip.has(i)) continue;
    if (board[i]?.itemId === itemId) n += 1;
  }
  for (const p of storage) if (p?.itemId === itemId) n += 1;
  return n;
}

export function canFillOrder(
  board: Board,
  storage: Board,
  order: LiveOrder,
  locked: readonly number[] = [],
): boolean {
  return order.requires.every((r) => countEverywhere(board, storage, r.itemId, locked) >= r.count);
}

export function takeFromPools(
  board: Board,
  storage: Board,
  order: LiveOrder,
  locked: readonly number[] = [],
): { board: Board; storage: Board } {
  const b = board.slice();
  const st = storage.slice();
  const skip = new Set(locked);
  for (const req of order.requires) {
    let left = req.count;
    for (let i = 0; i < b.length && left > 0; i++) {
      if (skip.has(i)) continue;
      if (b[i]?.itemId === req.itemId) {
        b[i] = null;
        left -= 1;
      }
    }
    for (let i = 0; i < st.length && left > 0; i++) {
      if (st[i]?.itemId === req.itemId) {
        st[i] = null;
        left -= 1;
      }
    }
  }
  return { board: b, storage: st };
}

export function countToolTier(
  board: Board,
  storage: Board,
  tool: ToolId,
  tier: number,
  locked: readonly number[] = [],
): number {
  const id = `${tool}-${tier}`;
  return countEverywhere(board, storage, id, locked);
}

/** Spend one item of this tool at this tier or any higher (consume the lowest sufficient). */
export function spendTool(
  board: Board,
  storage: Board,
  tool: ToolId,
  needTier: number,
  locked: readonly number[] = [],
): { board: Board; storage: Board; ok: boolean } {
  const b = board.slice();
  const st = storage.slice();
  const skip = new Set(locked);
  for (let t = needTier; t <= 5; t++) {
    const id = `${tool}-${t}`;
    const i = b.findIndex((p, idx) => p?.itemId === id && !skip.has(idx));
    if (i >= 0) {
      b[i] = null;
      return { board: b, storage: st, ok: true };
    }
    const j = st.findIndex((p) => p?.itemId === id);
    if (j >= 0) {
      st[j] = null;
      return { board: b, storage: st, ok: true };
    }
  }
  return { board: b, storage: st, ok: false };
}

export function canPayStep(
  board: Board,
  storage: Board,
  pearls: number,
  step: CoveStep,
  locked: readonly number[] = [],
): boolean {
  if (pearls < step.pearls) return false;
  const need: Array<[ToolId, number]> = [];
  if (step.hammer) need.push(["hammer", step.hammer]);
  if (step.paint) need.push(["paint", step.paint]);
  if (step.lamp) need.push(["lamp", step.lamp]);
  return need.every(([tool, tier]) => {
    for (let t = tier; t <= 5; t++) if (countToolTier(board, storage, tool, t, locked) > 0) return true;
    return false;
  });
}

export function payStep(
  board: Board,
  storage: Board,
  step: CoveStep,
  locked: readonly number[] = [],
): { board: Board; storage: Board; ok: boolean } {
  let b = board.slice();
  let st = storage.slice();
  const need: Array<[ToolId, number]> = [];
  if (step.hammer) need.push(["hammer", step.hammer]);
  if (step.paint) need.push(["paint", step.paint]);
  if (step.lamp) need.push(["lamp", step.lamp]);
  for (const [tool, tier] of need) {
    const r = spendTool(b, st, tool, tier, locked);
    if (!r.ok) return { board: b, storage: st, ok: false };
    b = r.board;
    st = r.storage;
  }
  return { board: b, storage: st, ok: true };
}

export function emptyStorage(): Board {
  return Array.from({ length: STORAGE_SIZE }, () => null);
}

export function firstEmptyStorage(storage: Board): number {
  return storage.findIndex((p) => p == null);
}

export function placeOrInbox(
  board: Board,
  inbox: string[],
  itemId: string,
  near = 27,
  locked: number[] = [],
): {
  board: Board;
  inbox: string[];
  at: number;
} {
  const at = nearestEmpty(near, board, COLS, new Set(locked));
  if (at >= 0) {
    const next = board.slice();
    next[at] = piece(itemId);
    return { board: next, inbox, at };
  }
  if (inbox.length >= INBOX_CAP) {
    return { board, inbox, at: -1 };
  }
  return { board, inbox: [...inbox, itemId], at: -1 };
}

export function pityRoll(
  genChain: PlayChain,
  genLevel: 1 | 2 | undefined,
  dry: number,
  rng: () => number,
  lucky: boolean,
): { id: string; dry: number } {
  const L1 = [0, 0.5, 0.28, 0.14, 0.06, 0.02];
  const L2 = [0, 0.28, 0.26, 0.22, 0.14, 0.07, 0.03];
  const LUCKY_L1 = [0, 0.18, 0.3, 0.28, 0.16, 0.08];
  const LUCKY_L2 = [0, 0.1, 0.2, 0.28, 0.22, 0.13, 0.07];
  const table = lucky ? (genLevel === 2 ? LUCKY_L2 : LUCKY_L1) : genLevel === 2 ? L2 : L1;
  const bump = Math.min(0.18, dry * 0.02);
  const w = table.slice();
  if (bump > 0 && w.length > 4) {
    let common = 0;
    for (let t = 1; t <= 2 && t < w.length; t++) common += w[t] ?? 0;
    const take = Math.min(bump, common * 0.85);
    if (common > 0 && take > 0) {
      for (let t = 1; t <= 2 && t < w.length; t++) {
        w[t] = (w[t] ?? 0) * (1 - take / common);
      }
      let rare = 0;
      for (let t = 4; t < w.length; t++) rare += w[t] ?? 0;
      if (rare <= 0) {
        w[w.length - 1] = (w[w.length - 1] ?? 0) + take;
      } else {
        for (let t = 4; t < w.length; t++) {
          w[t] = (w[t] ?? 0) + take * ((w[t] ?? 0) / rare);
        }
      }
    }
  }
  let sum = 0;
  for (let t = 1; t < w.length; t++) sum += w[t] ?? 0;
  if (sum > 0) {
    for (let t = 1; t < w.length; t++) w[t] = (w[t] ?? 0) / sum;
  }
  let r = rng();
  let tier = 1;
  for (let t = 1; t < w.length; t++) {
    r -= w[t]!;
    if (r <= 0) {
      tier = t;
      break;
    }
    tier = t;
  }
  const cap = CHAINS[genChain]?.length ?? 8;
  if (rng() < 0.055) return { id: "energy-1", dry };
  const id = `${genChain}-${Math.min(cap, tier)}`;
  const rare = tier >= 4;
  return { id, dry: rare ? 0 : dry + 1 };
}

export function chestDrops(n: number, stage: number, rng = Math.random, unlocked: readonly PlayChain[] = STARTER_UNLOCKED): string[] {
  const window = orderWindow(unlocked);
  const chains = window.length ? window : STARTER_UNLOCKED;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const chain = chains[Math.floor(rng() * chains.length)]!;
    const tier = rng() < 0.7 ? 1 : 2;
    out.push(`${chain}-${tier}`);
  }
  return out;
}

export function printerMaxOnBoard(board: Board): string | null {
  const printers: PlayChain[] = ["hearth", "bloom", "tide"];
  for (const chain of printers) {
    const maxId = CHAINS[chain][CHAINS[chain].length - 1]!;
    let n = 0;
    for (const p of board) if (p?.itemId === maxId) n += 1;
    if (n >= 2) return maxId;
  }
  return null;
}

export function neighborEmpty(from: number, board: Board, cols = COLS, locked: number[] = []): number {
  const blocked = new Set(locked);
  const n = board.length;
  const rows = Math.floor(n / cols);
  const r = Math.floor(from / cols);
  const c = from % cols;
  const nbs: number[] = [];
  if (c > 0) nbs.push(from - 1);
  if (c < cols - 1) nbs.push(from + 1);
  if (r > 0) nbs.push(from - cols);
  if (r < rows - 1) nbs.push(from + cols);
  for (const j of nbs) if (board[j] == null && !blocked.has(j)) return j;
  return -1;
}

export type DailyProgress = {
  orders: number;
  merges: number;
  nodes: number;
  claimed: boolean;
};

export const DAILY_NEED = { orders: 3, merges: 15, nodes: 1 } as const;

export function dayKey(now = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function emptyDaily(): DailyProgress {
  return { orders: 0, merges: 0, nodes: 0, claimed: false };
}

export function dailyComplete(d: DailyProgress): boolean {
  return d.orders >= DAILY_NEED.orders && d.merges >= DAILY_NEED.merges && d.nodes >= DAILY_NEED.nodes;
}

export function neededChains(orders: LiveOrder[]): Set<string> {
  const s = new Set<string>();
  for (const o of orders) {
    for (const r of o.requires) {
      const c = ITEMS[r.itemId]?.chain;
      if (c && c !== "special") s.add(c);
    }
  }
  return s;
}

export function makeVisitor(stage: number, seed: number, itemId: string, unlocked: readonly PlayChain[] = STARTER_UNLOCKED): LiveOrder {
  return makeLiveOrder({
    stage,
    slot: 9,
    seed,
    avoid: new Set(),
    unlocked,
    kind: "auto",
    forceId: itemId,
  });
}
