import { useEffect, useState } from "react";
import { Package } from "lucide-react";
import {
  DELIVERIES_PER_STAGE,
  STAGE_COUNT,
  dockSkinFor,
  item,
  stageLine,
  stageName,
} from "@/lib/game/catalog";
import { COVE_NODES, canPayStep, siteArt } from "@/lib/game/loop";
import { useGame } from "@/lib/game/store";
import { Button } from "@/components/ui/button";
import { asset, cn } from "@/lib/utils";
import { ItemArt } from "./ItemArt";

export function TownColumn({ className, initialFocus }: { className?: string; initialFocus?: number }) {
  const coveNode = useGame((s) => s.coveNode);
  const gameStage = useGame((s) => s.stage);
  const taskIndex = useGame((s) => s.taskIndex);
  const [focus, setFocus] = useState(initialFocus ?? coveNode);
  useEffect(() => {
    setFocus(initialFocus ?? coveNode);
  }, [coveNode, initialFocus]);
  const doneAll = coveNode >= COVE_NODES.length;
  const slot = Math.min(DELIVERIES_PER_STAGE, taskIndex - gameStage * DELIVERIES_PER_STAGE);
  const dock = dockSkinFor(gameStage);
  const lit = Math.min(1, coveNode / Math.max(1, COVE_NODES.length));
  return (
    <section className={cn("relative flex min-h-0 flex-col overflow-hidden bg-bg", className)}>
      <div className="cove-map-wrap">
        <img
          src={asset("/village/cove-map.jpg")}
          alt="Saltwharf cove in daylight"
          className="town-layer"
          crossOrigin="anonymous"
        />
        <img
          src={asset("/village/cove-map-lit.jpg")}
          alt=""
          className="town-layer town-lit"
          crossOrigin="anonymous"
          style={{ opacity: lit }}
        />
        {COVE_NODES.map((n, i) => {
          const restored = i < coveNode;
          const current = i === coveNode;
          return (
            <button
              key={n.id}
              type="button"
              className={cn(
                "town-pin",
                restored && "is-done",
                current && "is-now",
                i > coveNode && "is-later",
                focus === i && "is-focus",
              )}
              style={{ left: `\( {n.x}%`, top: ` \){n.y}%` }}
              onClick={() => setFocus(i)}
              aria-label={n.name}
            >
              <img src={siteArt(n.id, restored)} alt="" crossOrigin="anonymous" />
            </button>
          );
        })}
      </div>
      <div className="cove-map-caption">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-energy">
          The cove · {Math.min(coveNode, COVE_NODES.length)}/{COVE_NODES.length} · reach {gameStage + 1}/
          {STAGE_COUNT} · {slot}/{DELIVERIES_PER_STAGE}
        </p>
        <h2 className="font-display text-xl italic leading-tight">{stageName(gameStage)}</h2>
        <p className="text-xs text-surface/80">{stageLine(gameStage)}</p>
        <p className="mt-0.5 text-[11px] text-fog">{dock.name}</p>
      </div>
      <SiteWork focus={focus} onFocus={setFocus} doneAll={doneAll} />
    </section>
  );
}

function SiteWork({
  focus,
  onFocus,
  doneAll,
}: {
  focus: number;
  onFocus: (i: number) => void;
  doneAll: boolean;
}) {
  const pearls = useGame((s) => s.pearls);
  const board = useGame((s) => s.board);
  const storage = useGame((s) => s.storage);
  const coveNode = useGame((s) => s.coveNode);
  const coveStep = useGame((s) => s.coveStep);
  const payCove = useGame((s) => s.payCove);
  const locked = useGame((s) => s.locked);
  const site = COVE_NODES[focus] ?? COVE_NODES[coveNode];
  const current = COVE_NODES[coveNode];
  const step = current?.steps[coveStep];
  const ready = Boolean(current && step && canPayStep(board, storage, pearls, step, locked));
  const lookingCurrent = focus === coveNode;
  const restored = Boolean(site && focus < coveNode);
  const progress =
    lookingCurrent && current ? (coveStep / current.steps.length) * 100 : restored ? 100 : 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
      {site ? (
        <>
          <div className="site-shot">
            <img
              src={siteArt(site.id, restored)}
              alt=""
              crossOrigin="anonymous"
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-bg-deep/70">
              <div className="h-full bg-energy transition-[width] duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-energy">
            {restored ? "Restored" : lookingCurrent ? "The work" : "Later"}
          </p>
          <h3 className="font-display text-lg italic leading-tight">{site.name}</h3>
          <p className="text-xs leading-relaxed text-surface/80">{restored ? site.story : site.line}</p>
          {restored ? (
            <p className="mt-2 text-xs text-energy">The mail already went. The crate is on the dock.</p>
          ) : lookingCurrent && step && current ? (
            <>
              <p className="mt-2 text-xs text-fog">
                Step {coveStep + 1}/{current.steps.length} · {step.pearls} pearls
                {step.hammer ? ` · hammer ${step.hammer}+` : ""}
                {step.paint ? ` · paint ${step.paint}+` : ""}
                {step.lamp ? ` · lamp ${step.lamp}+` : ""}
              </p>
              <p className="mt-1 text-xs text-surface/80">
                Finish this place and the cove mails {site.mail.map((id) => item(id)?.name ?? id).join(" · ")}.
              </p>
              <Button className="mt-2 w-full" disabled={!ready} onClick={() => payCove()}>
                {ready ? "Pay the work" : "Need tools"}
              </Button>
            </>
          ) : (
            <p className="mt-2 text-xs text-fog">
              Restore {current?.name ?? "the last site"} first. One place at a time.
            </p>
          )}
        </>
      ) : (
        <p className="font-display text-lg italic">Harbor Lights is lit.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-1">
        {COVE_NODES.map((n, i) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onFocus(i)}
            className={cn(
              "rounded-full px-2 py-1 text-[10px] font-semibold",
              i === focus ? "bg-primary text-primary-fg" : "bg-bg-deep text-fog",
              i < coveNode && i !== focus && "text-energy",
            )}
          >
            {n.name}
          </button>
        ))}
      </div>
      {doneAll ? <p className="mt-2 text-xs text-energy">The square remembers how to shine.</p> : null}
    </div>
  );
}

export function RestoreCeremony() {
  const last = useGame((s) => s.lastRestore);
  const dismiss = useGame((s) => s.dismissRestore);
  if (!last) return null;
  const node = COVE_NODES.find((n) => n.id === last.id);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-bg-deep/90 p-4">
      <div className="stagger-in w-full max-w-md overflow-hidden rounded-xl bg-bg text-ink shadow-panel">
        <div className="relative h-44">
          <img
            src={siteArt(last.id, true)}
            alt=""
            className="h-full w-full object-cover"
            crossOrigin="anonymous"
          />
        </div>
        <div className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">The cove mails a crate</p>
          <h2 className="font-display text-2xl italic leading-tight">{last.name}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{node?.story ?? last.story}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {last.mail.map((id) => (
              <span key={id} className="inline-flex items-center gap-2 rounded-lg bg-bg-deep/10 px-2 py-1 text-sm">
                <ItemArt itemId={id} className="size-8" />
                {item(id)?.name ?? id}
              </span>
            ))}
          </div>
          <Button className="mt-4 w-full" onClick={() => dismiss()}>
            <Package className="size-4" />
            To the dock
          </Button>
        </div>
      </div>
    </div>
  );
}
