import { asset } from "../utils";
export const COLS = 7;
export const ROWS = 8;
export const BOARD_SIZE = COLS * ROWS;
export const SAVE_VERSION = 9;
export const SAVE_KEY = "saltwharf-save-v1";
export const DRAG_THRESHOLD = 8;
export const LUCKY_CHARGES = 8;
export const STAGE_COUNT = 120;
export const DELIVERIES_PER_STAGE = 10;
export const STAGE_GATE_BASE = 300;
export const STAGE_GATE_STEP = 50;
export const TASK_COUNT = STAGE_COUNT * DELIVERIES_PER_STAGE;

export type ChainId =
  | "tide"
  | "hearth"
  | "craft"
  | "net"
  | "bloom"
  | "wreck"
  | "keep"
  | "hammer"
  | "paint"
  | "lamp"
  | "special";
export type ItemKind = "item" | "generator" | "consumable";
export type CharacterId = "mae" | "lila" | "holt";
export type CosmeticId = "lanterns" | "painted" | "lights";
export type BoostId = "lucky" | "parcel" | "shears" | "sip";
export type PlayChain = "tide" | "hearth" | "craft" | "net" | "bloom" | "wreck" | "keep";
export type DockSkinId =
  | "storm"
  | "dawn"
  | "fog"
  | "pine"
  | "gold"
  | "dusk"
  | "night"
  | "fest"
  | "rain"
  | "summer"
  | "frost"
  | "moon";

export type Cosmetics = Record<CosmeticId, boolean>;

export type ShopLook = {
  id: CosmeticId;
  name: string;
  blurb: string;
  cost: number;
};

export type ShopBoost = {
  id: BoostId;
  name: string;
  blurb: string;
  cost: number;
};

export type DockSkin = {
  id: DockSkinId;
  name: string;
  line: string;
};

export const XP_LEVELS: number[] = (() => {
  const a = [0];
  let gap = 36;
  for (let i = 0; i < 120; i++) {
    a.push(a[a.length - 1]! + gap);
    gap = Math.floor(gap * 1.07 + 3);
  }
  return a;
})();

export type ItemDef = {
  id: string;
  name: string;
  blurb: string;
  chain: ChainId;
  tier: number;
  src: string;
  nextId: string | null;
  sell: number;
  kind: ItemKind;
  produces?: PlayChain;
  genLevel?: 1 | 2;
  consume?: { pearls?: number; drops?: number; charges?: number; split?: boolean; energy?: number };
};

export type Piece = { uid: string; itemId: string };
export type Board = Array<Piece | null>;

export type TaskDef = {
  id: string;
  character: CharacterId;
  title: string;
  body: string;
  requires: Array<{ itemId: string; count: number }>;
  pearls: number;
  xp: number;
  village?: number;
  rewardItem?: string;
};

function i(partial: Omit<ItemDef, "src"> & { src?: string }): ItemDef {
  return { src: asset(`/items/${partial.id}.png`), ...partial };
}

export const ITEMS: Record<string, ItemDef> = {
  "tide-1": i({
    id: "tide-1",
    name: "Sea Glass",
    blurb: "A teal shard, still wet with the morning tide.",
    chain: "tide",
    tier: 1,
    nextId: "tide-2",
    sell: 1,
    kind: "item"
  }),
  "tide-2": i({
    id: "tide-2",
    name: "Tide Pebble",
    blurb: "Worn smooth by a hundred winters of surf.",
    chain: "tide",
    tier: 2,
    nextId: "tide-3",
    sell: 2,
    kind: "item"
  }),
  "tide-3": i({
    id: "tide-3",
    name: "Spiral Shell",
    blurb: "Hold it close — the cove still hums inside.",
    chain: "tide",
    tier: 3,
    nextId: "tide-4",
    sell: 4,
    kind: "item"
  }),
  "tide-4": i({
    id: "tide-4",
    name: "Sand Dollar",
    blurb: "A pale coin the sea mints for no one in particular.",
    chain: "tide",
    tier: 4,
    nextId: "tide-5",
    sell: 7,
    kind: "item"
  }),
  "tide-5": i({
    id: "tide-5",
    name: "Starfish",
    blurb: "Five arms, one stubborn will to cling to the pier.",
    chain: "tide",
    tier: 5,
    nextId: "tide-6",
    sell: 12,
    kind: "item"
  }),
  "tide-6": i({
    id: "tide-6",
    name: "Pearl Oyster",
    blurb: "The cove's quiet yes, folded in nacre.",
    chain: "tide",
    tier: 6,
    nextId: "tide-7",
    sell: 18,
    kind: "item"
  }),
  "tide-7": i({
    id: "tide-7",
    name: "Heart Locket",
    blurb: "Aunt Nessa's — the hinge still remembers her.",
    chain: "tide",
    tier: 7,
    nextId: "tide-8",
    sell: 28,
    kind: "item"
  }),
  "tide-8": i({
    id: "tide-8",
    name: "Harbor Crown",
    blurb: "Not for a queen. For the town that stayed.",
    chain: "tide",
    tier: 8,
    nextId: "tide-9",
    sell: 40,
    kind: "item"
  }),
  "tide-9": i({
    id: "tide-9",
    name: "Moon Shell",
    blurb: "It holds a whole night of tide in one curve.",
    chain: "tide",
    tier: 9,
    nextId: "tide-10",
    sell: 55,
    kind: "item",
  }),
  "tide-10": i({
    id: "tide-10",
    name: "Tide Diadem",
    blurb: "Three points of nacre. The harbor's quiet yes.",
    chain: "tide",
    tier: 10,
    nextId: null,
    sell: 75,
    kind: "item",
  }),
  "hearth-1": i({
    id: "hearth-1",
    name: "Flour Sack",
    blurb: "Lila's first measure toward a living oven.",
    chain: "hearth",
    tier: 1,
    nextId: "hearth-2",
    sell: 1,
    kind: "item"
  }),
  "hearth-2": i({
    id: "hearth-2",
    name: "Speckled Egg",
    blurb: "The hens came back before the people did.",
    chain: "hearth",
    tier: 2,
    nextId: "hearth-3",
    sell: 2,
    kind: "item"
  }),
  "hearth-3": i({
    id: "hearth-3",
    name: "Butter Pat",
    blurb: "Cold, gold-pale, and impatient to melt.",
    chain: "hearth",
    tier: 3,
    nextId: "hearth-4",
    sell: 4,
    kind: "item"
  }),
  "hearth-4": i({
    id: "hearth-4",
    name: "Dough",
    blurb: "Warm, alive, waiting for the Gull's oven.",
    chain: "hearth",
    tier: 4,
    nextId: "hearth-5",
    sell: 7,
    kind: "item"
  }),
  "hearth-5": i({
    id: "hearth-5",
    name: "Morning Bun",
    blurb: "The smell that tells a harbor it is morning.",
    chain: "hearth",
    tier: 5,
    nextId: "hearth-6",
    sell: 12,
    kind: "item"
  }),
  "hearth-6": i({
    id: "hearth-6",
    name: "Berry Tart",
    blurb: "Shore berries, sugar, and a little ceremony.",
    chain: "hearth",
    tier: 6,
    nextId: "hearth-7",
    sell: 18,
    kind: "item"
  }),
  "hearth-7": i({
    id: "hearth-7",
    name: "Cake Stand",
    blurb: "For birthdays, landings, and ordinary Tuesdays.",
    chain: "hearth",
    tier: 7,
    nextId: "hearth-8",
    sell: 28,
    kind: "item"
  }),
  "hearth-8": i({
    id: "hearth-8",
    name: "Harbor Feast",
    blurb: "A table long enough for the whole cove.",
    chain: "hearth",
    tier: 8,
    nextId: "hearth-9",
    sell: 40,
    kind: "item"
  }),
  "hearth-9": i({
    id: "hearth-9",
    name: "Wedding Cake",
    blurb: "Lila only bakes this when the town asks nicely.",
    chain: "hearth",
    tier: 9,
    nextId: "hearth-10",
    sell: 55,
    kind: "item",
  }),
  "hearth-10": i({
    id: "hearth-10",
    name: "Festival Platter",
    blurb: "Steam, citrus, and enough for every slip.",
    chain: "hearth",
    tier: 10,
    nextId: null,
    sell: 75,
    kind: "item",
  }),
  "craft-1": i({
    id: "craft-1",
    name: "Iron Nail",
    blurb: "One honest nail. The pier has asked for thousands.",
    chain: "craft",
    tier: 1,
    nextId: "craft-2",
    sell: 1,
    kind: "item"
  }),
  "craft-2": i({
    id: "craft-2",
    name: "Rope Coil",
    blurb: "Hemp that still smells of tar and weather.",
    chain: "craft",
    tier: 2,
    nextId: "craft-3",
    sell: 2,
    kind: "item"
  }),
  "craft-3": i({
    id: "craft-3",
    name: "Claw Hammer",
    blurb: "Holt's spare. The original went down with the storm.",
    chain: "craft",
    tier: 3,
    nextId: "craft-4",
    sell: 4,
    kind: "item"
  }),
  "craft-4": i({
    id: "craft-4",
    name: "Hand Saw",
    blurb: "For the boards the sea took, and the ones we give back.",
    chain: "craft",
    tier: 4,
    nextId: "craft-5",
    sell: 7,
    kind: "item"
  }),
  "craft-5": i({
    id: "craft-5",
    name: "Toolbox",
    blurb: "A portable workshop with opinions about rust.",
    chain: "craft",
    tier: 5,
    nextId: "craft-6",
    sell: 12,
    kind: "item"
  }),
  "craft-6": i({
    id: "craft-6",
    name: "Wave Sign",
    blurb: "Blank wood, teal wave. The cove can name itself.",
    chain: "craft",
    tier: 6,
    nextId: "craft-7",
    sell: 18,
    kind: "item"
  }),
  "craft-7": i({
    id: "craft-7",
    name: "Brass Lantern",
    blurb: "Harbor Lights begins with a single warm glass.",
    chain: "craft",
    tier: 7,
    nextId: "craft-8",
    sell: 28,
    kind: "item"
  }),
  "craft-8": i({
    id: "craft-8",
    name: "Tide Compass",
    blurb: "It does not point north. It points home.",
    chain: "craft",
    tier: 8,
    nextId: "craft-9",
    sell: 40,
    kind: "item"
  }),
  "craft-9": i({
    id: "craft-9",
    name: "Ship's Wheel",
    blurb: "Six spokes, one stubborn heading.",
    chain: "craft",
    tier: 9,
    nextId: "craft-10",
    sell: 55,
    kind: "item",
  }),
  "craft-10": i({
    id: "craft-10",
    name: "Beacon Lamp",
    blurb: "The light the storm tried to take, made again.",
    chain: "craft",
    tier: 10,
    nextId: null,
    sell: 75,
    kind: "item",
  }),
  "net-1": i({
    id: "net-1",
    name: "Clownfish",
    blurb: "Orange, stubborn, and far from any anemone.",
    chain: "net",
    tier: 1,
    nextId: "net-2",
    sell: 1,
    kind: "item",
  }),
  "net-2": i({
    id: "net-2",
    name: "Blue Tang",
    blurb: "A chip of lagoon, still flashing.",
    chain: "net",
    tier: 2,
    nextId: "net-3",
    sell: 3,
    kind: "item",
  }),
  "net-3": i({
    id: "net-3",
    name: "Butterflyfish",
    blurb: "Yellow armor and a false eye. The reef's little liar.",
    chain: "net",
    tier: 3,
    nextId: "net-4",
    sell: 7,
    kind: "item",
  }),
  "net-4": i({
    id: "net-4",
    name: "Parrotfish",
    blurb: "It bites coral and leaves sand. The beach owes it.",
    chain: "net",
    tier: 4,
    nextId: "net-5",
    sell: 14,
    kind: "item",
  }),
  "net-5": i({
    id: "net-5",
    name: "Lionfish",
    blurb: "Pretty as a fan. Mean as a needle.",
    chain: "net",
    tier: 5,
    nextId: "net-6",
    sell: 24,
    kind: "item",
  }),
  "net-6": i({
    id: "net-6",
    name: "Green Moray",
    blurb: "A ribbon of muscle in a hole. Do not pet.",
    chain: "net",
    tier: 6,
    nextId: "net-7",
    sell: 42,
    kind: "item",
  }),
  "net-7": i({
    id: "net-7",
    name: "Hammerhead",
    blurb: "The T of a hunter. The channel goes quiet.",
    chain: "net",
    tier: 7,
    nextId: "net-8",
    sell: 68,
    kind: "item",
  }),
  "net-8": i({
    id: "net-8",
    name: "Great White",
    blurb: "The last fish. Mae will not hang this in the window.",
    chain: "net",
    tier: 8,
    nextId: null,
    sell: 110,
    kind: "item",
  }),
  "bloom-1": i({
    id: "bloom-1",
    name: "Salt Seed",
    blurb: "It shouldn't grow here. It does anyway.",
    chain: "bloom",
    tier: 1,
    nextId: "bloom-2",
    sell: 1,
    kind: "item",
  }),
  "bloom-2": i({
    id: "bloom-2",
    name: "Sprout",
    blurb: "Two leaves against the whole Atlantic.",
    chain: "bloom",
    tier: 2,
    nextId: "bloom-3",
    sell: 2,
    kind: "item",
  }),
  "bloom-3": i({
    id: "bloom-3",
    name: "Sea Thyme",
    blurb: "Lila crushes it over butter and grins.",
    chain: "bloom",
    tier: 3,
    nextId: "bloom-4",
    sell: 4,
    kind: "item",
  }),
  "bloom-4": i({
    id: "bloom-4",
    name: "Beach Rose",
    blurb: "Salt-tough petals. Mae puts them in the pane.",
    chain: "bloom",
    tier: 4,
    nextId: "bloom-5",
    sell: 7,
    kind: "item",
  }),
  "bloom-5": i({
    id: "bloom-5",
    name: "Window Box",
    blurb: "The inn's first color that isn't storm.",
    chain: "bloom",
    tier: 5,
    nextId: "bloom-6",
    sell: 12,
    kind: "item",
  }),
  "bloom-6": i({
    id: "bloom-6",
    name: "Herb Bundle",
    blurb: "Thyme, rose, and a ribbon from the guestbook.",
    chain: "bloom",
    tier: 6,
    nextId: "bloom-7",
    sell: 18,
    kind: "item",
  }),
  "bloom-7": i({
    id: "bloom-7",
    name: "Cove Wreath",
    blurb: "Hung on the inn door when someone comes home.",
    chain: "bloom",
    tier: 7,
    nextId: "bloom-8",
    sell: 28,
    kind: "item",
  }),
  "bloom-8": i({
    id: "bloom-8",
    name: "Festival Bouquet",
    blurb: "For Harbor Lights, and every smaller joy.",
    chain: "bloom",
    tier: 8,
    nextId: null,
    sell: 40,
    kind: "item",
  }),
  "gen-tide-1": i({
    id: "gen-tide-1",
    name: "Drift Crate",
    blurb: "Tap to salvage what the tide left on the rocks.",
    chain: "tide",
    tier: 0,
    nextId: "gen-tide-2",
    sell: 0,
    kind: "generator",
    produces: "tide",
    genLevel: 1
  }),
  "gen-tide-2": i({
    id: "gen-tide-2",
    name: "Drift Chest",
    blurb: "A deeper salvage. The good finds live here.",
    chain: "tide",
    tier: 0,
    nextId: null,
    sell: 0,
    kind: "generator",
    produces: "tide",
    genLevel: 2
  }),
  "gen-hearth-1": i({
    id: "gen-hearth-1",
    name: "Pantry Basket",
    blurb: "Tap for kitchen stores. The Gull is hungry.",
    chain: "hearth",
    tier: 0,
    nextId: "gen-hearth-2",
    sell: 0,
    kind: "generator",
    produces: "hearth",
    genLevel: 1
  }),
  "gen-hearth-2": i({
    id: "gen-hearth-2",
    name: "Picnic Hamper",
    blurb: "Better stores, warmer bread.",
    chain: "hearth",
    tier: 0,
    nextId: null,
    sell: 0,
    kind: "generator",
    produces: "hearth",
    genLevel: 2
  }),
  "gen-craft-1": i({
    id: "gen-craft-1",
    name: "Tackle Box",
    blurb: "Tap for nails, rope, and the tools the pier needs.",
    chain: "craft",
    tier: 0,
    nextId: "gen-craft-2",
    sell: 0,
    kind: "generator",
    produces: "craft",
    genLevel: 1
  }),
  "gen-craft-2": i({
    id: "gen-craft-2",
    name: "Captain's Trunk",
    blurb: "Holt's better box. The latches still sing.",
    chain: "craft",
    tier: 0,
    nextId: null,
    sell: 0,
    kind: "generator",
    produces: "craft",
    genLevel: 2
  }),
  "gen-net-1": i({
    id: "gen-net-1",
    name: "Fish Creel",
    blurb: "Tap for tropical fish. The creel runs warm.",
    chain: "net",
    tier: 0,
    nextId: "gen-net-2",
    sell: 0,
    kind: "generator",
    produces: "net",
    genLevel: 1,
  }),
  "gen-net-2": i({
    id: "gen-net-2",
    name: "Channel Creel",
    blurb: "A deeper creel. The big fish live here.",
    chain: "net",
    tier: 0,
    nextId: null,
    sell: 0,
    kind: "generator",
    produces: "net",
    genLevel: 2,
  }),
  "gen-bloom-1": i({
    id: "gen-bloom-1",
    name: "Seed Tin",
    blurb: "Tap for salt-tough starts. Mae's window is waiting.",
    chain: "bloom",
    tier: 0,
    nextId: "gen-bloom-2",
    sell: 0,
    kind: "generator",
    produces: "bloom",
    genLevel: 1,
  }),
  "gen-bloom-2": i({
    id: "gen-bloom-2",
    name: "Garden Caddy",
    blurb: "Better starts, kinder blooms.",
    chain: "bloom",
    tier: 0,
    nextId: null,
    sell: 0,
    kind: "generator",
    produces: "bloom",
    genLevel: 2,
  }),
  "gen-wreck-1": i({
    id: "gen-wreck-1",
    name: "Wreck Crate",
    blurb: "Tap for flotsam. Cork, rope, and a winter at sea.",
    chain: "wreck",
    tier: 0,
    nextId: "gen-wreck-2",
    sell: 0,
    kind: "generator",
    produces: "wreck",
    genLevel: 1,
  }),
  "gen-wreck-2": i({
    id: "gen-wreck-2",
    name: "Salvage Chest",
    blurb: "A deeper wreck. The good cork lives here.",
    chain: "wreck",
    tier: 0,
    nextId: null,
    sell: 0,
    kind: "generator",
    produces: "wreck",
    genLevel: 2,
  }),
  "gen-keep-1": i({
    id: "gen-keep-1",
    name: "Coin Chest",
    blurb: "Tap for the old mint. Harbor coins, then crowns.",
    chain: "keep",
    tier: 0,
    nextId: "gen-keep-2",
    sell: 0,
    kind: "generator",
    produces: "keep",
    genLevel: 1,
  }),
  "gen-keep-2": i({
    id: "gen-keep-2",
    name: "Harbor Vault",
    blurb: "Brass and teal glass. The mint remembers.",
    chain: "keep",
    tier: 0,
    nextId: null,
    sell: 0,
    kind: "generator",
    produces: "keep",
    genLevel: 2,
  }),
  "energy-1": i({
    id: "energy-1",
    name: "Tide Spark",
    blurb: "A sip of morning tide. Tap for 5 energy, or merge two.",
    chain: "special",
    tier: 1,
    nextId: "energy-2",
    sell: 1,
    kind: "consumable",
    consume: { energy: 5 },
  }),
  "energy-2": i({
    id: "energy-2",
    name: "Tide Vial",
    blurb: "Corked seawater. Tap for 15 energy, or merge two.",
    chain: "special",
    tier: 2,
    nextId: "energy-3",
    sell: 2,
    kind: "consumable",
    consume: { energy: 15 },
  }),
  "energy-3": i({
    id: "energy-3",
    name: "Seawater Flask",
    blurb: "A swallow of tide. Tap for 25 energy, or merge two.",
    chain: "special",
    tier: 3,
    nextId: "energy-4",
    sell: 4,
    kind: "consumable",
    consume: { energy: 25 },
  }),
  "energy-4": i({
    id: "energy-4",
    name: "Storm Cask",
    blurb: "The last swallow. Tap for 80 energy.",
    chain: "special",
    tier: 4,
    nextId: null,
    sell: 8,
    kind: "consumable",
    consume: { energy: 80 },
  }),
  "energy-flask": i({
    id: "energy-flask",
    name: "Seawater Flask",
    blurb: "A swallow of tide. Tap to restore 25 energy.",
    chain: "special",
    tier: 3,
    nextId: "energy-4",
    sell: 4,
    kind: "consumable",
    consume: { energy: 25 }
  }),
  "pearl-pouch": i({
    id: "pearl-pouch",
    name: "Pearl Pouch",
    blurb: "A modest pocket of cream-white pearls. Tap to open.",
    chain: "special",
    tier: 0,
    nextId: null,
    sell: 6,
    kind: "consumable",
    consume: { pearls: 8 }
  }),
  "wreck-1": i({
    id: "wreck-1",
    name: "Cork Stopper",
    blurb: "It kept a bottle honest through a winter of waves.",
    chain: "wreck",
    tier: 1,
    nextId: "wreck-2",
    sell: 2,
    kind: "item",
  }),
  "wreck-2": i({
    id: "wreck-2",
    name: "Tide Bottle",
    blurb: "Green glass. The note washed out years ago.",
    chain: "wreck",
    tier: 2,
    nextId: "wreck-3",
    sell: 5,
    kind: "item",
  }),
  "wreck-3": i({
    id: "wreck-3",
    name: "Brass Key",
    blurb: "Holt swears it still fits a locker on the old slip.",
    chain: "wreck",
    tier: 3,
    nextId: "wreck-4",
    sell: 10,
    kind: "item",
  }),
  "wreck-4": i({
    id: "wreck-4",
    name: "Ship Bell",
    blurb: "One true note. The fog used to answer.",
    chain: "wreck",
    tier: 4,
    nextId: "wreck-5",
    sell: 18,
    kind: "item",
  }),
  "wreck-5": i({
    id: "wreck-5",
    name: "Spyglass",
    blurb: "The channel, closer. The weather, less of a surprise.",
    chain: "wreck",
    tier: 5,
    nextId: "wreck-6",
    sell: 32,
    kind: "item",
  }),
  "wreck-6": i({
    id: "wreck-6",
    name: "Chart Chest",
    blurb: "Maps of a kinder coast. Holt will not sell this twice.",
    chain: "wreck",
    tier: 6,
    nextId: null,
    sell: 55,
    kind: "item",
  }),
  "keep-1": i({
    id: "keep-1",
    name: "Harbor Coin",
    blurb: "A copper wave. The town used to mint these for luck.",
    chain: "keep",
    tier: 1,
    nextId: "keep-2",
    sell: 3,
    kind: "item",
  }),
  "keep-2": i({
    id: "keep-2",
    name: "Silver Token",
    blurb: "A shell stamped in. Mae keeps one in the till.",
    chain: "keep",
    tier: 2,
    nextId: "keep-3",
    sell: 8,
    kind: "item",
  }),
  "keep-3": i({
    id: "keep-3",
    name: "Gold Token",
    blurb: "Warm as a late sun on the pier.",
    chain: "keep",
    tier: 3,
    nextId: "keep-4",
    sell: 16,
    kind: "item",
  }),
  "keep-4": i({
    id: "keep-4",
    name: "Tide Medallion",
    blurb: "Nacre and a short ribbon. A prize the cove remembers.",
    chain: "keep",
    tier: 4,
    nextId: "keep-5",
    sell: 28,
    kind: "item",
  }),
  "keep-5": i({
    id: "keep-5",
    name: "Cove Crown",
    blurb: "Three points of pearl. Not for a head — for the harbor.",
    chain: "keep",
    tier: 5,
    nextId: "keep-6",
    sell: 48,
    kind: "item",
  }),
  "keep-6": i({
    id: "keep-6",
    name: "Lighthouse Heart",
    blurb: "A lantern the size of a promise. The last prize on the line.",
    chain: "keep",
    tier: 6,
    nextId: null,
    sell: 80,
    kind: "item",
  }),
  "hammer-1": i({
    id: "hammer-1",
    name: "Iron Peg",
    blurb: "Holt's smallest honest fix.",
    chain: "hammer",
    tier: 1,
    nextId: "hammer-2",
    sell: 1,
    kind: "item",
  }),
  "hammer-2": i({
    id: "hammer-2",
    name: "Mallet",
    blurb: "For boards that still argue.",
    chain: "hammer",
    tier: 2,
    nextId: "hammer-3",
    sell: 3,
    kind: "item",
  }),
  "hammer-3": i({
    id: "hammer-3",
    name: "Claw Hammer",
    blurb: "Nails in, nails out. The pier's opinion.",
    chain: "hammer",
    tier: 3,
    nextId: "hammer-4",
    sell: 6,
    kind: "item",
  }),
  "hammer-4": i({
    id: "hammer-4",
    name: "Dock Maul",
    blurb: "Two hands. One stubborn pile.",
    chain: "hammer",
    tier: 4,
    nextId: "hammer-5",
    sell: 12,
    kind: "item",
  }),
  "hammer-5": i({
    id: "hammer-5",
    name: "Pier Brace",
    blurb: "The timber that holds the walk.",
    chain: "hammer",
    tier: 5,
    nextId: null,
    sell: 22,
    kind: "item",
  }),
  "paint-1": i({
    id: "paint-1",
    name: "Pigment",
    blurb: "Dust that wants to be a door.",
    chain: "paint",
    tier: 1,
    nextId: "paint-2",
    sell: 1,
    kind: "item",
  }),
  "paint-2": i({
    id: "paint-2",
    name: "Brush",
    blurb: "Lila will not share this one.",
    chain: "paint",
    tier: 2,
    nextId: "paint-3",
    sell: 3,
    kind: "item",
  }),
  "paint-3": i({
    id: "paint-3",
    name: "Paint Pot",
    blurb: "Teal enough for the Gull's trim.",
    chain: "paint",
    tier: 3,
    nextId: "paint-4",
    sell: 6,
    kind: "item",
  }),
  "paint-4": i({
    id: "paint-4",
    name: "Sign Kit",
    blurb: "Letters the weather cannot eat.",
    chain: "paint",
    tier: 4,
    nextId: "paint-5",
    sell: 12,
    kind: "item",
  }),
  "paint-5": i({
    id: "paint-5",
    name: "Frontage Coat",
    blurb: "One wide, kind coat for a whole face of town.",
    chain: "paint",
    tier: 5,
    nextId: null,
    sell: 22,
    kind: "item",
  }),
  "lamp-1": i({
    id: "lamp-1",
    name: "Wick",
    blurb: "Mae keeps these in a tin by the stair.",
    chain: "lamp",
    tier: 1,
    nextId: "lamp-2",
    sell: 1,
    kind: "item",
  }),
  "lamp-2": i({
    id: "lamp-2",
    name: "Lamp Oil",
    blurb: "Amber, and a little dangerous near flour.",
    chain: "lamp",
    tier: 2,
    nextId: "lamp-3",
    sell: 3,
    kind: "item",
  }),
  "lamp-3": i({
    id: "lamp-3",
    name: "Hand Lamp",
    blurb: "A brass pocket of evening.",
    chain: "lamp",
    tier: 3,
    nextId: "lamp-4",
    sell: 6,
    kind: "item",
  }),
  "lamp-4": i({
    id: "lamp-4",
    name: "Window Lamp",
    blurb: "The pane that says someone is home.",
    chain: "lamp",
    tier: 4,
    nextId: "lamp-5",
    sell: 12,
    kind: "item",
  }),
  "lamp-5": i({
    id: "lamp-5",
    name: "Inn Lantern",
    blurb: "The light the storm tried to take, made again.",
    chain: "lamp",
    tier: 5,
    nextId: null,
    sell: 22,
    kind: "item",
  }),
  "chest-1": i({
    id: "chest-1",
    name: "Oddments Box",
    blurb: "Holt's leftovers. Tap to spill two small finds. Merge two for a better crate.",
    chain: "special",
    tier: 1,
    nextId: "chest-2",
    sell: 4,
    kind: "consumable",
    consume: { drops: 2 },
  }),
  "chest-2": i({
    id: "chest-2",
    name: "Harbor Crate",
    blurb: "A proper crate. Tap for four finds from the working lines.",
    chain: "special",
    tier: 2,
    nextId: null,
    sell: 10,
    kind: "consumable",
    consume: { drops: 4 },
  }),
  "shears": i({
    id: "shears",
    name: "Holt's Shears",
    blurb: "Tap, then tap a find of tier 2 or more. It becomes two of the last kind.",
    chain: "special",
    tier: 0,
    nextId: null,
    sell: 8,
    kind: "consumable",
    consume: { split: true },
  }),
};

export const CHAINS: Record<PlayChain, string[]> = {
  tide: ["tide-1", "tide-2", "tide-3", "tide-4", "tide-5", "tide-6", "tide-7", "tide-8", "tide-9", "tide-10"],
  hearth: ["hearth-1", "hearth-2", "hearth-3", "hearth-4", "hearth-5", "hearth-6", "hearth-7", "hearth-8", "hearth-9", "hearth-10"],
  craft: ["craft-1", "craft-2", "craft-3", "craft-4", "craft-5", "craft-6", "craft-7", "craft-8", "craft-9", "craft-10"],
  net: ["net-1", "net-2", "net-3", "net-4", "net-5", "net-6", "net-7", "net-8"],
  bloom: ["bloom-1", "bloom-2", "bloom-3", "bloom-4", "bloom-5", "bloom-6", "bloom-7", "bloom-8"],
  wreck: ["wreck-1", "wreck-2", "wreck-3", "wreck-4", "wreck-5", "wreck-6"],
  keep: ["keep-1", "keep-2", "keep-3", "keep-4", "keep-5", "keep-6"],
};

export const TOOL_CHAINS = {
  hammer: ["hammer-1", "hammer-2", "hammer-3", "hammer-4", "hammer-5"],
  paint: ["paint-1", "paint-2", "paint-3", "paint-4", "paint-5"],
  lamp: ["lamp-1", "lamp-2", "lamp-3", "lamp-4", "lamp-5"],
} as const;

export const TOOL_LABEL = {
  hammer: "Holt's tools",
  paint: "Lila's paint",
  lamp: "Mae's lamps",
} as const;

export const PLAY_CHAINS: PlayChain[] = ["tide", "hearth", "craft", "net", "bloom"];

export const CHAIN_LABEL: Record<PlayChain, string> = {
  tide: "Tide",
  hearth: "Hearth",
  craft: "Craft",
  net: "Catch",
  bloom: "Bloom",
  wreck: "Wreck",
  keep: "Prizes",
};

export function chainUnlocked(chain: PlayChain, unlocked: readonly PlayChain[]): boolean {
  return unlocked.includes(chain);
}

export function playChainsFor(stage: number): PlayChain[] {
  const chains: PlayChain[] = ["tide", "hearth", "craft", "net", "bloom"];
  if (stage >= 5) chains.push("wreck");
  if (stage >= 12) chains.push("keep");
  return chains;
}

export function chainUnlockHint(chain: PlayChain): string | null {
  if (chain === "craft") return "Restore the Swept Stoop — the cove mails a Tackle Box.";
  if (chain === "net") return "Restore the Painted Pier — a Fish Creel is in the mail.";
  if (chain === "bloom") return "Restore Mae's Garden — a Seed Tin waits on the stoop.";
  if (chain === "wreck") return "Restore the Old Slip — wreck salvage washes in.";
  if (chain === "keep") return "Restore Holt's Shed — a coin chest from the old mint.";
  return null;
}

export const CHARACTERS: Record<CharacterId, { name: string; role: string; portrait: string }> = {
  mae: { name: "Mae Calder", role: "The Inn", portrait: asset("/portraits/mae.png") },
  lila: { name: "Lila Voss", role: "The Gull", portrait: asset("/portraits/lila.png") },
  holt: { name: "Captain Holt", role: "The Pier", portrait: asset("/portraits/holt.png") },
};

export const VILLAGE_STAGES = [
  { name: "After the Storm", line: "Peeling paint, a quiet dock, and one returning niece." },
  { name: "Swept Stoop", line: "The inn breathes. Shutters unboard. Someone is home." },
  { name: "The Gull Reopens", line: "Flour in the air. A bell over the cafe door." },
  { name: "Painted Pier", line: "Holt's boards hold. The boats remember the slips." },
  { name: "First Lanterns", line: "Warm glass along the rail. Evening has a place to sit." },
  { name: "Harbor Lights", line: "Bunting, boats, and a feast for the cove that stayed." },
];

export const DOCK_SKINS: DockSkin[] = [
  { id: "storm", name: "Storm planks", line: "Grey wood. The weather still sits in the grain." },
  { id: "dawn", name: "Dawn tide", line: "Peach light on the boards. The cove yawns." },
  { id: "fog", name: "Sea fog", line: "The dock is a rumor until you step on it." },
  { id: "pine", name: "Washed pine", line: "Holt sanded until the honey showed." },
  { id: "gold", name: "Golden hour", line: "Every plank remembers a late sun." },
  { id: "dusk", name: "Harbor dusk", line: "Teal going indigo. Lamps think about it." },
  { id: "night", name: "Night slip", line: "Dark water, quiet nails, one warm pane." },
  { id: "fest", name: "Festival dock", line: "Bunting even Holt will not take down." },
  { id: "rain", name: "Rain-wet", line: "The boards shine. The work does not stop." },
  { id: "summer", name: "High summer", line: "Salt, bleach, and a too-kind sky." },
  { id: "frost", name: "Frost morning", line: "Rime on the rail. Breath like smoke." },
  { id: "moon", name: "Moon tide", line: "Silver wood. The channel is a mirror." },
];

const STAGE_ADJ = ["Quiet", "Salt", "Swept", "Amber", "Gale", "Low", "Bright", "Hidden", "Open", "Kind"];
const STAGE_NOUN = ["Reach", "Stoop", "Slip", "Garden", "Net", "Lantern", "Cove", "Wharf", "Row", "Rise", "Shed", "Bank"];
const STAGE_LINES = [
  "The work is still here. So are we.",
  "A little more color against the weather.",
  "Orders from the inn, the Gull, and the pier.",
  "Merge what the tide gives. Spend pearls to go farther.",
  "Harder finds. Same dock. Same people.",
  "The cove remembers how to shine, one reach at a time.",
];

export function stageName(stage: number): string {
  const i = ((stage % STAGE_COUNT) + STAGE_COUNT) % STAGE_COUNT;
  return `${STAGE_ADJ[i % STAGE_ADJ.length]} ${STAGE_NOUN[Math.floor(i / STAGE_ADJ.length) % STAGE_NOUN.length]}`;
}

export function stageLine(stage: number): string {
  return STAGE_LINES[((stage % STAGE_LINES.length) + STAGE_LINES.length) % STAGE_LINES.length]!;
}

export function villageForStage(stage: number): number {
  if (STAGE_COUNT <= 1) return 0;
  return Math.min(
    VILLAGE_STAGES.length - 1,
    Math.round((Math.max(0, stage) / (STAGE_COUNT - 1)) * (VILLAGE_STAGES.length - 1)),
  );
}

export function stageGateCost(fromStage: number): number {
  return STAGE_GATE_BASE + STAGE_GATE_STEP * fromStage;
}

export function stageOfIndex(index: number): number {
  return Math.floor(index / DELIVERIES_PER_STAGE);
}

export function slotOfIndex(index: number): number {
  return index % DELIVERIES_PER_STAGE;
}

export function dockSkinFor(stage: number): DockSkin {
  const i = Math.floor(Math.max(0, stage) / 5) % DOCK_SKINS.length;
  return DOCK_SKINS[i]!;
}

const WHO: CharacterId[] = ["mae", "lila", "holt"];

function chainCap(chain: PlayChain): number {
  return CHAINS[chain].length;
}

function itemIdAt(chain: PlayChain, tier: number): string {
  const cap = chainCap(chain);
  const t = Math.min(cap, Math.max(1, tier));
  return `${chain}-${t}`;
}

function maxTier(stage: number, slot: number, cap: number): number {
  const t = 2 + Math.floor(stage / 6) + (slot >= 6 ? 1 : 0) + (slot >= 9 ? 1 : 0);
  return Math.min(cap, t);
}

function minTier(stage: number, cap: number): number {
  return Math.min(cap, 1 + Math.floor(stage / 12));
}

function countFor(stage: number, slot: number): number {
  let n = 1;
  if (slot >= 3 && stage >= 2) n = 2;
  if (slot >= 7 && stage >= 8) n = 2;
  if (slot === 9 && stage >= 18) n = 3;
  if (stage >= 40 && slot >= 5) n = Math.min(4, n + 1);
  if (stage >= 80 && slot >= 8) n = Math.min(4, n + 1);
  return n;
}

function makeTask(index: number): TaskDef {
  const stage = stageOfIndex(index);
  const slot = slotOfIndex(index);
  if (index === 0) {
    return {
      id: "s0-d0",
      character: "mae",
      title: "The inn window",
      body: "Two shards of sea glass will patch the pane. Order 1 of 10.",
      requires: [{ itemId: "tide-1", count: 2 }],
      pearls: 2,
      xp: 10,
    };
  }
  const chains = playChainsFor(stage);
  const chain = chains[(stage + slot * 2) % chains.length]!;
  const cap = chainCap(chain);
  const hi = maxTier(stage, slot, cap);
  const lo = minTier(stage, cap);
  const tier = lo + ((stage * 3 + slot * 7) % (hi - lo + 1));
  const idA = itemIdAt(chain, tier);
  const count = countFor(stage, slot);
  const requires: TaskDef["requires"] = [{ itemId: idA, count }];
  if (slot === 9 && stage >= 5) {
    const chainB = chains[(stage + slot * 2 + 1) % chains.length]!;
    const idB = itemIdAt(chainB, Math.max(1, minTier(stage, chainCap(chainB))));
    if (idB !== idA) requires.push({ itemId: idB, count: 1 });
  }
  const defA = ITEMS[idA];
  const who = WHO[(stage + slot) % WHO.length]!;
  const pearls = 2 + Math.floor(stage / 3) + (slot === 9 ? 2 : 0);
  const xp = 10 + stage + slot * 2;
  const names = requires.map((r) => ITEMS[r.itemId]?.name ?? "find").join(" and ");
  return {
    id: `s${stage}-d${slot}`,
    character: who,
    title: slot === 9 ? "Close the reach" : `${defA?.name ?? "A find"} for the cove`,
    body:
      slot === 9
        ? `Last order of ${stageName(stage)}. ${names}. Then the next reach has a price.`
        : `Order ${slot + 1} of 10. Bring ${names}.`,
    requires,
    pearls,
    xp,
    rewardItem: slot === 9 && stage % 12 === 5 ? "pearl-pouch" : slot === 5 && stage % 8 === 2 ? "chest-1" : undefined,
  };
}

export const TASKS: TaskDef[] = Array.from({ length: TASK_COUNT }, (_, i) => makeTask(i));

export function item(id: string): ItemDef | undefined {
  return ITEMS[id];
}

export function levelFromXp(xp: number): number {
  let lvl = 0;
  for (let i = 1; i < XP_LEVELS.length; i++) {
    if (xp >= XP_LEVELS[i]!) lvl = i;
  }
  return lvl;
}

export function xpIntoLevel(xp: number, level: number): { have: number; need: number } {
  const start = XP_LEVELS[level] ?? 0;
  const next = XP_LEVELS[level + 1];
  if (next == null) return { have: 1, need: 1 };
  return { have: xp - start, need: next - start };
}

export function nextItemId(id: string): string | null {
  return ITEMS[id]?.nextId ?? null;
}

export function prevItemId(id: string): string | null {
  const def = ITEMS[id];
  if (!def || def.tier < 2) return null;
  const prev = `${def.chain}-${def.tier - 1}`;
  return ITEMS[prev] ? prev : null;
}

export function canMerge(a: string, b: string): boolean {
  return a === b && nextItemId(a) != null;
}

const L1 = [0, 0.5, 0.28, 0.14, 0.06, 0.02];
const L2 = [0, 0.28, 0.26, 0.22, 0.14, 0.07, 0.03];
const LUCKY_L1 = [0, 0.18, 0.3, 0.28, 0.16, 0.08];
const LUCKY_L2 = [0, 0.1, 0.2, 0.28, 0.22, 0.13, 0.07];

export function rollDrop(gen: ItemDef, rng = Math.random, lucky = false): string {
  const chain = gen.produces ?? "tide";
  const table = lucky ? (gen.genLevel === 2 ? LUCKY_L2 : LUCKY_L1) : gen.genLevel === 2 ? L2 : L1;
  let r = rng();
  let tier = 1;
  for (let t = 1; t < table.length; t++) {
    r -= table[t]!;
    if (r <= 0) {
      tier = t;
      break;
    }
    tier = t;
  }
  return `${chain}-${tier}`;
}

export function nearestEmpty(
  from: number,
  board: Board,
  cols = COLS,
  blocked?: ReadonlySet<number>,
): number {
  const n = board.length;
  const open = (j: number) => board[j] == null && !blocked?.has(j);
  if (from >= 0 && from < n && open(from)) return from;
  const seen = new Uint8Array(n);
  const q: number[] = [];
  if (from >= 0 && from < n) {
    q.push(from);
    seen[from] = 1;
  }
  let qi = 0;
  const rows = Math.floor(n / cols);
  while (qi < q.length) {
    const i = q[qi++]!;
    const r = Math.floor(i / cols);
    const c = i % cols;
    const nbs: number[] = [];
    if (c > 0) nbs.push(i - 1);
    if (c < cols - 1) nbs.push(i + 1);
    if (r > 0) nbs.push(i - cols);
    if (r < rows - 1) nbs.push(i + cols);
    for (const j of nbs) {
      if (seen[j]) continue;
      if (open(j)) return j;
      seen[j] = 1;
      q.push(j);
    }
  }
  return board.findIndex((cell, i) => cell == null && !blocked?.has(i));
}

export function tryPlace(board: Board, itemId: string, near = 27): number {
  const empty = nearestEmpty(near, board, COLS);
  if (empty < 0) return -1;
  board[empty] = piece(itemId);
  return empty;
}

export function prizeAfterMerge(args: {
  merges: number;
  stage: number;
  mergedId: string;
  unlocked?: readonly PlayChain[];
  rng?: () => number;
}): string | null {
  const rng = args.rng ?? Math.random;
  const def = ITEMS[args.mergedId];
  if (!def) return null;
  if (!def.nextId && (def.chain === "keep" || def.chain === "wreck")) return "pearl-pouch";
  if (rng() < 0.08) return "energy-1";
  const unlocked = args.unlocked ?? [];
  if (chainUnlocked("keep", unlocked) && args.merges > 0 && args.merges % 8 === 0) {
    return "keep-1";
  }
  if (chainUnlocked("wreck", unlocked) && rng() < 0.1) return "wreck-1";
  if (def.tier >= 7 && chainUnlocked("keep", unlocked) && rng() < 0.14) return "keep-1";
  return null;
}

export function prizeAfterDeliver(slot: number, stage: number, rng = Math.random): string | null {
  if (slot === 9) {
    if (stage >= 5) return rng() < 0.5 ? "wreck-1" : "keep-1";
    if (stage >= 0) return "keep-1";
  }
  if (slot === 4 && stage >= 5 && rng() < 0.4) return "wreck-1";
  return null;
}

export function countItem(board: Board, itemId: string): number {
  let n = 0;
  for (const p of board) if (p?.itemId === itemId) n += 1;
  return n;
}

export function neededSet(task: TaskDef | undefined): Set<string> {
  const s = new Set<string>();
  if (!task) return s;
  for (const r of task.requires) s.add(r.itemId);
  return s;
}

export function canDeliver(board: Board, task: TaskDef | undefined): boolean {
  if (!task) return false;
  return task.requires.every((r) => countItem(board, r.itemId) >= r.count);
}

export function firstMissing(board: Board, task: TaskDef | undefined): string | null {
  if (!task) return null;
  for (const r of task.requires) if (countItem(board, r.itemId) < r.count) return r.itemId;
  return null;
}

export const LOOKS: ShopLook[] = [
  { id: "lanterns", name: "Dock lanterns", blurb: "Brass lamps at the corners. The cells catch a warm glow.", cost: 80 },
  { id: "painted", name: "Painted planks", blurb: "Holt sands the grey off. The dock remembers honey pine.", cost: 140 },
  { id: "lights", name: "Harbor lights", blurb: "A string of amber bulbs. Evening comes in kindly.", cost: 220 },
];

export const BOOSTS: ShopBoost[] = [
  { id: "sip", name: "A swallow of tide", blurb: "+25 energy, right now. Energy also comes back on its own every 15 seconds.", cost: 18 },
  { id: "lucky", name: "Lucky tide", blurb: "The next eight gathers run richer — higher finds, more often.", cost: 70 },
  { id: "parcel", name: "Mae's parcel", blurb: "One piece of what the order still wants, left on an empty plank.", cost: 85 },
  { id: "shears", name: "Holt's shears", blurb: "A pair on the dock. Split one high find into two of the last kind.", cost: 45 },
];

export type ShopCrate = {
  id: PlayChain;
  name: string;
  blurb: string;
  itemId: string;
  cost: number;
};

export const CRATES: ShopCrate[] = [
  {
    id: "net",
    name: "Fish Creel",
    blurb: "Holt's spare. Tap it for the Catch line — clownfish on up to the great white.",
    itemId: "gen-net-1",
    cost: 36,
  },
  {
    id: "bloom",
    name: "Seed Tin",
    blurb: "Mae's extra tin. Tap it for Bloom — salt seed through the festival bouquet.",
    itemId: "gen-bloom-1",
    cost: 36,
  },
];

export function lookById(id: CosmeticId): ShopLook | undefined {
  return LOOKS.find((l) => l.id === id);
}

export function boostById(id: BoostId): ShopBoost | undefined {
  return BOOSTS.find((b) => b.id === id);
}

export const EMPTY_COSMETICS: Cosmetics = {
  lanterns: false,
  painted: false,
  lights: false,
};

let _uid = 0;
export function uid(): string {
  _uid += 1;
  return `p${Date.now().toString(36)}-${_uid.toString(36)}`;
}

export function piece(itemId: string): Piece {
  return { uid: uid(), itemId };
}

export function makeInitialBoard(): Board {
  const board: Board = Array.from({ length: BOARD_SIZE }, () => null);
  const put = (index: number, itemId: string) => {
    board[index] = piece(itemId);
  };
  put(43, "gen-tide-1");
  put(44, "gen-hearth-1");
  put(4, "tide-1");
  put(5, "hearth-1");
  put(11, "tide-1");
  put(12, "hearth-1");
  put(16, "tide-1");
  put(17, "tide-1");
  put(18, "hearth-1");
  put(23, "tide-1");
  put(24, "hearth-1");
  put(30, "hearth-1");
  return board;
}

export const STARTER_GENS: Array<{ chain: PlayChain; itemId: string }> = [
  { chain: "tide", itemId: "gen-tide-1" },
  { chain: "hearth", itemId: "gen-hearth-1" },
];

export function hasProducer(board: Board, chain: PlayChain): boolean {
  return board.some((p) => {
    if (!p) return false;
    const def = ITEMS[p.itemId];
    return def?.kind === "generator" && def.produces === chain;
  });
}

export function ensureStarterGens(board: Board): { board: Board; added: string[] } {
  const next = board.slice();
  const added: string[] = [];
  const home = [42, 43, 44, 45, 46];
  for (const g of STARTER_GENS) {
    if (hasProducer(next, g.chain)) continue;
    let slot = home.find((i) => next[i] == null);
    if (slot == null) {
      const found = nearestEmpty(42, next, COLS);
      slot = found >= 0 ? found : undefined;
    }
    if (slot == null) continue;
    next[slot] = piece(g.itemId);
    added.push(g.itemId);
  }
  return { board: next, added };
}
