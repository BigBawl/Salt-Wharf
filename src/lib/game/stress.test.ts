import "./stress-preload.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { useGame } from "./store.ts";
import { BOARD_SIZE, ITEMS, piece } from "./catalog.ts";
import { AUTO_CATCHUP_MAX, AUTO_TICK_MS, COVE_NODES, GEN_CHARGES, GEN_CHARGES_L2, GEN_RECHARGE_L2_MS, GEN_RECHARGE_MS, INBOX_CAP, ORDER_SLOTS, STORAGE_SIZE, maxCharges, pityRoll, rechargeMs } from "./loop.ts";
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
});
