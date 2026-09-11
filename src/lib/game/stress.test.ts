import "./stress-preload.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { useGame, flushSave } from "./store.ts";
import { BOARD_SIZE, DELIVERIES_PER_STAGE, ITEMS, SAVE_KEY, SAVE_VERSION, piece } from "./catalog.ts";
import { AUTO_CATCHUP_MAX, AUTO_TICK_MS, COVE_NODES, DRAW, GEN_CHARGES, GEN_CHARGES_L2, GEN_RECHARGE_L2_MS, GEN_RECHARGE_MS, INBOX_CAP, ORDER_SLOTS, STARTER_UNLOCKED, STORAGE_SIZE, UNLOCK_ORDER, canFillOrder, makeLiveOrder, maxCharges, mix, orderWindow, pityRoll, rechargeMs, seedOrders, shapePool, replaceOrder, takeFromPools, tierBand, CONDITION_BONUS, conditionMet, planSpend, neededFromOrders, seasonFor, holidayFor, easterSunday, nthWeekday, SEASONS, SEASON_DECALS, seasonLook, type OrderCondition } from "./loop.ts";
import { CHAINS, itemWorth, baseItemId, nextItemId, prevItemId, type PlayChain } from "./catalog.ts";
import { healSave, applyKeepScan, topicFromLegacy } from "./watch.ts";

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
      // Check `src`, not `${id}.png`. Starred grades deliberately have no file of
      // their own -- they point at their capstone's picture -- so guessing the path
      // from the id reports art that is not missing.
      const name = def.src.slice(def.src.lastIndexOf("/") + 1);
      const file = resolve(process.cwd(), "public/items", name);
      if (!existsSync(file)) missing.push(`${def.id} -> ${name}`);
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

// Never parse an item id. `tide-10s1` makes both a lastIndexOf("-") split and a
// `${chain}-${tier}` rebuild lie -- tierOf returns NaN and chainOf can return
// "tide-10". Every def already carries `chain` and `tier`; read those.
function tierOf(itemId: string): number {
  return ITEMS[itemId]?.tier ?? Number.NaN;
}
function chainOf(itemId: string): string {
  return ITEMS[itemId]?.chain ?? "";
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
    for (const stage of [0, 3, 5]) {
      assert.deepEqual([...shapesAt(stage)], ["fetch"], `stage ${stage} should be fetch only`);
    }
    // 2a.1 moved the gates in. Assorted at 12 is the one that matters: it is the
    // first shape a player in the low-teens actually sees.
    assert.ok(shapesAt(6).has("haul"), "haul must be live at 6");
    assert.ok(shapesAt(13).has("assorted"), "assorted must be live at 13");
    assert.ok(!shapesAt(16).has("pair"), "pair must stay off until 18");
    assert.ok(shapesAt(20).has("pair"), "pair must be live at 20");
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

  it("shapes survive a realistic avoid set", () => {
    // The other tests build orders with an EMPTY avoid set, which only happens
    // for the very first four orders of a save. In play, replaceOrder passes the
    // three sibling slots' items as `avoid`. Assorted and Pair used to pin every
    // item to its chain floor, so they collided constantly and fell back to
    // Fetch -- about 30% of all shapes, and half of every Assorted, vanished
    // silently. The suite passed the whole time. This is that test.
    for (const stage of [20, 22, 26, 40, 60]) {
      let orders = seedOrders(stage, ALL_CHAINS);
      let intended = 0;
      let lost = 0;
      const window = orderWindow(ALL_CHAINS);
      for (let seed = 5; seed < 200; seed++) {
        const slot = seed % ORDER_SLOTS;
        const avoid = new Set(
          orders.filter((o) => o.slot !== slot).flatMap((o) => o.requires.map((r) => r.itemId)),
        );
        const pool = shapePool(stage, slot, window);
        const want = pool[mix(stage, slot, seed, DRAW.shape) % pool.length]!;
        const got = classify(makeLiveOrder({ stage, slot, seed, avoid, unlocked: ALL_CHAINS }).requires);
        if (want !== "fetch") {
          intended += 1;
          if (got === "fetch") lost += 1;
        }
        orders = replaceOrder(orders, slot, stage, seed, ALL_CHAINS);
      }
      const rate = lost / intended;
      assert.ok(rate <= 0.15, `stage ${stage}: ${Math.round(rate * 100)}% of shapes fell back to fetch`);
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

// ---------------------------------------------------------------------------
// Phase 2b -- conditions.
//
// The governing rule: a condition is a BONUS, never a gate. This game has no
// reroll and no skip, so an order holds its slot until delivered. A gating
// condition that can go permanently false -- thrift, the first time a player
// sells -- would soft-lock a dock slot for the rest of the run. Test 1 below is
// that guarantee, and it is the most important test in this file.
// ---------------------------------------------------------------------------

describe("saltwharf conditions", () => {
  /** Put one order with a known condition into slot 0 and hold exactly its items. */
  function stage(condition: OrderCondition | undefined, itemId = "tide-1", count = 1) {
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s = useGame.getState();
    const board = s.board.slice();
    const free = board.map((p, i) => (!p && !s.locked.includes(i) ? i : -1)).filter((i) => i >= 0);
    for (let k = 0; k < count; k++) board[free[k]!] = piece(itemId);
    const order = {
      ...s.orders[0]!,
      id: `test-${Math.random()}`,
      requires: [{ itemId, count }],
      pearls: 10,
      xp: 5,
      rewardItem: undefined,
      ...(condition ? { condition, bonus: CONDITION_BONUS } : {}),
    };
    const orders = s.orders.map((o) => (o.slot === 0 ? order : o));
    useGame.setState({ board, orders, pearls: 0 });
    return order;
  }

  it("a condition never blocks delivery", () => {
    // Every kind, deliberately unmet. All four must still deliver.
    const kinds: OrderCondition[] = [
      { kind: "deep", itemId: "tide-9" },
      { kind: "thrift" },
      { kind: "streak", need: 5 },
    ];
    for (const c of kinds) {
      stage(c);
      assert.equal(useGame.getState().deliver(0), true, `${c.kind} must not gate delivery`);
    }
  });

  it("selling cannot strand a thrift order", () => {
    stage({ kind: "thrift" }, "tide-1", 1);
    // sell something unrelated, which forfeits the bonus
    const s = useGame.getState();
    const spare = s.board.findIndex(
      (p, i) => p && p.itemId !== "tide-1" && !s.locked.includes(i) && ITEMS[p.itemId]?.kind !== "generator",
    );
    if (spare >= 0) useGame.getState().sellAt(spare, { confirmed: true });
    const before = useGame.getState().pearls;
    assert.equal(useGame.getState().deliver(0), true, "a sold-on thrift order must still deliver");
    const gained = useGame.getState().pearls - before;
    assert.equal(gained, 10, `bonus must be withheld, got ${gained}`);
  });

  it("the bonus is paid only when the condition is met", () => {
    stage({ kind: "thrift" });
    let before = useGame.getState().pearls;
    useGame.getState().deliver(0);
    assert.equal(useGame.getState().pearls - before, 10 + CONDITION_BONUS, "clean thrift pays the bonus");

    stage({ kind: "streak", need: 3 });
    before = useGame.getState().pearls;
    useGame.getState().deliver(0);
    assert.equal(useGame.getState().pearls - before, 10, "an unmet streak pays no bonus");

    stage(undefined);
    before = useGame.getState().pearls;
    useGame.getState().deliver(0);
    assert.equal(useGame.getState().pearls - before, 10, "an order with no condition pays no bonus");
  });

  it("thrift clears on selling and on nothing else", () => {
    stage({ kind: "thrift" });
    const clean = () => useGame.getState().orders.find((o) => o.slot === 0)!.progress?.clean;
    assert.notEqual(clean(), false, "starts clean");

    const s = useGame.getState();
    const gen = s.board.findIndex((p) => p && ITEMS[p.itemId]?.kind === "generator");
    if (gen >= 0) useGame.getState().tapGenerator(gen);
    assert.notEqual(clean(), false, "gathering must not clear thrift");

    const t = useGame.getState();
    const idx = t.board.findIndex(
      (p, i) => p && !t.locked.includes(i) && ITEMS[p.itemId]?.kind !== "generator" && p.itemId !== "tide-1",
    );
    assert.ok(idx >= 0, "need something sellable");
    assert.equal(useGame.getState().sellAt(idx, { confirmed: true }), true);
    assert.equal(clean(), false, "selling must clear thrift");
  });

  it("streak records the best run seen, not the current one", () => {
    stage({ kind: "streak", need: 3 });
    const best = () => useGame.getState().orders.find((o) => o.slot === 0)!.progress?.best ?? 0;
    const seed = (id: string) => {
      const s = useGame.getState();
      const free = s.board.map((p, i) => (!p && !s.locked.includes(i) ? i : -1)).filter((i) => i >= 0);
      const board = s.board.slice();
      board[free[0]!] = piece(id);
      board[free[1]!] = piece(id);
      useGame.setState({ board });
      return [free[0]!, free[1]!] as const;
    };
    for (let k = 0; k < 3; k++) {
      const [a, b] = seed("hearth-1");
      useGame.getState().mergePieces(a, b);
    }
    assert.equal(best(), 3, "three chained merges must record 3");
    useGame.getState().breakCombo();
    const [a, b] = seed("hearth-1");
    useGame.getState().mergePieces(a, b);
    assert.equal(useGame.getState().comboCount, 1, "the live streak restarted");
    assert.equal(best(), 3, "the order must keep the BEST run, not the current one");
  });

  it("streak progress is inside the order, so it survives a reload", () => {
    stage({ kind: "streak", need: 3 });
    const seedTwo = () => {
      const s = useGame.getState();
      const free = s.board.map((p, i) => (!p && !s.locked.includes(i) ? i : -1)).filter((i) => i >= 0);
      const board = s.board.slice();
      board[free[0]!] = piece("hearth-1");
      board[free[1]!] = piece("hearth-1");
      useGame.setState({ board });
      return [free[0]!, free[1]!] as const;
    };
    const [a, b] = seedTwo();
    useGame.getState().mergePieces(a, b);
    flushSave();
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!);
    const saved = raw.orders.find((o: { slot: number }) => o.slot === 0);
    assert.equal(saved.progress?.best, 1, "streak progress must be written into the save");
    assert.equal(saved.condition?.kind, "streak", "the condition must persist too");
  });

  it("deep targets something undiscovered and reachable", () => {
    const chains = UNLOCK_ORDER.slice() as PlayChain[];
    for (const stageNo of [14, 20, 30, 60, 100]) {
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 60; seed++) {
          const known = ["tide-1", "tide-2", "hearth-1"];
          const o = makeLiveOrder({
            stage: stageNo, slot, seed, avoid: new Set<string>(),
            unlocked: chains, discovered: known,
          });
          if (o.condition?.kind !== "deep") continue;
          const id = o.condition.itemId;
          assert.ok(!known.includes(id), `deep targeted a known item ${id}`);
          assert.ok(ITEMS[id], `deep targeted a non-item ${id}`);
          const ch = ITEMS[id]!.chain as PlayChain;
          const b = tierBand(stageNo, slot, ch);
          const t = ITEMS[id]!.tier;
          // Deep deliberately reaches two tiers past the band ceiling: everything
          // inside the band is already made by the time it unlocks. Safe precisely
          // because it is a bonus -- an unmet deep still delivers on its items.
          const reach = Math.min(CHAINS[ch].length, b.hi + 2);
          assert.ok(t <= reach, `deep asked tier ${t} beyond its reach ${reach}`);
          assert.ok(t >= b.lo, `deep asked tier ${t} below the floor ${b.lo}`);
          assert.ok(t <= CHAINS[ch].length, `deep asked past the chain cap`);
        }
      }
    }
  });

  it("deep completes when the target is discovered by any route", () => {
    const order = { slot: 0, kind: "resident" as const, id: "x", character: "mae" as const,
      title: "t", body: "b", requires: [{ itemId: "tide-1", count: 1 }], pearls: 1, xp: 1,
      condition: { kind: "deep" as const, itemId: "tide-5" }, bonus: CONDITION_BONUS };
    assert.equal(conditionMet(order, ["tide-1"]), false);
    assert.equal(conditionMet(order, ["tide-1", "tide-5"]), true);
  });

  it("the condition draw does not correlate with any other draw", () => {
    const others = [DRAW.shape, DRAW.tier, DRAW.chain, DRAW.second, DRAW.text];
    for (const stageNo of [20, 30, 60]) {
      for (const a of [DRAW.cond, DRAW.condKind, DRAW.condArg]) {
        for (const b of others) {
          for (let modA = 3; modA <= 6; modA++) {
            for (let modB = 3; modB <= 6; modB++) {
              const seen = new Map<number, Set<number>>();
              for (let seed = 1; seed <= 600; seed++) {
                const x = mix(stageNo, 0, seed, a) % modA;
                const y = mix(stageNo, 0, seed, b) % modB;
                if (!seen.has(x)) seen.set(x, new Set());
                seen.get(x)!.add(y);
              }
              for (const [x, ys] of seen) {
                assert.equal(ys.size, modB, `domain ${a} vs ${b} froze at x=${x}`);
              }
            }
          }
        }
      }
    }
  });

  it("conditions stay off the early reaches and unlock in order", () => {
    const chains = UNLOCK_ORDER.slice() as PlayChain[];
    const kindsAt = (stageNo: number) => {
      const out = new Set<string>();
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 300; seed++) {
          const c = makeLiveOrder({ stage: stageNo, slot, seed, avoid: new Set<string>(), unlocked: chains, discovered: [] }).condition;
          if (c) out.add(c.kind);
        }
      }
      return out;
    };
    assert.equal(kindsAt(10).size, 0, "no conditions before stage 14");
    assert.ok(kindsAt(16).has("thrift"), "thrift is the baseline and must be live by 16");
    assert.ok(!kindsAt(16).has("streak"), "streak must wait for 18");
    assert.ok(kindsAt(19).has("streak"), "streak must be live by 19");
    assert.ok(kindsAt(30).has("deep"), "deep must be live by 30 when there is something new to make");
  });

  it("a 2a-era order with no condition still delivers and pays no bonus", () => {
    // The exact shape a save written before 2b holds: no `condition`, no `progress`.
    const legacy = {
      id: "o5-0-1", slot: 0, kind: "resident" as const, character: "mae" as const,
      title: "Sea Glass for the inn", body: "Bring Sea Glass.",
      requires: [{ itemId: "tide-1", count: 1 }], pearls: 10, xp: 15,
    };
    assert.equal(conditionMet(legacy, []), true, "no condition must read as met, never as blocked");
    assert.equal(legacy.bonus ?? 0, 0, "and must pay nothing extra");
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s = useGame.getState();
    const board = s.board.slice();
    const free = board.map((p, i) => (!p && !s.locked.includes(i) ? i : -1)).filter((i) => i >= 0);
    board[free[0]!] = piece("tide-1");
    useGame.setState({ board, orders: s.orders.map((o) => (o.slot === 0 ? legacy : o)), pearls: 0 });
    assert.equal(useGame.getState().deliver(0), true, "a legacy order must deliver");
    assert.equal(useGame.getState().pearls, 10, "and pay exactly its face value");
  });

  it("conditions actually appear when the player has already made the band", () => {
    // The play-test bug: deep searched only inside the band, but by the time it
    // unlocks the player has made everything in there, so it silently produced
    // nothing -- and nothing else was tried. 7 of 312 orders carried a condition
    // instead of roughly 1 in 4. Simulate a well-explored save and demand a rate.
    const chains = UNLOCK_ORDER.slice() as PlayChain[];
    const wellExplored: string[] = [];
    for (const ch of chains) for (const id of CHAINS[ch]) wellExplored.push(id);
    for (const stageNo of [16, 22, 30, 60]) {
      let withCond = 0;
      let total = 0;
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 250; seed++) {
          total += 1;
          // everything discovered EXCEPT the very top of each chain
          const known = wellExplored.filter((id) => Number(id.slice(id.lastIndexOf("-") + 1)) < 9);
          const o = makeLiveOrder({ stage: stageNo, slot, seed, avoid: new Set<string>(), unlocked: chains, discovered: known });
          if (o.condition) withCond += 1;
        }
      }
      const rate = withCond / total;
      assert.ok(rate >= 0.2, `stage ${stageNo}: only ${Math.round(rate * 100)}% of orders carried a condition`);
    }
  });

  it("conditions force no save migration", () => {
    assert.equal(SAVE_VERSION, 9, "optional nested fields must not need a version bump");
  });
});

// ---------------------------------------------------------------------------
// Phase 3 -- star tiers.
//
// Two grades past every chain capstone. The capstones were dead ends: a play-test
// run had eighteen wreck-6 on the dock at once because mergePieces refuses any
// merge whose result is null. CHAINS stays frozen so the 2a/2b generator is
// untouched, which test "no order can name a starred item" pins.
// ---------------------------------------------------------------------------

describe("saltwharf star tiers", () => {
  const CAPS = Object.values(CHAINS).map((ids) => ids[ids.length - 1]!);

  it("every capstone now merges, and two make its Bright", () => {
    for (const cap of CAPS) {
      assert.equal(nextItemId(cap), `${cap}s1`, `${cap} must lead somewhere`);
      const api = useGame.getState();
      api.hydrate();
      api.newTide();
      const s = useGame.getState();
      const board = s.board.slice();
      const free = board.map((p, i) => (!p && !s.locked.includes(i) ? i : -1)).filter((i) => i >= 0);
      board[free[0]!] = piece(cap);
      board[free[1]!] = piece(cap);
      useGame.setState({ board });
      assert.equal(useGame.getState().mergePieces(free[0]!, free[1]!), true, `${cap} must merge`);
      assert.ok(
        useGame.getState().board.some((p) => p?.itemId === `${cap}s1`),
        `${cap} + ${cap} must make a Bright`,
      );
    }
  });

  it("Radiant is the true cap", () => {
    for (const cap of CAPS) {
      assert.equal(nextItemId(`${cap}s2`), null, `${cap}s2 must be the end`);
      const api = useGame.getState();
      api.hydrate();
      api.newTide();
      const s = useGame.getState();
      const board = s.board.slice();
      const free = board.map((p, i) => (!p && !s.locked.includes(i) ? i : -1)).filter((i) => i >= 0);
      board[free[0]!] = piece(`${cap}s2`);
      board[free[1]!] = piece(`${cap}s2`);
      useGame.setState({ board });
      assert.equal(useGame.getState().mergePieces(free[0]!, free[1]!), false, "two Radiants must not merge");
    }
  });

  it("CHAINS is frozen, so no tier band moved", () => {
    assert.deepEqual(
      Object.values(CHAINS).map((ids) => ids.length),
      [10, 10, 10, 8, 8, 6, 6],
      "widening CHAINS would move every floor and ceiling the generator was tested against",
    );
    for (const ids of Object.values(CHAINS)) {
      for (const id of ids) assert.equal(ITEMS[id]?.star, undefined, `${id} must not be starred`);
    }
  });

  it("no generated order can ever name a starred item", () => {
    const chains = UNLOCK_ORDER.slice() as PlayChain[];
    for (let stage = 0; stage < 120; stage++) {
      for (let slot = 0; slot < ORDER_SLOTS; slot++) {
        for (let seed = 1; seed <= 40; seed++) {
          const o = makeLiveOrder({ stage, slot, seed, avoid: new Set<string>(), unlocked: chains, discovered: [] });
          for (const r of o.requires) {
            assert.equal(ITEMS[r.itemId]?.star, undefined, `stage ${stage} asked for ${r.itemId}`);
          }
          if (o.condition?.kind === "deep") {
            assert.equal(ITEMS[o.condition.itemId]?.star, undefined, "deep must not target a star either");
          }
        }
      }
    }
  });

  it("worth is the merge tree: 2 and 4", () => {
    for (const cap of CAPS) {
      assert.equal(itemWorth(cap), 1);
      assert.equal(itemWorth(`${cap}s1`), 2);
      assert.equal(itemWorth(`${cap}s2`), 4);
      assert.equal(baseItemId(`${cap}s1`), cap);
      assert.equal(baseItemId(`${cap}s2`), cap);
      assert.equal(baseItemId(cap), cap);
    }
  });

  it("a star is never spent for more than the order needs", () => {
    // The value-destroying case: one Radiant on the dock, an order wanting one
    // capstone. Spending it would burn 4 for 1. The order is simply not fillable.
    assert.equal(planSpend(1, { plain: 0, s1: 0, s2: 1 }), null, "must not overpay 4 for 1");
    assert.equal(planSpend(1, { plain: 0, s1: 1, s2: 0 }), null, "must not overpay 2 for 1");
    assert.equal(planSpend(3, { plain: 0, s1: 0, s2: 1 }), null, "must not overpay 4 for 3");
    // and when it fits exactly, it is spent
    assert.deepEqual(planSpend(4, { plain: 0, s1: 0, s2: 1 }), { plain: 0, s1: 0, s2: 1 });
    assert.deepEqual(planSpend(2, { plain: 0, s1: 1, s2: 0 }), { plain: 0, s1: 1, s2: 0 });
  });

  it("plain pieces are preferred, but a star is used rather than stranding an order", () => {
    // prefers plain when plain alone covers it
    assert.deepEqual(
      planSpend(2, { plain: 2, s1: 1, s2: 1 }),
      { plain: 2, s1: 0, s2: 0 },
      "a star must not be eaten while ordinary pieces would do",
    );
    // naive cheapest-first would spend the plain, leave 1, find the Bright too big,
    // and call a fillable order unfillable. It must not.
    assert.deepEqual(
      planSpend(2, { plain: 1, s1: 1, s2: 0 }),
      { plain: 0, s1: 1, s2: 0 },
      "one plain + one Bright must fill a 2x order",
    );
    assert.deepEqual(planSpend(3, { plain: 1, s1: 1, s2: 0 }), { plain: 1, s1: 1, s2: 0 });
    assert.equal(planSpend(1, { plain: 0, s1: 0, s2: 0 }), null);
  });

  it("a Bright fills a 2x capstone order and is consumed once", () => {
    const cap = "wreck-6";
    const api = useGame.getState();
    api.hydrate();
    api.newTide();
    const s = useGame.getState();
    const board = s.board.slice();
    const free = board.map((p, i) => (!p && !s.locked.includes(i) ? i : -1)).filter((i) => i >= 0);
    board[free[0]!] = piece(`${cap}s1`);
    const order = { ...s.orders[0]!, id: "star-test", requires: [{ itemId: cap, count: 2 }], pearls: 5, xp: 5, rewardItem: undefined, condition: undefined, bonus: undefined };
    const storage = Array.from({ length: STORAGE_SIZE }, () => null);
    assert.equal(canFillOrder(board, storage, order, s.locked), true, "a Bright must cover 2x");
    const after = takeFromPools(board, storage, order, s.locked);
    assert.equal(after.board.filter((p) => p?.itemId === `${cap}s1`).length, 0, "the Bright is spent");
    // and one Bright must NOT cover a 3x order
    const three = { ...order, requires: [{ itemId: cap, count: 3 }] };
    assert.equal(canFillOrder(board, storage, three, s.locked), false, "worth 2 cannot cover 3");
  });

  it("the capstone moment lands on the base and on Radiant, not between", () => {
    for (const cap of CAPS) {
      assert.equal(ITEMS[cap]?.capstone, true, `${cap} must still feel like an arrival`);
      assert.ok(!ITEMS[`${cap}s1`]?.capstone, "Bright is a step, not an arrival");
      assert.equal(ITEMS[`${cap}s2`]?.capstone, true, "Radiant is an arrival");
    }
  });

  it("stars sell for exactly two and four bases", () => {
    for (const cap of CAPS) {
      const base = ITEMS[cap]!.sell;
      assert.equal(ITEMS[`${cap}s1`]!.sell, base * 2, "a Bright must not mint pearls");
      assert.equal(ITEMS[`${cap}s2`]!.sell, base * 4, "nor a Radiant");
    }
  });

  it("starred grades borrow the capstone picture and add no files", () => {
    for (const cap of CAPS) {
      for (const g of [1, 2]) {
        assert.equal(ITEMS[`${cap}s${g}`]!.src, ITEMS[cap]!.src, `${cap}s${g} must reuse the capstone art`);
      }
    }
  });

  it("a Radiant splits back into two Brights", () => {
    // prevItemId used to be `${chain}-${tier-1}`, which resolves a Radiant at tier
    // 12 to a "tide-11" that does not exist -- splitAt would have failed silently.
    for (const cap of CAPS) {
      assert.equal(prevItemId(`${cap}s2`), `${cap}s1`, "Radiant splits into Brights");
      assert.equal(prevItemId(`${cap}s1`), cap, "Bright splits into capstones");
    }
  });

  it("the board marks a star as wanted when its base is on an order", () => {
    const cap = "keep-6";
    const orders = [{ slot: 0, kind: "resident" as const, id: "x", character: "mae" as const, title: "t", body: "b", requires: [{ itemId: cap, count: 2 }], pearls: 1, xp: 1 }];
    const needed = neededFromOrders(orders);
    assert.ok(needed.has(cap), "the base is wanted");
    assert.ok(needed.has(`${cap}s1`), "so is a Bright of it");
    assert.ok(needed.has(`${cap}s2`), "and a Radiant");
    assert.ok(!needed.has("tide-1"), "and nothing else");
  });

  it("no two finds share a name or a blurb", () => {
    // Part A. craft-3 and hammer-3 were both "Claw Hammer"; craft-10 and lamp-5
    // shared a blurb word for word. energy-flask is the one legitimate pair --
    // it is a legacy id that watch.ts remaps onto energy-3, so it is the same
    // item and SHOULD carry the same name.
    const real = Object.values(ITEMS).filter((d) => !d.star && d.id !== "energy-flask");
    const names = new Map<string, string[]>();
    const blurbs = new Map<string, string[]>();
    for (const d of real) {
      if (!names.has(d.name)) names.set(d.name, []);
      names.get(d.name)!.push(d.id);
      if (!blurbs.has(d.blurb)) blurbs.set(d.blurb, []);
      blurbs.get(d.blurb)!.push(d.id);
    }
    for (const [name, ids] of names) assert.equal(ids.length, 1, `"${name}" is used by ${ids.join(", ")}`);
    for (const [, ids] of blurbs) assert.equal(ids.length, 1, `${ids.join(", ")} share a blurb`);
  });

  it("a Keep note written before a rename still finds its item", () => {
    // topicFromLegacy resolves old notes by NAME. Without the legacy map a note
    // saying "Claw Hammer has no picture" would stop matching craft-3 and the
    // player would see the same note twice.
    assert.equal(topicFromLegacy("The Keep: Iron Nail has no picture"), "art:craft-1");
    // "Claw Hammer" was shared by craft-3 and hammer-3, so an old note using it is
    // ambiguous by construction. Holt still holds the name, so it resolves there.
    assert.equal(topicFromLegacy("The Keep: Claw Hammer has no picture"), "art:hammer-3");
    assert.equal(topicFromLegacy("The Keep: Beacon Lamp has no picture"), "art:craft-10");
    // and a current name still resolves the ordinary way
    assert.equal(topicFromLegacy("The Keep: Ship's Bell has no picture"), "art:craft-3");
    // Holt keeps his hammer, so this must resolve to the tool, not to craft
    assert.equal(topicFromLegacy("The Keep: Dock Maul has no picture"), "art:hammer-4");
  });

  it("star tiers force no save migration", () => {
    assert.equal(SAVE_VERSION, 9, "new item ids are data, not schema");
  });
});

// ---------------------------------------------------------------------------
// Phase 4a -- seasons.
//
// Every costume is a pure function of the clock, so December is provable in
// September. Nothing here is stored and SAVE_VERSION does not move.
// v1 is the Canadian calendar in local time: Thanksgiving is the second Monday
// of October, and a southern-hemisphere player gets snow in July. Deliberate.
// ---------------------------------------------------------------------------

describe("saltwharf seasons", () => {
  const at = (y: number, m: number, d: number, hh = 12) => new Date(y, m, d, hh).getTime();

  it("Easter lands on the real date", () => {
    const known: Record<number, string> = {
      2024: "2024-03-31", 2025: "2025-04-20", 2026: "2026-04-05",
      2027: "2027-03-28", 2028: "2028-04-16", 2029: "2029-04-01", 2030: "2030-04-21",
    };
    for (const [y, want] of Object.entries(known)) {
      const d = easterSunday(Number(y));
      const got = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      assert.equal(got, want, `Easter ${y}`);
      // structural, so a wrong computus cannot pass by matching a typo above
      assert.equal(d.getDay(), 0, `Easter ${y} must be a Sunday`);
      assert.ok(d.getMonth() === 2 || d.getMonth() === 3, `Easter ${y} must be March or April`);
    }
  });

  it("Thanksgiving is the Canadian one", () => {
    for (let y = 2026; y <= 2032; y++) {
      const d = nthWeekday(y, 9, 1, 2);
      assert.equal(d.getMonth(), 9, `${y}: October`);
      assert.equal(d.getDay(), 1, `${y}: Monday`);
      // the 2nd Monday is the only Monday falling on the 8th-14th
      assert.ok(d.getDate() >= 8 && d.getDate() <= 14, `${y}: second Monday, got the ${d.getDate()}`);
      // and it must NOT be the American date, the 4th Thursday of November
      const us = nthWeekday(y, 10, 4, 4);
      assert.notEqual(holidayFor(at(y, us.getMonth(), us.getDate())), "thanksgiving", `${y}: US date must be ordinary`);
    }
  });

  it("the Thanksgiving costume runs Saturday through Monday", () => {
    const mon = nthWeekday(2026, 9, 1, 2);
    const day = (off: number) => holidayFor(at(2026, 9, mon.getDate() + off));
    assert.equal(day(-3), null, "Friday is ordinary");
    assert.equal(day(-2), "thanksgiving", "Saturday");
    assert.equal(day(-1), "thanksgiving", "Sunday");
    assert.equal(day(0), "thanksgiving", "Monday itself");
    assert.equal(day(1), null, "Tuesday is ordinary");
  });

  it("every month lands in exactly one season", () => {
    const want: Record<number, string> = {
      0: "winter", 1: "winter", 2: "spring", 3: "spring", 4: "spring",
      5: "summer", 6: "summer", 7: "summer", 8: "autumn", 9: "autumn",
      10: "autumn", 11: "winter",
    };
    for (let m = 0; m < 12; m++) {
      const first = new Date(2026, m, 1, 0, 0, 0, 0).getTime();
      const last = new Date(2026, m + 1, 0, 23, 59, 59, 999).getTime();
      assert.equal(seasonFor(first), want[m], `month ${m} first second`);
      assert.equal(seasonFor(last), want[m], `month ${m} last second`);
    }
  });

  it("holiday windows hold at their first and last second", () => {
    const edge = (y: number, m: number, d: number, want: string | null) => {
      assert.equal(holidayFor(new Date(y, m, d, 0, 0, 0, 0).getTime()), want, `${y}-${m + 1}-${d} 00:00`);
      assert.equal(holidayFor(new Date(y, m, d, 23, 59, 59, 999).getTime()), want, `${y}-${m + 1}-${d} 23:59`);
    };
    edge(2026, 11, 17, null);          // Dec 17 ordinary
    edge(2026, 11, 18, "christmas");   // window opens
    edge(2026, 11, 26, "christmas");   // window closes
    edge(2026, 11, 27, null);
    edge(2026, 11, 31, "newyear");
    edge(2027, 0, 1, "newyear");
    edge(2027, 0, 2, "newyear");
    edge(2027, 0, 3, null);
    edge(2026, 9, 24, null);
    edge(2026, 9, 25, "halloween");
    edge(2026, 9, 31, "halloween");
    edge(2026, 10, 1, null);
    edge(2026, 6, 1, "canadaday");
    edge(2026, 6, 2, null);
  });

  it("Christmas Day is Christmas, not New Year", () => {
    // the Dec 31 rule sits after the Christmas rule on purpose
    assert.equal(holidayFor(at(2026, 11, 25)), "christmas");
    assert.equal(holidayFor(at(2026, 11, 31)), "newyear");
  });

  it("a whole year never doubles up or leaves a gap", () => {
    for (const y of [2024, 2026, 2027, 2028]) {
      for (let m = 0; m < 12; m++) {
        const days = new Date(y, m + 1, 0).getDate();
        for (let d = 1; d <= days; d++) {
          const t = at(y, m, d);
          const s = seasonFor(t);
          assert.ok(SEASONS.includes(s), `${y}-${m + 1}-${d}: ${s} is not a season`);
          const h = holidayFor(t);
          if (h !== null) {
            assert.equal(typeof h, "string", `${y}-${m + 1}-${d}`);
          }
        }
      }
    }
    // 2024 is a leap year: Feb 29 must resolve like any other day
    assert.equal(seasonFor(at(2024, 1, 29)), "winter");
  });

  it("the resolvers read their argument, not the wall clock", () => {
    // Comparing seasonFor(t) to itself cannot catch a Date.now() leak, since both
    // calls pass the same t. Move the clock underneath instead.
    const real = Date.now;
    try {
      // Easter 2027 is March 28, not April -- the window is Good Friday to Easter Monday.
      const samples = [at(2026, 11, 25), at(2027, 2, 28), at(2026, 8, 11), at(2026, 9, 31)];
      Date.now = () => at(2026, 5, 15); // a summer day with no holiday
      const first = samples.map((t) => `${seasonFor(t)}/${holidayFor(t)}`);
      Date.now = () => at(2026, 11, 25); // Christmas
      const second = samples.map((t) => `${seasonFor(t)}/${holidayFor(t)}`);
      assert.deepEqual(second, first, "a moved wall clock must not change an explicit date");
      assert.deepEqual(first, ["winter/christmas", "spring/easter", "autumn/null", "autumn/halloween"]);
    } finally {
      Date.now = real;
    }
  });

  it("every season has a stylesheet block defining all 18 tokens", () => {
    // 4a ships four season palettes and no holiday CSS. Holiday blocks get their
    // own assertion when those dressings ship.
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    const tokens = [...new Set([...css.matchAll(/--color-[a-z0-9-]+(?=:)/g)].map((m) => m[0]))];
    assert.equal(tokens.length, 18, `expected 18 colour tokens, found ${tokens.length}`);
    for (const season of SEASONS) {
      const block = css.match(new RegExp(`\\[data-season="${season}"\\] \\{([^}]*)\\}`));
      assert.ok(block, `no CSS block for ${season}`);
      for (const t of tokens) {
        assert.ok(block![1]!.includes(`${t}:`), `${season} is missing ${t}`);
      }
    }
  });

  it("no season drops text or a dark find into an unreadable hole", () => {
    // We shipped keep-1 / keep-2 at luminance ~50 on a sand plank. A rust autumn
    // must not put them in the same hole, and cell text must stay readable.
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
    const hex = (s: string) => {
      const m = s.match(/^#([0-9a-f]{6})$/i);
      if (!m) return null;
      const n = parseInt(m[1]!, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number];
    };
    const lum = ([r, g, b]: [number, number, number]) => {
      const f = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const ratio = (a: [number, number, number], b: [number, number, number]) => {
      const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
      return (x + 0.05) / (y + 0.05);
    };
    const DARK_FIND: [number, number, number] = [50, 50, 50]; // keep-1 / keep-2
    for (const season of SEASONS) {
      const block = css.match(new RegExp(`\\[data-season="${season}"\\] \\{([^}]*)\\}`))![1]!;
      const get = (name: string) => {
        const m = block.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"));
        return m ? hex(m[1]!) : null;
      };
      const cell = get("--color-cell")!;
      const cellInk = get("--color-cell-ink")!;
      const ink = get("--color-ink")!;
      const sand = get("--color-sand")!;
      assert.ok(ratio(cell, cellInk) >= 7, `${season}: cell vs cell-ink is ${ratio(cell, cellInk).toFixed(1)}:1`);
      assert.ok(ratio(cell, ink) >= 7, `${season}: cell vs ink is ${ratio(cell, ink).toFixed(1)}:1`);
      assert.ok(ratio(sand, DARK_FIND) >= 4.5, `${season}: a dark find on sand is ${ratio(sand, DARK_FIND).toFixed(1)}:1`);
    }
  });

  it("seasons force no save migration", () => {
    assert.equal(SAVE_VERSION, 9, "a costume derives from the clock and is never stored");
  });
});

// ---------------------------------------------------------------------------
// Phase 4c -- autumn decals, and the two surfaces 4a could not reach.
//
// 4a retinted everything that derives from the 18 colour tokens. The 3D harbour
// does not: CoveIso is a canvas with 124 hardcoded colours and no CSS token, and
// .harbor-stage paints a fixed sky behind it. Both sit above the board, so after
// 4a a rust dock sat under a summer harbour. These tests pin the fix.
// ---------------------------------------------------------------------------

describe("saltwharf season decals", () => {
  const css = () => readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

  it("every season tints the 3D harbour and its sky", () => {
    const s = css();
    for (const season of SEASONS) {
      assert.ok(
        new RegExp(`\\[data-season="${season}"\\] \\.harbor-stage \\{[^}]*background:`).test(s),
        `${season} leaves the harbour sky on the hardcoded #7eb8c9`,
      );
    }
    // Trees are painted inside the canvas now. Autumn foliage must not be the summer green.
    assert.notEqual(seasonLook("autumn").webFoliage, seasonLook("summer").webFoliage);
    assert.equal(seasonLook("autumn").pumpkins, true);
    assert.equal(seasonLook("summer").pumpkins, false);
  });

  it("the harbour filter is not double-tinting the canvas", () => {
    const s = css();
    assert.ok(!/\[data-season="[a-z]+"\] \.harbor-stage canvas \{[^}]*filter:/.test(s),
      "season colour is painted in-canvas; a CSS filter would stack");
  });

  it("every declared decal has a file on disk", () => {
    for (const [season, slots] of Object.entries(SEASON_DECALS)) {
      const want: string[] = [];
      if (slots?.corners) want.push(`${season}-corner-l.png`, `${season}-corner-r.png`);
      if (slots?.cove) want.push(`${season}-cove.png`);
      if (slots?.rails) want.push(`${season}-rail-l.png`, `${season}-rail-r.png`);
      for (const f of want) {
        assert.ok(
          existsSync(resolve(process.cwd(), "public/season", f)),
          `SEASON_DECALS declares ${season} but public/season/${f} is missing`,
        );
      }
    }
  });

  it("no stylesheet rule points at a public asset", () => {
    // Everything here is served from /Salt-Wharf/ on Pages. A bare url(/season/...)
    // in CSS resolves to the domain root and 404s in production; asset() exists for
    // exactly this reason, so decal URLs are built in React.
    const s = css();
    // Bracket class, not a backslash escape: the project's corruption sweep greps
    // for an escaped paren, and writing one here would set that tripwire off for
    // nothing. A false alarm on that check is worse than no check.
    const bare = s.match(/url[(]\s*[/](?![/])/g) ?? [];
    assert.equal(bare.length, 0, `${bare.length} stylesheet rule(s) bypass asset()`);
  });

  it("decals never swallow a tap", () => {
    const s = css();
    for (const cls of [".season-corner", ".season-cove"]) {
      const block = s.match(new RegExp(`\\${cls} \\{([^}]*)\\}`));
      assert.ok(block, `${cls} has no rule`);
      assert.ok(block![1]!.includes("pointer-events: none"), `${cls} must not take pointer events`);
    }
  });

  it("art in public/ forces a CACHE bump", () => {
    // Phase 1's rule: anything under public/ needs a new cache name or players keep
    // the old files. This patch ships three PNGs.
    const sw = readFileSync(resolve(process.cwd(), "public/sw.js"), "utf8");
    const m = sw.match(/const CACHE = "saltwharf-v(\d+)"/);
    assert.ok(m, "sw.js has no CACHE name");
    assert.ok(Number(m![1]) >= 9, `CACHE is v${m![1]}, but this patch adds files under public/`);
  });

  it("decals force no save migration", () => {
    assert.equal(SAVE_VERSION, 9);
  });
});
