import "./stress-preload.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { useGame, flushSave } from "./store.ts";
import { BOARD_SIZE, DELIVERIES_PER_STAGE, ITEMS, SAVE_KEY, SAVE_VERSION, piece } from "./catalog.ts";
import { AUTO_CATCHUP_MAX, AUTO_TICK_MS, COVE_NODES, DRAW, GEN_CHARGES, GEN_CHARGES_L2, GEN_RECHARGE_L2_MS, GEN_RECHARGE_MS, INBOX_CAP, ORDER_SLOTS, STARTER_UNLOCKED, STORAGE_SIZE, UNLOCK_ORDER, canFillOrder, makeLiveOrder, maxCharges, mix, orderWindow, pityRoll, rechargeMs, seedOrders, shapePool, takeFromPools, tierBand } from "./loop.ts";
import { CHAINS, type PlayChain } from "./catalog.ts";
import { healSave, applyKeepScan } from "./watch.ts";

function check(label: string) {
  const s = useGame.getState();
  assert.equal(s.board.length, BOARD_SIZE, `${label}: board size`);
  assert.equal(s.storage.length, STORAGE_SIZE, `${label}: storage size`);
  assert.equal(s.orders.length, ORDER_SLOTS, `${label}: orders`);
  assert.ok(Number.isFinite(s.pearls) && s.pearls >= 0, `${label}: pearls`);
  assert.ok(Number.isFinite(s.xp) && s.xp >= 0, `${label}: xp`);
  assert.ok(s.unlocked.length >= 2, `${label}: unlocked`);
  assert.ok(Array.isArray(s.locked), `${label}: locked`);
  const uids = new Set<string>();
  for (const p of s.board) {
    if (!p) continue;
    assert.ok(ITEMS[p.itemId], `${label}: unknown ${p.itemId}`);
    assert.ok(!uids.has(p.uid), `${label}: dup uid`);
    uids.add(p.uid);
  }
  for (const p of s.storage) {
    if (!p) continue;
    assert.ok(ITEMS[p.itemId], `${label}: storage unknown ${p.itemId}`);
  }
  for (const id of s.inbox) assert.ok(ITEMS[id], `${label}: inbox unknown ${id}`);
  for (const o of s.orders) {
    for (const r of o.requires) assert.ok(ITEMS[r.itemId], `${label}: order ${r.itemId}`);
  }
}

function toolsFor(nodeIndex: number, stepIndex: number) {
  const step = COVE_NODES[nodeIndex]!.steps[stepIndex]!;
  const board = useGame.getState().board.slice();
  const locked = new Set(useGame.getState().locked);
  const opens = board
    .map((p, i) => (!p && !locked.has(i) ? i : -1))
    .filter((i) => i >= 0);
  let slot = 0;
  const put = (id: string) => {
    const at = opens[slot++];
    if (at == null) return;
    board[at] = piece(id);
  };
  if (step.lamp) put(`lamp-${step.lamp}`);
  if (step.hammer) put(`hammer-${step.hammer}`);
  if (step.paint) put(`paint-${step.paint}`);
  useGame.setState({ board, pearls: Math.max(useGame.getState().pearls, step.pearls + 4) });
}

describe("saltwharf stress", () => {
  it("heals garbage saves", () => {
    const healed = healSave({
      board: [{ uid: "x", itemId: "nope" }, null],
      pearls: Number.NaN,
      xp: -4,
      orders: [],
      inbox: Array.from({ length: 80 }, () => "tide-1"),
      coveNode: 99,
      coveStep: 99,
      stage: 9000,
    });
    assert.equal(healed.save.board?.length, BOARD_SIZE);
    assert.equal(healed.save.pearls, 0);
    assert.ok(healed.save.xp >= 0);
    assert.ok(healed.save.inbox.length <= INBOX_CAP);
    assert.ok(healed.save.coveNode <= COVE_NODES.length);
    assert.ok(healed.notes.length > 0);
  });

  it("mails a crate when a cove site is finished", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s0 = useGame.getState();
    const board = s0.board.slice();
    const opens = board
      .map((p, i) => (!p && !s0.locked.includes(i) ? i : -1))
      .filter((i) => i >= 0);
    board[opens[0]!] = piece("lamp-1");
    board[opens[1]!] = piece("hammer-1");
    board[opens[2]!] = piece("lamp-2");
    useGame.setState({ board, pearls: 80, coveNode: 0, coveStep: 0, inbox: [] });
    assert.equal(api.payCove(), true);
    assert.equal(api.payCove(), true);
    assert.equal(api.payCove(), true);
    const s1 = useGame.getState();
    assert.equal(s1.coveNode, 1);
    assert.ok(
      s1.inbox.includes("gen-craft-1") || s1.board.some((p) => p?.itemId === "gen-craft-1"),
      "tackle box mailed",
    );
    assert.ok(s1.unlocked.includes("craft"), "craft unlocked");
    assert.ok(s1.locked.length < s0.locked.length, "planks un-tarped");
    assert.equal(s1.lastRestore?.id, "stoop");
  });

  it("survives a brutal random session", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    check("start");
    const rng = (n: number) => Math.floor(Math.random() * n);
    let taps = 0;
    let merges = 0;
    let delivers = 0;
    for (let i = 0; i < 2500; i++) {
      const s = useGame.getState();
      const roll = rng(12);
      const idx = rng(BOARD_SIZE);
      if (roll === 0) {
        if (api.tapGenerator(idx)) taps += 1;
      } else if (roll === 1) {
        const from = rng(BOARD_SIZE);
        const to = rng(BOARD_SIZE);
        if (api.mergePieces(from, to)) merges += 1;
        else api.movePiece(from, to);
      } else if (roll === 2) {
        api.sellAt(idx);
      } else if (roll === 3) {
        api.storeFromBoard(idx);
      } else if (roll === 4) {
        api.storeToBoard(rng(STORAGE_SIZE));
      } else if (roll === 5) {
        if (api.deliver(rng(ORDER_SLOTS))) delivers += 1;
        api.deliverVisitor();
      } else if (roll === 6) {
        api.useConsumable(idx);
      } else if (roll === 7) {
        api.payCove();
      } else if (roll === 8) {
        api.undoSell();
      } else if (roll === 9) {
        api.pullInbox();
      } else if (roll === 10) {
        api.tick(Date.now() + 80_000 * rng(6));
      } else {
        api.unlockStage();
        api.claimDaily();
        if (s.bubbles[0]) api.takeBubble(s.bubbles[0].id);
      }
      if (i % 100 === 0) check(`i${i}`);
    }
    check("end");
    assert.ok(taps + merges + delivers > 10, "session made progress");
  });

  it("keeps every map pin on the painting", () => {
    const harborIds = ["stoop", "gull", "pier", "garden", "slip", "lanterns", "shed", "lights"];
    for (const n of COVE_NODES) {
      assert.ok(n.x >= 12 && n.x <= 88, `${n.id} x ${n.x}`);
      assert.ok(n.y >= 12 && n.y <= 78, `${n.id} y ${n.y}`);
      assert.ok(harborIds.includes(n.id), `${n.id} has a 3D place`);
    }
  });

  it("restores the whole cove without poisoning the dock", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    for (let node = 0; node < COVE_NODES.length; node++) {
      const steps = COVE_NODES[node]!.steps.length;
      for (let step = 0; step < steps; step++) {
        toolsFor(node, step);
        assert.equal(api.payCove(), true, `pay ${COVE_NODES[node]!.id} step ${step}`);
        check(`after ${COVE_NODES[node]!.id} ${step}`);
      }
    }
    const s = useGame.getState();
    assert.equal(s.coveNode, COVE_NODES.length);
    assert.ok(s.unlocked.includes("craft"));
    assert.ok(s.unlocked.includes("net"));
    assert.ok(s.unlocked.includes("bloom"));
    assert.ok(s.unlocked.includes("wreck"));
    assert.ok(s.unlocked.includes("keep"));
    assert.ok(s.lastRestore?.id === "lights");
    const gens = s.board.filter((p) => p && ITEMS[p.itemId]?.kind === "generator").map((p) => p!.itemId);
    assert.ok(gens.includes("gen-craft-1") || s.inbox.includes("gen-craft-1"));
  });

  it("merge onto a tarped plank frees it", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s0 = useGame.getState();
    const lockedWith = s0.locked.find((i) => s0.board[i]);
    assert.ok(lockedWith != null, "fresh tide parks finds under tarps");
    const buried = s0.board[lockedWith!]!;
    const open = s0.board.findIndex((p, i) => p && !s0.locked.includes(i) && p.itemId === buried.itemId);
    if (open < 0) {
      const free = s0.board.findIndex((p, i) => !p && !s0.locked.includes(i));
      const board = s0.board.slice();
      board[free] = piece(buried.itemId);
      useGame.setState({ board });
      assert.equal(api.mergePieces(free, lockedWith!), true);
    } else {
      assert.equal(api.mergePieces(open, lockedWith!), true);
    }
    const s1 = useGame.getState();
    assert.ok(!s1.locked.includes(lockedWith!), "tarp pulled");
    assert.ok(s1.board[lockedWith!], "merged piece stays");
  });

  it("refuses to lift a find off a tarp", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s0 = useGame.getState();
    const lockedWith = s0.locked.find((i) => s0.board[i])!;
    const empty = s0.board.findIndex((p, i) => !p && !s0.locked.includes(i));
    assert.equal(api.movePiece(lockedWith, empty), false);
    assert.equal(api.sellAt(lockedWith), false);
    assert.equal(api.storeFromBoard(lockedWith), false);
    const s1 = useGame.getState();
    assert.equal(s1.board[lockedWith]?.itemId, s0.board[lockedWith]?.itemId);
    assert.ok(s1.locked.includes(lockedWith));
  });

  it("merge from a tarp still lands on the tarp", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s0 = useGame.getState();
    const lockedWith = s0.locked.find((i) => s0.board[i])!;
    const buried = s0.board[lockedWith]!;
    const free = s0.board.findIndex((p, i) => !p && !s0.locked.includes(i));
    const board = s0.board.slice();
    board[free] = piece(buried.itemId);
    useGame.setState({ board });
    assert.equal(api.mergePieces(lockedWith, free), true);
    const s1 = useGame.getState();
    assert.ok(!s1.locked.includes(lockedWith), "tarp pulled even when dragged off");
    assert.ok(s1.board[lockedWith], "result sits on the freed plank");
    assert.equal(s1.board[free], null);
  });

  it("every find has a picture on disk", () => {
    const missing: string[] = [];
    for (const def of Object.values(ITEMS)) {
      const file = resolve(process.cwd(), "public/items", `${def.id}.png`);
      if (!existsSync(file)) missing.push(def.id);
    }
    assert.deepEqual(missing, [], missing.join(", "));
  });

  it("the keep logs a missing picture once", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    api.noteArtFault("nope-item");
    api.noteArtFault("keep-1");
    api.noteArtFault("keep-1");
    const hits = useGame.getState().keepLog.filter((n) => n.text.includes("no picture"));
    assert.equal(hits.length, 1);
    assert.match(hits[0]!.text, /Harbor Coin/);
    assert.equal(hits[0]!.status, "open");
    assert.equal(hits[0]!.topic, "art:keep-1");
    const mail = useGame.getState().letters.filter((l) => l.topic === "art:keep-1");
    assert.equal(mail.length, 1);
    assert.equal(mail[0]!.status, "open");
  });

  it("the keep marks a mended picture as fixed and writes a letter", () => {
    const now = Date.now();
    const log = [
      { at: now - 1, text: "Pearl Oyster has no picture", status: "open" as const, topic: "art:tide-6" },
    ];
    const { keepLog, letters, fixed, opened } = applyKeepScan(log, [], [], now);
    assert.equal(opened.length, 0);
    assert.equal(fixed.length, 1);
    assert.equal(keepLog[0]!.status, "fixed");
    assert.match(letters[0]!.body, /fixed/i);
    assert.equal(letters[0]!.status, "fixed");
    assert.equal(letters[0]!.read, false);
  });

  it("merges tide sparks into a flask you can drink", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s0 = useGame.getState();
    const free = s0.board
      .map((p, i) => (!p && !s0.locked.includes(i) ? i : -1))
      .filter((i) => i >= 0);
    const board = s0.board.slice();
    board[free[0]!] = piece("energy-1");
    board[free[1]!] = piece("energy-1");
    useGame.setState({ board, energy: 10, lastEnergyAt: Date.now() });
    assert.equal(api.mergePieces(free[0]!, free[1]!), true);
    assert.equal(useGame.getState().board[free[1]!]?.itemId, "energy-2");
    const a = free[2]!;
    const b = free[1]!;
    const board2 = useGame.getState().board.slice();
    board2[a] = piece("energy-2");
    useGame.setState({ board: board2 });
    assert.equal(api.mergePieces(a, b), true);
    assert.equal(useGame.getState().board[b]?.itemId, "energy-3");
    const before = useGame.getState().energy;
    assert.equal(api.useConsumable(b), true);
    assert.ok(useGame.getState().energy > before);
  });

  it("crates hold more taps and rest sooner", () => {
    assert.ok(GEN_CHARGES >= 10);
    assert.ok(GEN_CHARGES_L2 >= 14);
    assert.ok(GEN_RECHARGE_MS <= 7_000);
    assert.ok(GEN_RECHARGE_L2_MS <= 5_000);
    assert.equal(maxCharges(1), GEN_CHARGES);
    assert.equal(maxCharges(2), GEN_CHARGES_L2);
    assert.equal(rechargeMs(1), GEN_RECHARGE_MS);
    assert.equal(rechargeMs(2), GEN_RECHARGE_L2_MS);
  });

  it("pity steals weight from common tiers into rare", () => {
    const rate = (dry: number) => {
      let rare = 0;
      let n = 0;
      for (let i = 0; i < 8000; i++) {
        const r = pityRoll("tide", 1, dry, Math.random, false);
        if (r.id === "energy-1") continue;
        n += 1;
        const tier = Number(r.id.split("-")[1] ?? 1);
        if (tier >= 4) rare += 1;
      }
      return rare / Math.max(1, n);
    };
    const dry0 = rate(0);
    const dry9 = rate(9);
    assert.ok(dry9 > dry0 * 1.35, `pity did nothing: ${dry0.toFixed(3)} -> ${dry9.toFixed(3)}`);
  });

  it("toasts cap at one and collapse repeats", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    for (let i = 0; i < 6; i++) api.pushToast("Morning tide is not done", "warn");
    const s = useGame.getState();
    assert.equal(s.toasts.length, 1);
    assert.equal(s.toasts[0]?.text, "Morning tide is not done");
    assert.ok((s.toasts[0]?.count ?? 1) >= 2);
  });

  it("L2 crates catch up more than eight drops after a long absence", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s0 = useGame.getState();
    const free = s0.board
      .map((p, i) => (!p && !s0.locked.includes(i) ? i : -1))
      .filter((i) => i >= 0);
    const drop = piece("gen-tide-2");
    const board = s0.board.slice();
    board[free[0]!] = drop;
    const now = Date.now();
    useGame.setState({
      board,
      inbox: [],
      lastTickAt: now - 8 * 60 * 60 * 1000,
      clocks: { [drop.uid]: { charges: 7, readyAt: now, autoAt: now - 8 * 60 * 60 * 1000 } },
    });
    const before = useGame.getState().board.filter(Boolean).length + useGame.getState().inbox.length;
    api.tick(now);
    const after = useGame.getState().board.filter(Boolean).length + useGame.getState().inbox.length;
    assert.ok(after - before > 8, `only caught up ${after - before}, cap is ${AUTO_CATCHUP_MAX}`);
  });

  it("one tick clears the whole L2 backlog, however long the absence", () => {
    // The old loop stopped after AUTO_CATCHUP_MAX drops but left autoAt in the past,
    // so the next tick a second later paid out another full batch. Asserting that
    // autoAt lands in the future is what pins the cap to "per absence", not "per tick".
    for (const hours of [1, 8, 24, 24 * 7, 24 * 30]) {
      const api = useGame.getState();
      api.hydrate();
      api.newTide();
      const s0 = useGame.getState();
      const free = s0.board.findIndex((p, i) => !p && !s0.locked.includes(i));
      assert.ok(free >= 0, "needed an empty unlocked cell");
      const drop = piece("gen-tide-2");
      const board = s0.board.slice();
      board[free] = drop;
      const away = hours * 60 * 60 * 1000;
      const now = Date.now();
      useGame.setState({
        board,
        inbox: [],
        lastTickAt: now - away,
        clocks: { [drop.uid]: { charges: 7, readyAt: now, autoAt: now - away } },
      });

      api.tick(now);

      const clock = useGame.getState().clocks[drop.uid];
      assert.ok(clock, `${hours}h: crate lost its clock`);
      assert.ok(
        clock!.autoAt > now,
        `${hours}h absence left autoAt ${now - clock!.autoAt}ms in the past — the next tick would pay out again`,
      );
      assert.ok(
        clock!.autoAt - now <= AUTO_TICK_MS,
        `${hours}h absence threw away leftover time: next drop is ${clock!.autoAt - now}ms out, one interval is ${AUTO_TICK_MS}ms`,
      );
    }
  });

  it("risky sells are refused until confirmed, on every path", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s0 = useGame.getState();
    const idx = s0.board.findIndex((p, i) => !p && !s0.locked.includes(i));
    assert.ok(idx >= 0, "needed an empty unlocked cell");
    const board = s0.board.slice();
    board[idx] = piece("tide-6"); // tier 6 — a high find
    useGame.setState({ board, undo: null });

    assert.equal(useGame.getState().sellAt(idx), false, "unconfirmed high find must not sell");
    assert.ok(useGame.getState().board[idx], "the find must still be on the dock");
    assert.equal(useGame.getState().selected, idx, "refusing a risky sell selects it");

    assert.equal(
      useGame.getState().sellAt(idx, { confirmed: true }),
      true,
      "confirmed high find must sell",
    );
    assert.equal(useGame.getState().board[idx], null);
    assert.ok(useGame.getState().undo, "a sold find must still be undoable");
  });

  // ---- Phase 1: combo is a live performance, never a saved one ----

  /** puts two identical mergeable finds on adjacent free cells and returns their indices */
  function seedPair(itemId = "tide-1"): [number, number] {
    const s = useGame.getState();
    const free = s.board
      .map((p, i) => (!p && !s.locked.includes(i) ? i : -1))
      .filter((i) => i >= 0);
    const [a, b] = [free[0]!, free[1]!];
    const board = s.board.slice();
    board[a] = piece(itemId);
    board[b] = piece(itemId);
    useGame.setState({ board });
    return [a, b];
  }

  it("a player merge starts a combo and the next one continues it", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    assert.equal(useGame.getState().comboCount, 0);

    let [a, b] = seedPair();
    assert.equal(useGame.getState().mergePieces(a, b), true);
    assert.equal(useGame.getState().comboCount, 1);

    [a, b] = seedPair();
    assert.equal(useGame.getState().mergePieces(a, b), true);
    assert.equal(useGame.getState().comboCount, 2, "a second merge must continue the streak");
  });

  it("selling breaks a combo; parking and gathering do not", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();

    let [a, b] = seedPair();
    useGame.getState().mergePieces(a, b);
    assert.equal(useGame.getState().comboCount, 1);

    // parking a find is not a change of activity.
    // The cell must be UNLOCKED: storeFromBoard and sellAt both refuse a tarped
    // plank and return false, which would make this a silent no-op.
    const s1 = useGame.getState();
    const idx = s1.board.findIndex(
      (p, i) => p && ITEMS[p.itemId]?.kind === "item" && !s1.locked.includes(i),
    );
    assert.ok(idx >= 0, "needed an untarped find to park");
    assert.equal(useGame.getState().storeFromBoard(idx), true, "the park must actually happen");
    assert.equal(useGame.getState().comboCount, 1, "storeFromBoard must not break a streak");

    [a, b] = seedPair();
    useGame.getState().mergePieces(a, b);
    assert.equal(useGame.getState().comboCount, 2);

    // selling is
    const s2 = useGame.getState();
    const sellIdx = s2.board.findIndex(
      (p, i) => p && ITEMS[p.itemId]?.kind === "item" && !s2.locked.includes(i),
    );
    assert.ok(sellIdx >= 0, "needed an untarped find to sell");
    assert.equal(
      useGame.getState().sellAt(sellIdx, { confirmed: true }),
      true,
      "the sell must actually happen, or this proves nothing",
    );
    assert.equal(useGame.getState().comboCount, 0, "sellAt must break the streak");

    [a, b] = seedPair();
    useGame.getState().mergePieces(a, b);
    assert.equal(useGame.getState().comboCount, 1, "the next merge restarts at 1");
  });

  it("a sip does not break a combo but lucky does", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const [a, b] = seedPair();
    useGame.getState().mergePieces(a, b);
    assert.equal(useGame.getState().comboCount, 1);

    useGame.setState({ pearls: 500, energy: 10, lastEnergyAt: Date.now() });
    useGame.getState().buyBoost("sip");
    assert.equal(useGame.getState().comboCount, 1, "sip is the same +25 energy as a flask");

    useGame.getState().buyBoost("lucky");
    assert.equal(useGame.getState().comboCount, 0, "other boosts are a change of activity");
  });

  it("offline auto-drops never build a combo", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s0 = useGame.getState();
    const free = s0.board.findIndex((p, i) => !p && !s0.locked.includes(i));
    const drop = piece("gen-tide-2");
    const board = s0.board.slice();
    board[free] = drop;
    const away = 8 * 60 * 60 * 1000;
    const now = Date.now();
    useGame.setState({
      board,
      inbox: [],
      comboCount: 0,
      comboLastAt: 0,
      lastTickAt: now - away,
      clocks: { [drop.uid]: { charges: 7, readyAt: now, autoAt: now - away } },
    });

    api.tick(now);

    assert.equal(
      useGame.getState().comboCount,
      0,
      "a 24-drop absence must not read as a 24-combo and pay out milestones",
    );
  });

  it("combo state is never written to the save", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const [a, b] = seedPair();
    useGame.getState().mergePieces(a, b);
    assert.ok(useGame.getState().comboCount > 0, "need a live combo to prove it is not saved");

    flushSave();
    const blob = localStorage.getItem(SAVE_KEY);
    assert.ok(blob, "expected a save");
    const saved = JSON.parse(blob!) as Record<string, unknown>;
    assert.equal("comboCount" in saved, false, "comboCount must not reach the save");
    assert.equal("comboLastAt" in saved, false, "comboLastAt must not reach the save");
  });

  it("a purchase that fails does not break a combo", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const [a, b] = seedPair();
    useGame.getState().mergePieces(a, b);
    assert.equal(useGame.getState().comboCount, 1);

    // too poor to buy: buyBoost returns before it can reach breakCombo
    useGame.setState({ pearls: 0 });
    assert.equal(useGame.getState().buyBoost("lucky"), false, "the buy must fail");
    assert.equal(
      useGame.getState().comboCount,
      1,
      "a purchase that never happened must not end a streak",
    );
  });

  it("opening the next reach breaks a combo", () => {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const [a, b] = seedPair();
    useGame.getState().mergePieces(a, b);
    assert.equal(useGame.getState().comboCount, 1);

    // paying a 300+ pearl gate is a bigger change of activity than a dock skin
    useGame.setState({ taskIndex: DELIVERIES_PER_STAGE, pearls: 5000 });
    assert.equal(useGame.getState().unlockStage(), true, "the reach must actually open");
    assert.equal(useGame.getState().comboCount, 0, "unlockStage must break the streak");
  });

  it("Phase 1 adds no save migration", () => {
    assert.equal(SAVE_VERSION, 9, "session juice must not force a SAVE_VERSION bump");
  });
});

// ---------------------------------------------------------------------------
// Phase 2a -- order shapes and the generator fix.
//
// The launch bug: tier = lo + ((seed * 5 + slot * 7) % span). Whenever span
// shared a factor with 5 the seed term vanished and the slot returned one tier
// forever -- total freeze at stages 20-24, two values per slot from 45 on.
// Test "no shape is frozen to a tier" is the regression gate for that, and for
// its second incarnation (shape and tier drawn from one hash).
// ---------------------------------------------------------------------------

const ALL_CHAINS = UNLOCK_ORDER.slice() as PlayChain[];
const STAGES = Array.from({ length: 120 }, (_, i) => i);

function tierOf(itemId: string): number {
  return Number(itemId.slice(itemId.lastIndexOf("-") + 1));
}
function chainOf(itemId: string): string {
  return itemId.slice(0, itemId.lastIndexOf("-"));
}
function order(stage: number, slot: number, seed: number, unlocked: PlayChain[] = ALL_CHAINS) {
  return makeLiveOrder({ stage, slot, seed, avoid: new Set<string>(), unlocked });
}
/** Recover the shape from what shipped, since makeLiveOrder returns only the order. */
function classify(reqs: ReadonlyArray<{ itemId: string; count: number }>): string {
  if (reqs.length === 1) return reqs[0]!.count === 3 ? "haul" : "fetch";
  if (reqs.length === 3) return "assorted";
  if (reqs.length === 2) {
    if (reqs.every((r) => r.count === 2)) return "pair";
    const sameChain = chainOf(reqs[0]!.itemId) === chainOf(reqs[1]!.itemId);
    return sameChain ? "ladder" : "fetch";
  }
  return "fetch";
}

describe("saltwharf orders", () => {
  it("no shape is frozen to a tier", () => {
    for (const stage of STAGES) {
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        const window = orderWindow(ALL_CHAINS);
        const chain = window[slot % window.length]!;
        const b = tierBand(stage, slot, chain);
        const seen = new Set<number>();
        for (let seed = 1; seed <= 200; seed++) {
          const o = order(stage, slot, seed);
          if (classify(o.requires) !== "fetch") continue;
          const first = o.requires[0]!;
          if (chainOf(first.itemId) !== chain) continue;
          seen.add(tierOf(first.itemId));
        }
        const want = b.hi - b.lo + 1;
        assert.equal(
          seen.size,
          want,
          `stage ${stage} slot ${slot}: fetch saw ${[...seen].sort((x, y) => x - y).join(",")} of band ${b.lo}-${b.hi}`,
        );
      }
    }
  });

  it("draw domains do not correlate", () => {
    const kinds = Object.values(DRAW);
    for (const stage of [8, 22, 45, 70]) {
      for (const a of kinds) {
        for (const c of kinds) {
          if (a === c) continue;
          for (let modA = 3; modA <= 7; modA++) {
            for (let modB = 3; modB <= 7; modB++) {
              const seen = new Map<number, Set<number>>();
              for (let seed = 1; seed <= 600; seed++) {
                const x = mix(stage, 0, seed, a) % modA;
                const y = mix(stage, 0, seed, c) % modB;
                if (!seen.has(x)) seen.set(x, new Set());
                seen.get(x)!.add(y);
              }
              for (const [x, ys] of seen) {
                assert.equal(ys.size, modB, `domain ${a}->${c} mod ${modA}/${modB} froze at x=${x}`);
              }
            }
          }
        }
      }
    }
  });

  it("the tier floor rises and tier 1 retires", () => {
    for (const stage of STAGES) {
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 60; seed++) {
          const o = order(stage, slot, seed);
          const shape = classify(o.requires);
          if (shape !== "fetch" || stage < 15) continue;
          // Haul draws at lo-1 by design and may legitimately sit on tier 1.
          for (const r of o.requires) {
            assert.ok(tierOf(r.itemId) >= 2, `stage ${stage} slot ${slot} fetch asked ${r.itemId}`);
          }
        }
      }
    }
  });

  it("nothing is asked above its chain ceiling", () => {
    for (const stage of STAGES) {
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 60; seed++) {
          const o = order(stage, slot, seed);
          for (const r of o.requires) {
            const ch = chainOf(r.itemId) as PlayChain;
            const cap = CHAINS[ch].length;
            assert.ok(tierOf(r.itemId) <= cap, `${r.itemId} exceeds cap ${cap}`);
            assert.ok(ITEMS[r.itemId], `${r.itemId} is not a real item`);
          }
        }
      }
    }
  });

  it("orders never name a locked chain", () => {
    for (const unlocked of [["tide"], ["tide", "hearth"], ["tide", "hearth", "craft"]] as PlayChain[][]) {
      const allowed = new Set(orderWindow(unlocked));
      for (const stage of STAGES) {
        for (let slot = 0; slot < ORDER_SLOTS; slot++) {
          for (let seed = 1; seed <= 30; seed++) {
            const o = order(stage, slot, seed, unlocked);
            for (const r of o.requires) {
              assert.ok(allowed.has(chainOf(r.itemId) as PlayChain), `${r.itemId} not in ${[...allowed]}`);
            }
          }
        }
      }
    }
  });

  it("the generator is deterministic for a fixed unlock set", () => {
    for (const stage of [0, 13, 21, 47, 91]) {
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 40; seed++) {
          assert.deepEqual(order(stage, slot, seed), order(stage, slot, seed));
        }
      }
    }
  });

  it("fetch stays the common ask", () => {
    for (const stage of [30, 45, 60, 90]) {
      let fetch = 0;
      let total = 0;
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 500; seed++) {
          total += 1;
          if (classify(order(stage, slot, seed).requires) === "fetch") fetch += 1;
        }
      }
      const share = fetch / total;
      assert.ok(share >= 0.35, `stage ${stage}: fetch was ${(share * 100).toFixed(1)}%`);
    }
  });

  it("shapes unlock on their gates and ladder never goes missing", () => {
    const shapesAt = (stage: number, unlocked: PlayChain[] = ALL_CHAINS) => {
      const s = new Set<string>();
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 300; seed++) s.add(classify(order(stage, slot, seed, unlocked).requires));
      }
      return s;
    };
    for (const stage of [0, 3, 7]) {
      assert.deepEqual([...shapesAt(stage)], ["fetch"], `stage ${stage} should be fetch only`);
    }
    assert.ok(shapesAt(30).has("haul"), "haul missing at 30");
    assert.ok(shapesAt(30).has("assorted"), "assorted missing at 30");
    assert.ok(shapesAt(30).has("pair"), "pair missing at 30");
    // The v2 gate (hi-lo>=3) left wreck with ladder for five stages of 120.
    for (const stage of [10, 25, 60, 80, 119]) {
      const pool = shapePool(stage, 0, ALL_CHAINS);
      assert.ok(pool.includes("ladder"), `ladder absent from the pool at stage ${stage}`);
    }
  });

  it("a single unlocked chain never produces a multi-chain order", () => {
    for (const stage of STAGES) {
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 40; seed++) {
          const o = order(stage, slot, seed, ["tide"]);
          const chains = new Set(o.requires.map((r) => chainOf(r.itemId)));
          assert.equal(chains.size, 1, `stage ${stage} slot ${slot} spanned ${[...chains]}`);
        }
      }
    }
  });

  it("no order is bigger than the dock can hold", () => {
    for (const stage of STAGES) {
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 40; seed++) {
          const o = order(stage, slot, seed);
          assert.ok(o.requires.length <= 3, `stage ${stage} asked ${o.requires.length} items`);
          for (const r of o.requires) {
            assert.ok(r.count >= 1 && r.count <= 3, `count ${r.count} on ${r.itemId}`);
          }
          // Pair is two ids at count 2. Legal on purpose -- do not "fix" it to 2+1.
          const total = o.requires.reduce((n, r) => n + r.count, 0);
          assert.ok(total <= 4, `stage ${stage} asked ${total} pieces`);
        }
      }
    }
  });

  it("seeded slots avoid asking for the same item twice", () => {
    for (const stage of [12, 25, 40, 70]) {
      const orders = seedOrders(stage, ALL_CHAINS);
      const ids = orders.flatMap((o) => o.requires.map((r) => r.itemId));
      assert.equal(new Set(ids).size, ids.length, `stage ${stage} duplicated across slots: ${ids.join(",")}`);
    }
  });

  it("the generator is total on a starved board", () => {
    for (const stage of STAGES) {
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 50; seed++) {
          const avoid = new Set(["tide-1", "tide-2", "tide-3", "tide-4", "tide-5"]);
          const o = makeLiveOrder({ stage, slot, seed, avoid, unlocked: ["tide"] });
          assert.ok(o, `stage ${stage} slot ${slot} returned nothing`);
          assert.ok(o.requires.length >= 1, `stage ${stage} slot ${slot} returned an empty order`);
          for (const r of o.requires) assert.ok(ITEMS[r.itemId], `bad id ${r.itemId}`);
        }
      }
    }
  });

  it("the visitor branch is untouched", () => {
    const a = makeLiveOrder({
      stage: 20, slot: 1, seed: 9, avoid: new Set<string>(),
      unlocked: ALL_CHAINS, kind: "auto", forceId: "tide-4",
    });
    const b = makeLiveOrder({
      stage: 20, slot: 1, seed: 9, avoid: new Set<string>(),
      unlocked: ALL_CHAINS, kind: "auto", forceId: "tide-4",
    });
    assert.deepEqual(a, b);
    assert.equal(a.kind, "auto");
    assert.equal(a.pearls, 12 + 20 * 2, "visitor pay must not drift");
    assert.equal(a.xp, 18 + 20, "visitor xp must not drift");
    assert.equal(a.rewardItem, "chest-1");
    assert.deepEqual(a.requires, [{ itemId: "tide-4", count: 1 }]);
  });

  it("haul never asks tier 0 and ladder never clears the ceiling", () => {
    for (const stage of STAGES) {
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 80; seed++) {
          const o = order(stage, slot, seed);
          const shape = classify(o.requires);
          if (shape === "haul") {
            assert.ok(tierOf(o.requires[0]!.itemId) >= 1, `haul asked tier 0 at stage ${stage}`);
          }
          if (shape === "ladder") {
            const [x, y] = o.requires.map((r) => tierOf(r.itemId));
            const ch = chainOf(o.requires[0]!.itemId) as PlayChain;
            const b = tierBand(stage, slot, ch);
            assert.equal(y! - x!, 2, `ladder gap was ${y! - x!} at stage ${stage}`);
            assert.ok(y! <= b.hi, `ladder reached ${y} above ceiling ${b.hi} at stage ${stage}`);
          }
        }
      }
    }
  });

  it("orders written by the old generator still fill", () => {
    // Shape a pre-2a save order by hand and run it through the live fill path.
    const legacy = {
      id: "o5-0-1", slot: 0, kind: "resident" as const, character: "mae" as const,
      title: "Sea Glass for the inn", body: "Bring Sea Glass. Quiet Reach.",
      requires: [{ itemId: "tide-1", count: 2 }], pearls: 7, xp: 15,
    };
    const board = Array.from({ length: BOARD_SIZE }, () => null) as Array<ReturnType<typeof piece> | null>;
    board[0] = piece("tide-1");
    board[1] = piece("tide-1");
    const storage = Array.from({ length: STORAGE_SIZE }, () => null) as Array<ReturnType<typeof piece> | null>;
    assert.equal(canFillOrder(board, storage, legacy, []), true, "a legacy order must still be fillable");
    const after = takeFromPools(board, storage, legacy, []);
    assert.equal(after.board.filter(Boolean).length, 0, "the pieces must be consumed");
    assert.equal(SAVE_VERSION, 9, "order shapes must not force a SAVE_VERSION bump");
  });
});
