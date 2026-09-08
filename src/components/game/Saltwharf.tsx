import { useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import {
  Anchor,
  BookOpen,
  Fish,
  Flower2,
  House,
  Inbox,
  Lamp,
  Lightbulb,
  Merge,
  MousePointerClick,
  Package,
  PackageCheck,
  Paintbrush,
  Scissors,
  Settings,
  Sparkles,
  Store,
  Undo2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  BOOSTS,
  CHARACTERS,
  CHAINS,
  CHAIN_LABEL,
  CRATES,
  DELIVERIES_PER_STAGE,
  ITEMS,
  LOOKS,
  STAGE_COUNT,
  TOOL_CHAINS,
  TOOL_LABEL,
  chainUnlockHint,
  chainUnlocked,
  dockSkinFor,
  hasProducer,
  item,
  levelFromXp,
  nextItemId,
  stageLine,
  stageName,
  xpIntoLevel,
  type BoostId,
  type CosmeticId,
  type PlayChain,
} from "@/lib/game/catalog";
import {
  BUBBLE_TAKE_COST,
  COVE_NODES,
  DAILY_NEED,
  ENERGY_MAX,
  canFillOrder,
  canPayStep,
  dailyComplete,
  energyWaitSec,
  neededFromOrders,
  regenEnergy,
} from "@/lib/game/loop";
import { flushSave, useGame } from "@/lib/game/store";
import { setMuted, unlockAudio } from "@/lib/game/audio";
import { Button } from "@/components/ui/button";
import { asset, cn } from "@/lib/utils";
import { Board } from "./Board";
import { Harbor } from "./Harbor";
import { ItemArt, PearlMark } from "./ItemArt";
import { RestoreCeremony } from "./Cove";
import { TownWalk } from "./TownWalk";

type Sheet = "none" | "cove" | "journal" | "settings" | "shop" | "inbox";

const LOOK_ICONS: Record<CosmeticId, typeof Lamp> = {
  lanterns: Lamp,
  painted: Paintbrush,
  lights: Lightbulb,
};

const BOOST_ICONS: Record<BoostId, typeof Sparkles> = {
  sip: Zap,
  lucky: Sparkles,
  parcel: Package,
  shears: Scissors,
};

export function Saltwharf() {
  const started = useGame((s) => s.started);
  const hydrated = useGame((s) => s.hydrated);
  const hydrate = useGame((s) => s.hydrate);

  useLayoutEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flushSave);
    window.addEventListener("beforeunload", flushSave);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flushSave);
      window.removeEventListener("beforeunload", flushSave);
    };
  }, []);

  if (!hydrated || !started) return <StartScreen />;
  return <GameScreen />;
}

function StartScreen() {
  const start = useGame((s) => s.start);
  const newTide = useGame((s) => s.newTide);
  const hasProgress =
    useGame((s) => s.merges) > 0 || useGame((s) => s.delivered) > 0 || useGame((s) => s.taskIndex) > 0;

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg-deep text-ink">
      <img
        src={asset("/village/restored.jpg")}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bg-deep/15 via-bg/55 to-bg" />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-end px-6 pb-12 pt-[max(3rem,env(safe-area-inset-top))]">
        <div className="stagger-in mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-energy">
            Merge & restore
          </p>
          <h1 className="mt-2 font-display text-5xl font-semibold italic leading-none tracking-tight">
            Saltwharf
          </h1>
          <p className="mt-3 max-w-xs text-base leading-relaxed text-ink/80">
            The storm took the lights. Spend energy to gather, merge what the tide gives, restore a place on the cove, and the next crate comes in the mail.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {hasProgress ? (
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                unlockAudio();
                start();
              }}
            >
              Continue
            </Button>
          ) : null}
          <Button
            size="lg"
            variant={hasProgress ? "linen" : "primary"}
            className="w-full"
            onClick={() => {
              unlockAudio();
              newTide();
            }}
          >
            {hasProgress ? "New tide" : "Begin"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function GameScreen() {
  const [sheet, setSheet] = useState<Sheet>("none");
  const pearls = useGame((s) => s.pearls);
  const energy = useGame((s) => s.energy);
  const lastEnergyAt = useGame((s) => s.lastEnergyAt);
  const xp = useGame((s) => s.xp);
  const taskIndex = useGame((s) => s.taskIndex);
  const gameStage = useGame((s) => s.stage);
  const selected = useGame((s) => s.selected);
  const board = useGame((s) => s.board);
  const storage = useGame((s) => s.storage);
  const orders = useGame((s) => s.orders);
  const inbox = useGame((s) => s.inbox);
  const letters = useGame((s) => s.letters);
  const coveNode = useGame((s) => s.coveNode);
  const tick = useGame((s) => s.tick);
  const seenLoop = useGame((s) => s.seenLoop);
  const won = useGame((s) => s.won);
  const sfxOn = useGame((s) => s.sfxOn);
  const toasts = useGame((s) => s.toasts);
  const fx = useGame((s) => s.fx);
  const dismissHowTo = useGame((s) => s.dismissHowTo);
  const [coveFocus, setCoveFocus] = useState(0);

  useEffect(() => {
    setCoveFocus(coveNode);
  }, [coveNode]);

  useEffect(() => {
    setMuted(!sfxOn);
  }, [sfxOn]);

  useEffect(() => {
    const id = window.setInterval(() => tick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [tick]);

  const level = levelFromXp(xp);
  const xpBar = xpIntoLevel(xp, level);
  const awaitingGate = taskIndex >= (gameStage + 1) * DELIVERIES_PER_STAGE && gameStage < STAGE_COUNT - 1;
  const needed = useMemo(() => neededFromOrders(orders), [orders]);
  const selPiece = selected != null ? board[selected] : null;
  const selDef = selPiece ? item(selPiece.itemId) : undefined;
  const locked = useGame((s) => s.locked);
  const coveStep = useGame((s) => s.coveStep);
  const payNode = COVE_NODES[coveNode];
  const payStepDef = payNode?.steps[coveStep];
  const mailCount = inbox.length + letters.filter((l) => !l.read).length;
  const canPayCove = Boolean(payNode && payStepDef && canPayStep(board, storage, pearls, payStepDef, locked));

  return (
    <div
      className="flex h-dvh min-h-0 flex-col overflow-hidden bg-bg-deep text-ink lg:flex-row"
      onPointerDown={unlockAudio}
    >
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <section className="harbor-stage shrink-0" data-harbor>
          <Harbor
            coveNode={coveNode}
            focus={coveFocus}
            onFocus={(i) => {
              setCoveFocus(i);
              setSheet("cove");
            }}
            onOpen={() => {
              setCoveFocus(coveNode);
              setSheet("cove");
            }}
          />

          <header className="harbor-hud">
            <button
              type="button"
              className="flex h-11 items-center gap-1.5 rounded-lg bg-bg px-2.5 text-sm font-semibold tabular-nums shadow-panel hover:bg-ink/5"
              onClick={() => setSheet("shop")}
              aria-label="Open Holt's oddments"
            >
              <PearlMark className="text-pearl" />
              <span className="tabular-nums">{pearls}</span>
            </button>
            <button
              type="button"
              className={cn(
                "flex h-11 min-w-[4.6rem] flex-col items-start justify-center rounded-lg bg-bg px-2.5 text-left shadow-panel hover:bg-ink/5",
                regenEnergy(energy, lastEnergyAt, Date.now()).energy < 1 && "energy-empty",
              )}
              onClick={() => setSheet("shop")}
              aria-label="Energy"
              data-hud="energy"
            >
              <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                <Zap className="size-3.5 text-energy" />
                {regenEnergy(energy, lastEnergyAt, Date.now()).energy}
                <span className="text-[10px] font-medium text-fog">/{ENERGY_MAX}</span>
              </span>
              {regenEnergy(energy, lastEnergyAt, Date.now()).energy < ENERGY_MAX ? (
                <span className="text-[9px] font-semibold tracking-wide text-energy">
                  +1 · {energyWaitSec(energy, lastEnergyAt, Date.now())}s
                </span>
              ) : (
                <span className="text-[9px] font-semibold uppercase tracking-wide text-fog">Full</span>
              )}
            </button>
            <div className="min-w-0 flex-1 rounded-lg bg-bg/80 px-2 py-1 shadow-panel">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-sm italic text-surface">Saltwharf</span>
                <span className="text-[11px] text-fog tabular-nums">Lv {level + 1}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg-deep">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{
                    width: Math.min(100, xpBar.need > 0 && Number.isFinite(xpBar.have) ? (xpBar.have / xpBar.need) * 100 : 0) + "%",
                  }}
                />
              </div>
            </div>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-lg bg-bg text-ink/70 shadow-panel hover:bg-ink/5"
              onClick={() => {
                if (inbox.length || letters.length) setSheet("inbox");
                else useGame.getState().pushToast("Inbox is empty");
              }}
              aria-label="Inbox"
            >
              <span className="relative">
                <Inbox className="size-5" />
                {mailCount > 0 ? (
                  <span className="absolute -top-1 -right-1 grid min-w-3.5 place-items-center rounded-full bg-primary px-0.5 text-[9px] font-bold text-primary-fg">
                    {mailCount}
                  </span>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-lg bg-bg text-ink/70 shadow-panel hover:bg-ink/5"
              onClick={() => setSheet("settings")}
              aria-label="Settings"
            >
              <Settings className="size-5" />
            </button>
          </header>

          <WorkChip
            canPay={canPayCove}
            onOpen={() => {
              setCoveFocus(coveNode);
              setSheet("cove");
            }}
          />
          <ToastRail toasts={toasts} />
        </section>

        <OrderStrip awaitingGate={awaitingGate} />

        <div className="flex min-h-0 flex-1 flex-col px-2 pb-[max(0.35rem,env(safe-area-inset-bottom))] sm:px-3">
          <div className="flex min-h-0 flex-1 flex-col">
            <Board needed={needed} />
          </div>
          <StorageRow />
          <div className="min-h-16 shrink-0">
            <SelectedRow def={selDef} index={selected} />
          </div>
          <nav className="mt-1 flex gap-2 lg:hidden">
            <Button variant="ghost" className="relative flex-1" onClick={() => setSheet("cove")}>
              <House className="size-4" />
              Cove
              {canPayCove ? (
                <span className="absolute top-1 right-3 size-2 rounded-full bg-energy" />
              ) : null}
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => setSheet("shop")}>
              <Store className="size-4" />
              Stall
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => setSheet("journal")}>
              <BookOpen className="size-4" />
              Finds
            </Button>
          </nav>
        </div>
      </div>

      <aside className="hidden w-[300px] shrink-0 flex-col gap-4 overflow-auto border-l border-surface/10 bg-bg p-4 lg:flex">
        <ShopPanel />
        <JournalPanel />
      </aside>

      {sheet === "cove" ? (
        <TownWalk initialFocus={coveFocus} onClose={() => setSheet("none")} />
      ) : sheet !== "none" ? (
        <SheetFrame onClose={() => setSheet("none")}>
          {sheet === "journal" ? <JournalPanel /> : null}
          {sheet === "shop" ? <ShopPanel /> : null}
          {sheet === "inbox" ? <InboxPanel onClose={() => setSheet("none")} /> : null}
          {sheet === "settings" ? <SettingsPanel onClose={() => setSheet("none")} /> : null}
        </SheetFrame>
      ) : null}

      {!seenLoop ? <HowTo onDone={dismissHowTo} /> : null}
      <RestoreCeremony />
      {won ? <WinModal /> : null}

      {fx.map((f) => (
        <div
          key={f.id}
          className="fx-float pointer-events-none fixed z-40 font-display text-sm italic text-surface"
          style={{ left: f.x, top: f.y }}
        >
          {f.text === "merge" ? "Together" : f.text === "sold" ? "Sold" : f.text}
        </div>
      ))}
    </div>
  );
}

function ToastRail({
  toasts,
}: {
  toasts: Array<{ id: string; text: string; kind?: "ok" | "warn"; count?: number }>;
}) {
  if (!toasts.length) return null;
  return (
    <div className="toast-float" aria-live="polite">
      {toasts.slice(-1).map((t) => (
        <div
          key={t.id}
          data-toast
          className={cn(
            "line-clamp-2 rounded-lg px-3 py-1 text-center text-[11px] shadow-panel",
            t.kind === "warn" ? "bg-danger text-primary-fg" : "bg-bg text-ink ring-1 ring-ink/10",
          )}
        >
          {t.text}
          {(t.count ?? 1) > 1 ? " · ×" + t.count : ""}
        </div>
      ))}
    </div>
  );
}
function WorkChip({ canPay, onOpen }: { canPay: boolean; onOpen: () => void }) {
  const coveNode = useGame((s) => s.coveNode);
  const coveStep = useGame((s) => s.coveStep);
  const daily = useGame((s) => s.daily);
  const claimDaily = useGame((s) => s.claimDaily);
  const node = COVE_NODES[coveNode];
  const ready = dailyComplete(daily) && !daily.claimed;
  return (
    <div className="work-chip">
      <button type="button" onClick={onOpen} className="work-chip-main">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-energy">
          {node ? "Restore · " + (coveStep + 1) + "/" + node.steps.length : "Harbor Lights"}
        </p>
        <p className="truncate font-display text-sm italic leading-tight">{node?.name ?? "The cove is lit"}</p>
        <p className="truncate text-[10px] text-fog">
          Tide {Math.min(daily.orders, DAILY_NEED.orders)}/{DAILY_NEED.orders}
          {" · "}
          {Math.min(daily.merges, DAILY_NEED.merges)}/{DAILY_NEED.merges} merges
        </p>
      </button>
      {node ? (
        <Button size="sm" className="shrink-0" disabled={!canPay} onClick={onOpen}>
          {canPay ? "Pay" : "Work"}
        </Button>
      ) : null}
      {ready ? (
        <Button size="sm" variant="linen" className="shrink-0" onClick={() => claimDaily()}>
          Tide
        </Button>
      ) : null}
    </div>
  );
}

function OrderStrip({ awaitingGate }: { awaitingGate: boolean }) {
  const orders = useGame((s) => s.orders);
  const visitor = useGame((s) => s.visitor);
  const gameStage = useGame((s) => s.stage);
  const board = useGame((s) => s.board);
  const storage = useGame((s) => s.storage);
  const locked = useGame((s) => s.locked);
  const deliver = useGame((s) => s.deliver);
  const deliverVisitor = useGame((s) => s.deliverVisitor);
  const unlockStage = useGame((s) => s.unlockStage);
  if (awaitingGate) {
    return (
      <section className="order-dock">
        <div className="order-chip order-chip-wide">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-energy">
              Reach {gameStage + 1}/{STAGE_COUNT} · 10/10
            </p>
            <p className="truncate font-display text-sm italic leading-tight">The next reach is open.</p>
          </div>
          <Button size="sm" className="shrink-0" onClick={() => unlockStage()}>
            Continue
          </Button>
        </div>
      </section>
    );
  }
  return (
    <div className="order-dock">
      {visitor ? (
        <VisitorCard
          order={visitor}
          ready={canFillOrder(board, storage, visitor, locked)}
          onFill={() => deliverVisitor()}
        />
      ) : null}
      <div className="order-dock-row">
        {orders.map((order) => {
          const who = CHARACTERS[order.character];
          const ready = canFillOrder(board, storage, order, locked);
          const reward = order.rewardItem;
          return (
            <section key={order.id} className={cn("order-chip", ready && "is-ready")}>
              <img
                src={who.portrait}
                alt=""
                crossOrigin="anonymous"
                className="size-8 shrink-0 rounded-md bg-bg-deep object-cover object-top"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-energy">
                  {who.role}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  {order.requires.map((r) => {
                    const have =
                      board.filter((p, i) => p?.itemId === r.itemId && !locked.includes(i)).length +
                      storage.filter((p) => p?.itemId === r.itemId).length;
                    return (
                      <span
                        key={r.itemId}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full bg-bg-deep px-1.5 py-0.5 text-[10px] tabular-nums",
                          have >= r.count ? "text-energy" : "text-surface/80",
                        )}
                      >
                        <ItemArt itemId={r.itemId} className="size-3.5" />
                        {have}/{r.count}
                      </span>
                    );
                  })}
                  <span className="text-[10px] text-fog tabular-nums">+{order.pearls}</span>
                  {reward ? <ItemArt itemId={reward} className="size-3.5" /> : null}
                </div>
              </div>
              <Button
                size="sm"
                className="shrink-0"
                data-fill
                disabled={!ready}
                onClick={() => deliver(order.slot)}
              >
                {ready ? "Fill" : "…"}
              </Button>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function VisitorCard({
  order,
  ready,
  onFill,
}: {
  order: { title: string; pearls: number; requires: Array<{ itemId: string; count: number }>; rewardItem?: string };
  ready: boolean;
  onFill: () => void;
}) {
  const board = useGame((s) => s.board);
  const storage = useGame((s) => s.storage);
  const locked = useGame((s) => s.locked);
  return (
    <section className="order-chip order-chip-wide ring-1 ring-energy/50">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-energy">Visitor from the channel</p>
        <p className="truncate text-xs font-semibold">{order.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {order.requires.map((r) => {
            const have =
              board.filter((p, i) => p?.itemId === r.itemId && !locked.includes(i)).length +
              storage.filter((p) => p?.itemId === r.itemId).length;
            return (
              <span
                key={r.itemId}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full bg-bg-deep px-1.5 py-0.5 text-[10px] tabular-nums",
                  have >= r.count ? "text-energy" : "text-surface/80",
                )}
              >
                <ItemArt itemId={r.itemId} className="size-4" />
                {have}/{r.count}
              </span>
            );
          })}
          <span className="text-[10px] text-fog tabular-nums">+{order.pearls}</span>
        </div>
      </div>
      <Button size="sm" className="shrink-0" data-fill disabled={!ready} onClick={onFill}>
        {ready ? "Fill" : "…"}
      </Button>
    </section>
  );
}

function SelectedRow({
  def,
  index,
}: {
  def: ReturnType<typeof item>;
  index: number | null;
}) {
  const sellAt = useGame((s) => s.sellAt);
  const tapGenerator = useGame((s) => s.tapGenerator);
  const useConsumable = useGame((s) => s.useConsumable);
  const storeFromBoard = useGame((s) => s.storeFromBoard);
  const undo = useGame((s) => s.undo);
  const undoSell = useGame((s) => s.undoSell);
  const orders = useGame((s) => s.orders);
  const clocks = useGame((s) => s.clocks);
  const board = useGame((s) => s.board);
  const [confirmSell, setConfirmSell] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    setConfirmSell(false);
  }, [index]);
  const needed = neededFromOrders(orders);
  if (!def || index == null) {
    if (!undo) return null;
    return (
      <div className="flex justify-end px-1 py-0.5">
        <Button size="sm" variant="ghost" onClick={() => undoSell()}>
          <Undo2 className="size-3.5" />
          Undo
        </Button>
      </div>
    );
  }
  const onOrder = needed.has(def.id);
  const nextId = nextItemId(def.id);
  const pieceUid = board[index]?.uid;
  const clock = pieceUid ? clocks[pieceUid] : undefined;
  const waitSec =
    def.kind === "generator" && clock && clock.charges < 1
      ? Math.max(0, Math.ceil((clock.readyAt - now) / 1000))
      : 0;
  const riskySell = onOrder || def.tier >= 6;
  return (
    <div className="flex items-center gap-3 rounded-xl bg-bg px-3 py-2">
      <ItemArt key={def.id} itemId={def.id} className="size-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{def.name}</p>
        <p className="line-clamp-1 text-xs text-fog">
          {def.kind === "generator" && clock
            ? waitSec > 0
              ? "Resting · " + waitSec + "s"
              : clock.charges + " charges"
            : onOrder
            ? "Wanted on an order"
            : nextId
            ? "Merges into " + (item(nextId)?.name ?? "the next") + " · double-tap sells"
            : def.blurb + " · double-tap sells"}
        </p>
      </div>
      {def.kind === "generator" ? (
        <Button size="sm" onClick={() => tapGenerator(index)} disabled={Boolean(clock && clock.charges < 1)}>
          {waitSec > 0 ? waitSec + "s" : "Gather"}
        </Button>
      ) : def.kind === "consumable" ? (
        <Button size="sm" onClick={() => useConsumable(index)}>
          Open
        </Button>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={() => storeFromBoard(index)}>
            Park
          </Button>
          {confirmSell ? (
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                sellAt(index, { confirmed: true });
                setConfirmSell(false);
              }}
            >
              Sell anyway
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              data-sell
              onClick={() => {
                if (riskySell) setConfirmSell(true);
                else sellAt(index);
              }}
            >
              Sell {def.sell}
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function StorageRow() {
  const storage = useGame((s) => s.storage);
  const storeToBoard = useGame((s) => s.storeToBoard);
  const selected = useGame((s) => s.selected);
  const sellAt = useGame((s) => s.sellAt);
  return (
    <div className="store-row mt-1 flex items-center gap-1.5" data-store-row>
      <div className="flex min-w-0 flex-1 justify-center gap-1 sm:gap-1.5">
        {storage.map((p, i) => (
          <button
            key={i}
            type="button"
            data-store={i}
            onClick={() => p && storeToBoard(i)}
            className="store-slot grid size-9 shrink-0 place-items-center rounded-md bg-bg ring-1 ring-ink/10 sm:size-11"
            aria-label={p ? item(p.itemId)?.name ?? "Stored" : "Empty cupboard " + (i + 1)}
          >
            {p ? <ItemArt itemId={p.itemId} className="size-[85%]" /> : null}
          </button>
        ))}
        <button
          type="button"
          data-sell
          className="sell-well grid size-9 shrink-0 place-items-center rounded-md bg-bg ring-1 ring-dashed ring-pearl/50 sm:size-11"
          aria-label="Sell find"
          title="Drop here or double-tap a find to sell"
          onClick={() => {
            if (selected != null) sellAt(selected);
            else useGame.getState().pushToast("Double-tap a find to sell it");
          }}
        >
          <PearlMark className="size-3.5 text-pearl sm:size-4" />
        </button>
      </div>
    </div>
  );
}
function ShopPanel() {
  const pearls = useGame((s) => s.pearls);
  const cosmetics = useGame((s) => s.cosmetics);
  const luckyLeft = useGame((s) => s.luckyLeft);
  const board = useGame((s) => s.board);
  const unlocked = useGame((s) => s.unlocked);
  const buyLook = useGame((s) => s.buyLook);
  const buyBoost = useGame((s) => s.buyBoost);
  const buyCrate = useGame((s) => s.buyCrate);
  const missingCrates = CRATES.filter((c) => unlocked.includes(c.id) && !hasProducer(board, c.id));

  return (
    <div className="text-surface">
      <h2 className="font-display text-xl italic">Holt's Oddments</h2>
      <p className="mb-3 text-xs text-fog">The stall at the gangway. Pearls in, a kinder dock out.</p>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-energy">Dress the dock</p>
      <div className="flex flex-col gap-1.5">
        {LOOKS.map((look) => {
          const hung = cosmetics[look.id];
          const Icon = LOOK_ICONS[look.id];
          return (
            <button
              key={look.id}
              type="button"
              disabled={hung}
              onClick={() => buyLook(look.id)}
              className={cn(
                "flex min-h-14 items-start gap-3 rounded-lg bg-bg-deep px-3 py-2.5 text-left",
                hung && "opacity-55",
              )}
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-sand" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{look.name}</span>
                <span className="block text-xs text-fog">{look.blurb}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {hung ? "Hung" : look.cost}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-energy">
        A little luck{luckyLeft > 0 ? " · " + luckyLeft : ""}
      </p>
      <div className="flex flex-col gap-1.5">
        {BOOSTS.map((boost) => {
          const Icon = BOOST_ICONS[boost.id];
          const dear = pearls < boost.cost;
          return (
            <button
              key={boost.id}
              type="button"
              onClick={() => buyBoost(boost.id)}
              className="flex min-h-14 items-start gap-3 rounded-lg bg-bg-deep px-3 py-2.5 text-left"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-energy" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{boost.name}</span>
                <span className="block text-xs text-fog">{boost.blurb}</span>
              </span>
              <span
                className={cn(
                  "shrink-0 text-sm font-semibold tabular-nums",
                  dear && "text-fog",
                )}
              >
                {boost.cost}
              </span>
            </button>
          );
        })}
      </div>
      {missingCrates.length > 0 ? (
        <>
          <p className="mt-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-energy">
            Missing crates
          </p>
          <div className="flex flex-col gap-1.5">
            {missingCrates.map((crate) => {
              const dear = pearls < crate.cost;
              const Icon = crate.id === "bloom" ? Flower2 : Fish;
              return (
                <button
                  key={crate.id}
                  type="button"
                  onClick={() => buyCrate(crate.id)}
                  className="flex min-h-14 items-start gap-3 rounded-lg bg-bg-deep px-3 py-2.5 text-left"
                >
                  <Icon className="mt-0.5 size-5 shrink-0 text-sand" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{crate.name}</span>
                    <span className="block text-xs text-fog">{crate.blurb}</span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      dear && "text-fog",
                    )}
                  >
                    {crate.cost}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function JournalPanel() {
  const discovered = useGame((s) => s.discovered);
  const unlocked = useGame((s) => s.unlocked);
  const known = new Set(discovered);
  return (
    <div>
      <h2 className="font-display text-xl italic">Finds</h2>
      <p className="mb-3 text-xs text-fog">Merge matches to climb each line. New lines arrive in the mail when you restore a building.</p>
      {(Object.keys(CHAINS) as PlayChain[]).map((chain) => {
        const open = chainUnlocked(chain, unlocked);
        const hint = chainUnlockHint(chain);
        return (
        <div key={chain} className="mb-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-energy">
            {CHAIN_LABEL[chain]}
            {!open ? " · locked" : ""}
          </p>
          {!open && hint ? <p className="mb-1.5 text-[11px] text-fog">{hint}</p> : null}
          <div className="grid grid-cols-6 gap-1.5">
            {CHAINS[chain].map((id) => {
              const seen = open && known.has(id);
              const def = ITEMS[id];
              return (
                <div
                  key={id}
                  className={cn(
                    "aspect-square rounded-md bg-bg-deep p-1",
                    !seen && "opacity-35",
                  )}
                  title={!open ? hint ?? "Locked" : seen ? def?.name : "Undiscovered"}
                >
                  <ItemArt itemId={id} className={cn("h-full w-full", !seen && "grayscale")} />
                </div>
              );
            })}
          </div>
        </div>
        );
      })}
      {(Object.keys(TOOL_CHAINS) as Array<keyof typeof TOOL_CHAINS>).map((tool) => (
        <div key={tool} className="mb-3">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-energy">
            {TOOL_LABEL[tool]}
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {TOOL_CHAINS[tool].map((id) => {
              const seen = known.has(id);
              const def = ITEMS[id];
              return (
                <div
                  key={id}
                  className={cn("aspect-square rounded-md bg-bg-deep p-1", !seen && "opacity-35")}
                  title={seen ? def?.name : "Undiscovered"}
                >
                  <ItemArt itemId={id} className={cn("h-full w-full", !seen && "grayscale")} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function InboxPanel({ onClose }: { onClose: () => void }) {
  const inbox = useGame((s) => s.inbox);
  const letters = useGame((s) => s.letters);
  const pullInbox = useGame((s) => s.pullInbox);
  const readKeepMail = useGame((s) => s.readKeepMail);
  const visible = inbox.slice(0, 8);
  useEffect(() => {
    readKeepMail();
  }, [readKeepMail]);
  const mail = [...letters].reverse();
  return (
    <div className="text-surface">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-xl italic">Inbox</h2>
        <button type="button" className="grid size-11 place-items-center" onClick={onClose} aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      {mail.length ? (
        <div className="mb-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-energy">From the Keep</p>
          <ul className="flex flex-col gap-1.5">
            {mail.map((letter) => (
              <li key={letter.id} className="rounded-lg bg-bg-deep px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-display text-sm italic">{letter.title}</p>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-semibold uppercase tracking-wider",
                      letter.status === "fixed" ? "text-energy" : "text-danger",
                    )}
                  >
                    {letter.status === "fixed" ? "Fixed" : "Open"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-fog">{letter.body}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mb-3 text-xs text-fog">
        Finds wait here when the dock is full — and when a restored building mails a crate. Place the top one onto an empty plank.
      </p>
      {inbox.length === 0 ? (
        mail.length ? null : <p className="text-sm text-fog">Nothing waiting.</p>
      ) : (
        <>
          <ul className="flex flex-col gap-1.5">
            {visible.map((id, i) => (
              <li key={id + "-" + i} className="flex items-center gap-2 rounded-lg bg-bg-deep px-2 py-1.5">
                <ItemArt itemId={id} className="size-8" />
                <span className="min-w-0 flex-1 truncate text-sm">{item(id)?.name ?? id}</span>
                {i === 0 ? <span className="text-[10px] uppercase tracking-wide text-energy">Next</span> : null}
              </li>
            ))}
          </ul>
          {inbox.length > 8 ? (
            <p className="mt-2 text-xs text-fog">+{inbox.length - 8} more under the stack</p>
          ) : null}
          <Button className="mt-3 w-full" onClick={() => pullInbox()}>
            Place next
          </Button>
        </>
      )}
    </div>
  );
}

function SettingsPanel({ onClose }: { onClose: () => void }) {
  const sfxOn = useGame((s) => s.sfxOn);
  const toggleSfx = useGame((s) => s.toggleSfx);
  const newTide = useGame((s) => s.newTide);
  const keepLog = useGame((s) => s.keepLog);
  const keepRepairs = useGame((s) => s.keepRepairs);
  const scanKeep = useGame((s) => s.scanKeep);
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="flex flex-col gap-3 text-surface">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl italic">Settings</h2>
        <button type="button" className="grid size-11 place-items-center" onClick={onClose} aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      <button
        type="button"
        className="flex h-12 items-center justify-between rounded-lg bg-bg px-3"
        onClick={toggleSfx}
      >
        <span>Sound</span>
        {sfxOn ? <Volume2 className="size-5 text-energy" /> : <VolumeX className="size-5 text-fog" />}
      </button>
      <div className="rounded-lg bg-bg px-3 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-energy">
          The Keep · {keepRepairs} mends
        </p>
        <p className="mt-1 text-xs text-fog">
          Watches the dock for broken saves, missing crates, overflowing shelves, and finds with no picture. Fixes
          what it can. When it finds or mends a fault, it writes to the mailbox.
        </p>
        {keepLog.length ? (
          <ul className="mt-2 space-y-1 text-[11px] text-surface/80">
            {keepLog.slice(-8).reverse().map((n, i) => (
              <li key={n.topic + "-" + n.at + "-" + i} className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 shrink-0 text-[9px] font-semibold uppercase tracking-wider",
                    n.status === "fixed" ? "text-energy" : "text-danger",
                  )}
                >
                  {n.status === "fixed" ? "Fixed" : "Open"}
                </span>
                <span className="min-w-0">{n.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-fog">Quiet. The planks are honest.</p>
        )}
        <Button variant="ghost" className="mt-2 w-full" onClick={() => scanKeep()}>
          Scan the dock
        </Button>
      </div>
      {!confirm ? (
        <Button variant="danger" className="w-full" onClick={() => setConfirm(true)}>
          Reset the cove
        </Button>
      ) : (
        <Button
          variant="danger"
          className="w-full"
          onClick={() => {
            newTide();
            onClose();
          }}
        >
          Confirm new tide
        </Button>
      )}
    </div>
  );
}

function SheetFrame({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bg-deep/55 p-0 lg:items-center lg:p-6">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[88dvh] w-full max-w-lg overflow-auto rounded-t-xl bg-bg p-4 pr-12 shadow-panel lg:rounded-xl">
        <button
          type="button"
          className="absolute top-2 right-2 grid size-9 place-items-center rounded-md text-fog hover:bg-ink/8 hover:text-ink"
          aria-label="Close"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function HowTo({ onDone }: { onDone: () => void }) {
  const steps = [
    {
      icon: MousePointerClick,
      title: "Gather with energy",
      body: "Each tap on a crate costs one energy. Energy comes back every fifteen seconds, up to a hundred. Sparks of tide drop on the dock — merge them into flasks, tap a flask to drink. Merge of ordinary finds is free.",
    },
    {
      icon: Merge,
      title: "Fill the town's orders",
      body: "Four tickets at once, only from crates the cove has mailed. Tools come with the pay. Park extras in the cupboard.",
    },
    {
      icon: PackageCheck,
      title: "Spend on a place",
      body: "Hammer, paint, and lamp plus pearls buy the next building in the cove. Tap a house on the harbor to pay the work. Watch it come back. That place is the campaign.",
    },
    {
      icon: House,
      title: "The building mails a crate",
      body: "Finish a site and the next machine lands on the dock. That is the loop. Orders never stop. The cove is the gate.",
    },
  ];
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg-deep/90 p-4">
      <div className="stagger-in w-full max-w-sm rounded-xl bg-bg p-5 text-ink shadow-panel">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">How the tide works</p>
        <h2 className="mt-1 font-display text-2xl italic">The cove is the work</h2>
        <ul className="mt-4 space-y-3">
          {steps.map((s) => (
            <li key={s.title} className="flex gap-3">
              <s.icon className="mt-0.5 size-5 shrink-0 text-primary" />
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <Button className="mt-5 w-full" onClick={onDone}>
          I have it
        </Button>
      </div>
    </div>
  );
}

function WinModal() {
  const newTide = useGame((s) => s.newTide);
  const merges = useGame((s) => s.merges);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg-deep/90 p-4">
      <div className="stagger-in w-full max-w-sm overflow-hidden rounded-xl bg-bg text-ink shadow-panel">
        <img src={asset("/village/restored.jpg")} alt="" className="h-36 w-full object-cover" crossOrigin="anonymous" />
        <div className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Harbor Lights</p>
          <h2 className="font-display text-2xl italic">The cove kept the light</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Bunting on the pier, bread in the Gull, and Mae's inn taking names again. You merged {merges}{" "}
            finds along the way.
          </p>
          <Button className="mt-4 w-full" onClick={() => newTide()}>
            <Anchor className="size-4" />
            Another tide
          </Button>
        </div>
      </div>
    </div>
  );
  }
