import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  COLS,
  DRAG_THRESHOLD,
  ITEMS,
  ROWS,
  canMerge,
  dockSkinFor,
  item,
  type Piece,
} from "@/lib/game/catalog";
import { useGame } from "@/lib/game/store";
import { BUBBLE_TAKE_COST, BUBBLE_WAIT_MS } from "@/lib/game/loop";
import { cn } from "@/lib/utils";
import { ItemArt } from "./ItemArt";

type DragState = {
  from: number;
  piece: Piece;
  x: number;
  y: number;
  ox: number;
  oy: number;
  active: boolean;
  over: number | null;
  sell: boolean;
  store: number | null;
};

function cellFromPoint(x: number, y: number): { index: number | null; sell: boolean; store: number | null } {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest?.("[data-cell]") as HTMLElement | null;
  if (cell?.dataset.cell != null) {
    return { index: Number(cell.dataset.cell), sell: false, store: null };
  }
  const store = el?.closest?.("[data-store]") as HTMLElement | null;
  if (store?.dataset.store != null) {
    return { index: null, sell: false, store: Number(store.dataset.store) };
  }
  const sell = el?.closest?.("[data-sell]");
  return { index: null, sell: Boolean(sell), store: null };
}

export function Board({ needed }: { needed: Set<string> }) {
  const board = useGame((s) => s.board);
  const selected = useGame((s) => s.selected);
  const popUid = useGame((s) => s.popUid);
  const lastMerge = useGame((s) => s.lastMerge);
  const bubbles = useGame((s) => s.bubbles);
  const takeBubble = useGame((s) => s.takeBubble);
  const cosmetics = useGame((s) => s.cosmetics);
  const luckyLeft = useGame((s) => s.luckyLeft);
  const gameStage = useGame((s) => s.stage);
  const armedSplit = useGame((s) => s.armedSplit);
  const spawnFx = useGame((s) => s.spawnFx);
  const locked = useGame((s) => s.locked);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [shake, setShake] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;
  const lastTapRef = useRef({ index: -1, at: 0 });
  const feedChains = new Set<string>();
  for (const id of needed) {
    const chain = ITEMS[id]?.chain;
    if (chain && chain !== "special") feedChains.add(chain);
  }
  const lockedSet = new Set(locked);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("dragging-piece", Boolean(drag?.active));
    document.body.classList.toggle("dragging-store", Boolean(drag?.active && drag.store != null));
    return () => {
      document.body.classList.remove("dragging-piece");
      document.body.classList.remove("dragging-store");
    };
  }, [drag?.active, drag?.store]);

  const endDrag = useCallback(
    (d: DragState) => {
      const api = useGame.getState();
      document.body.classList.remove("dragging-piece");
      document.body.classList.remove("dragging-store");
      if (!d.active) {
        if (api.armedSplit) {
          api.splitAt(d.from);
          setDrag(null);
          return;
        }
        const p = api.board[d.from];
        const def = p ? item(p.itemId) : undefined;
        if (def?.kind === "generator") {
          api.tapGenerator(d.from);
        } else if (def?.kind === "consumable") {
          api.useConsumable(d.from);
        } else if (def) {
          const now = performance.now();
          const twice = lastTapRef.current.index === d.from && now - lastTapRef.current.at < 340;
          lastTapRef.current = { index: d.from, at: now };
          if (twice) {
            lastTapRef.current = { index: -1, at: 0 };
            const onOrder = needed.has(def.id);
            if (onOrder || def.tier >= 6) {
              api.select(d.from);
              api.pushToast(
                onOrder ? "Wanted on an order — use Sell to confirm" : "High find — use Sell to confirm",
                "warn",
              );
            } else {
              const ok = api.sellAt(d.from);
              if (ok) spawnFx({ x: d.x, y: d.y, text: "sold" });
            }
          } else {
            api.select(d.from);
          }
        }
        setDrag(null);
        return;
      }
      if (d.sell) {
        const ok = api.sellAt(d.from);
        if (!ok) {
          setShake(true);
          window.setTimeout(() => setShake(false), 280);
        } else {
          spawnFx({ x: d.x, y: d.y, text: "sold" });
        }
        setDrag(null);
        return;
      }
      if (d.store != null) {
        api.storeFromBoard(d.from);
        setDrag(null);
        return;
      }
      if (d.over == null || d.over === d.from) {
        setDrag(null);
        return;
      }
      const target = api.board[d.over];
      if (!target) {
        api.movePiece(d.from, d.over);
        setDrag(null);
        return;
      }
      if (canMerge(d.piece.itemId, target.itemId)) {
        const ok = api.mergePieces(d.from, d.over);
        if (ok) {
          const m = useGame.getState().lastMerge;
          spawnFx({
            x: d.x,
            y: d.y,
            text: m?.capstone ? "A prize" : "Together",
          });
        }
        setDrag(null);
        return;
      }
      setShake(true);
      window.setTimeout(() => setShake(false), 280);
      setDrag(null);
    },
    [spawnFx, needed],
  );

  const onPointerDown = (index: number, e: PointerEvent<HTMLDivElement>) => {
    const p = useGame.getState().board[index];
    if (!p) {
      if (useGame.getState().armedSplit) useGame.getState().disarmSplit();
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      from: index,
      piece: p,
      x: e.clientX,
      y: e.clientY,
      ox: e.clientX,
      oy: e.clientY,
      active: false,
      over: index,
      sell: false,
      store: null,
    });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dist = Math.hypot(e.clientX - d.ox, e.clientY - d.oy);
    const active = d.active || dist >= DRAG_THRESHOLD;
    const hit = cellFromPoint(e.clientX, e.clientY);
    setDrag({
      ...d,
      x: e.clientX,
      y: e.clientY,
      active,
      over: hit.index,
      sell: hit.sell,
      store: hit.store,
    });
  };

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    endDrag({
      ...d,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const dock = dockSkinFor(gameStage);

  return (
    <div className="board-stage relative mx-auto flex h-full min-h-0 w-full max-w-[520px] flex-col">
      {luckyLeft > 0 ? (
        <div className="mb-1 inline-flex rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-fg">
          Lucky · {luckyLeft}
        </div>
      ) : null}
      {armedSplit ? (
        <div className="mb-1 inline-flex rounded-full bg-sand px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink">
          Shears armed · tap a find
        </div>
      ) : null}
      <div
        className={cn(
          "board-frame flex min-h-0 flex-1 flex-col",
          cosmetics.painted && "look-painted",
          cosmetics.lanterns && "look-lanterns",
          cosmetics.lights && "look-lights",
          `dock-${dock.id}`,
          lastMerge && "board-thump",
        )}
        style={{ touchAction: "none" }}
      >
        {cosmetics.lanterns ? (
          <>
            <span className="dock-lantern dock-lantern-tl" />
            <span className="dock-lantern dock-lantern-tr" />
            <span className="dock-lantern dock-lantern-bl" />
            <span className="dock-lantern dock-lantern-br" />
          </>
        ) : null}
        {cosmetics.lights || dock.id === "fest" ? (
          <div className="board-bunting" aria-hidden>
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="board-bulb" />
            ))}
          </div>
        ) : null}
        <div
          className="board-grid"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${ROWS}, minmax(0, 1fr))`,
          }}
        >
          {board.map((p, index) => {
            const def = p ? ITEMS[p.itemId] : undefined;
            const isDragFrom = drag?.from === index && drag.active;
            const isOver = drag?.active && drag.over === index && drag.from !== index;
            const mergeOk = Boolean(
              isOver && drag && p && canMerge(drag.piece.itemId, p.itemId),
            );
            const neededHere = Boolean(p && needed.has(p.itemId));
            const isSel = selected === index && !drag?.active;
            const feeds =
              def?.kind === "generator" && def.produces ? feedChains.has(def.produces) : false;
            const tarp = lockedSet.has(index);
            return (
              <div
                key={index}
                data-cell={index}
                onPointerDown={(e) => onPointerDown(index, e)}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className={cn(
                  "board-cell relative min-h-0 select-none",
                  !p && "is-empty",
                  tarp && "is-locked",
                  isOver && mergeOk && "ring-2 ring-primary",
                  isOver && !mergeOk && p && "ring-2 ring-danger/80",
                  isOver && !p && "ring-2 ring-surface/70",
                  isSel && "ring-2 ring-surface/80",
                  feeds && "feeds-crate",
                )}
                role="button"
                tabIndex={0}
                aria-label={
                  def
                    ? `${def.name}${tarp ? ", under tarp" : ""}${def.kind === "generator" ? ", tap to gather" : ""}`
                    : tarp
                      ? `Tarped plank ${index + 1}`
                      : `Empty space ${index + 1}`
                }
              >
                {tarp && !p ? (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center text-[8px] font-bold uppercase tracking-wider text-primary/70">
                    Tarp
                  </span>
                ) : null}
                {tarp && p ? (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-primary/25 text-center text-[7px] font-bold uppercase tracking-wider text-primary">
                    Tarp
                  </span>
                ) : null}
                {p && !isDragFrom ? (
                  <div
                    className={cn(
                      "absolute inset-[11%] grid place-items-center",
                      popUid === p.uid && "item-pop",
                    )}
                  >
                    <ItemArt key={p.itemId} itemId={p.itemId} className="h-full w-full" alt={def?.name} />
                    {neededHere ? (
                      <span className="need-pip pointer-events-none absolute top-0.5 right-0.5 size-2 rounded-full bg-primary" />
                    ) : null}
                  </div>
                ) : null}
                {lastMerge?.index === index ? (
                  <MergeBurst
                    chain={lastMerge.chain}
                    tier={lastMerge.tier}
                    capstone={lastMerge.capstone}
                  />
                ) : null}
                {bubbles
                  .filter((b) => b.cell === index)
                  .map((b) => {
                    const left = Math.max(0, Math.ceil((BUBBLE_WAIT_MS - (now - b.bornAt)) / 1000));
                    return (
                      <button
                        key={b.id}
                        type="button"
                        className="bubble-chip absolute -top-1.5 -right-1.5 z-10 flex size-8 flex-col items-center justify-center rounded-full bg-pearl text-ink shadow-panel"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          takeBubble(b.id);
                        }}
                        aria-label={`Take duplicate for ${BUBBLE_TAKE_COST} pearls, or wait ${left}s`}
                      >
                        <ItemArt itemId={b.itemId} className="size-4" />
                        <span className="text-[8px] font-bold tabular-nums leading-none">{left}s</span>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      {drag?.active ? (
        <div
          className={cn(
            "pointer-events-none fixed z-40 size-16 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg sm:size-20",
            shake && "shake-x",
          )}
          style={{ left: drag.x, top: drag.y }}
        >
          <ItemArt itemId={drag.piece.itemId} className="h-full w-full" />
        </div>
      ) : null}
    </div>
  );
}

function MergeBurst({
  chain,
  tier,
  capstone,
}: {
  chain: string;
  tier: number;
  capstone: boolean;
}) {
  const n = capstone ? 12 : tier >= 5 ? 10 : 8;
  return (
    <div
      className={cn("merge-burst pointer-events-none", capstone && "is-capstone")}
      data-chain={chain}
      aria-hidden
    >
      <span className="merge-flash" />
      <span className="merge-ring" />
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className="merge-mote"
          style={{ "--a": `${(360 / n) * i}deg` } as CSSProperties}
        />
      ))}
    </div>
  );
}
