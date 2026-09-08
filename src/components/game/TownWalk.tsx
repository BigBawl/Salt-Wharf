import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { X } from "lucide-react";
import { COVE_NODES, canPayStep, siteArt } from "@/lib/game/loop";
import { useGame } from "@/lib/game/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CoveIso } from "./CoveIso";
import { ItemArt, PearlMark } from "./ItemArt";

type CanvasProps = {
  coveNode: number;
  focus: number;
  onFocus: (i: number) => void;
  explore?: boolean;
};

export function TownWalk({
  initialFocus,
  onClose,
}: {
  initialFocus?: number;
  onClose: () => void;
}) {
  const coveNode = useGame((s) => s.coveNode);
  const [focus, setFocus] = useState(initialFocus ?? coveNode);
  const [webgl, setWebgl] = useState(true);
  const [Canvas, setCanvas] = useState<ComponentType<CanvasProps> | null>(null);
  const [stick, setStick] = useState({ x: 0, y: 0 });
  const stickRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    setFocus(initialFocus ?? coveNode);
  }, [initialFocus, coveNode]);

  useEffect(() => {
    let alive = true;
    const ok = (() => {
      try {
        const c = document.createElement("canvas");
        return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
      } catch {
        return false;
      }
    })();
    if (!ok) {
      setWebgl(false);
      return;
    }
    import("./HarborCanvas")
      .then((m) => {
        if (alive) setCanvas(() => m.default);
      })
      .catch(() => {
        if (alive) setWebgl(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onLost = () => setWebgl(false);
    window.addEventListener("webglcontextlost", onLost, true);
    return () => window.removeEventListener("webglcontextlost", onLost, true);
  }, []);

  useEffect(() => {
    (window as unknown as { __saltwharfStick: { x: number; y: number } }).__saltwharfStick = stickRef.current;
    return () => {
      delete (window as unknown as { __saltwharfStick?: unknown }).__saltwharfStick;
    };
  }, []);

  const use3d = webgl && Canvas;

  return (
    <div className="town-walk" data-town-walk>
      {use3d ? (
        <Canvas coveNode={coveNode} focus={focus} onFocus={setFocus} explore />
      ) : (
        <CoveIso
          coveNode={coveNode}
          focus={focus}
          onFocus={setFocus}
          className="absolute inset-0 h-full w-full"
        />
      )}
      <button
        type="button"
        className="town-walk-close"
        onClick={onClose}
        aria-label="Leave the cove"
      >
        <X className="size-5" />
      </button>
      <p className="town-walk-hint">
        {use3d ? "Drag to look · WASD or stick to walk · tap a building to restore" : "Tap a building to restore"}
      </p>
      {use3d ? (
        <Joystick
          value={stick}
          onChange={(v) => {
            stickRef.current.x = v.x;
            stickRef.current.y = v.y;
            setStick(v);
          }}
        />
      ) : null}
      <BuildCard focus={focus} onFocus={setFocus} />
    </div>
  );
}

function Joystick({
  value,
  onChange,
}: {
  value: { x: number; y: number };
  onChange: (v: { x: number; y: number }) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const setFrom = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = root.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let x = (e.clientX - cx) / (r.width * 0.42);
    let y = (e.clientY - cy) / (r.height * 0.42);
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    onChange({ x, y });
  };
  return (
    <div
      ref={root}
      className="town-stick"
      onPointerDown={(e) => {
        active.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setFrom(e);
      }}
      onPointerMove={(e) => {
        if (active.current) setFrom(e);
      }}
      onPointerUp={() => {
        active.current = false;
        onChange({ x: 0, y: 0 });
      }}
      onPointerCancel={() => {
        active.current = false;
        onChange({ x: 0, y: 0 });
      }}
      aria-label="Walk"
    >
      <span
        className="town-stick-knob"
        style={{
          transform: `translate(${value.x * 22}px, ${value.y * 22}px)`,
        }}
      />
    </div>
  );
}

function BuildCard({ focus, onFocus }: { focus: number; onFocus: (i: number) => void }) {
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
    lookingCurrent && current ? ((coveStep + (ready ? 0 : 0)) / current.steps.length) * 100 : restored ? 100 : 0;
  if (!site) {
    return (
      <section className="build-card">
        <p className="font-display text-lg italic">Harbor Lights is lit.</p>
      </section>
    );
  }
  return (
    <section className="build-card">
      <div className="flex gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-md bg-bg-deep">
          <img src={siteArt(site.id, restored)} alt="" className="h-full w-full object-cover" crossOrigin="anonymous" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-energy">
            {restored ? "Restored" : lookingCurrent ? `Build · \( {coveStep + 1}/ \){current?.steps.length ?? 1}` : "Later"}
          </p>
          <h3 className="font-display text-lg italic leading-tight">{site.name}</h3>
          <p className="line-clamp-2 text-xs text-surface/80">{restored ? site.story : site.line}</p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-deep">
        <div className="h-full rounded-full bg-energy transition-[width] duration-500" style={{ width: `${progress}%` }} />
      </div>
      {lookingCurrent && step && current ? (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-deep px-2 py-0.5 text-[11px] tabular-nums">
              <PearlMark className="text-pearl" />
              {pearls}/{step.pearls}
            </span>
            {step.hammer ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-bg-deep px-2 py-0.5 text-[11px]">
                <ItemArt itemId="hammer-1" className="size-3.5" />
                Hammer {step.hammer}+
              </span>
            ) : null}
            {step.paint ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-bg-deep px-2 py-0.5 text-[11px]">
                <ItemArt itemId="paint-1" className="size-3.5" />
                Paint {step.paint}+
              </span>
            ) : null}
            {step.lamp ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-bg-deep px-2 py-0.5 text-[11px]">
                <ItemArt itemId="lamp-1" className="size-3.5" />
                Lamp {step.lamp}+
              </span>
            ) : null}
          </div>
          <Button className="mt-2 w-full" disabled={!ready} onClick={() => payCove()}>
            {ready ? "Build" : "Need more on the dock"}
          </Button>
        </>
      ) : restored ? (
        <p className="mt-2 text-xs text-energy">The crate already went to the mailbox.</p>
      ) : (
        <p className="mt-2 text-xs text-fog">Restore {current?.name ?? "the last site"} first.</p>
      )}
      <div className="mt-2 flex gap-1 overflow-x-auto">
        {COVE_NODES.map((n, i) => (
          <button
            key={n.id}
            type="button"
            onClick={() => onFocus(i)}
            className={cn(
              "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide",
              i === focus ? "bg-primary text-primary-fg" : i < coveNode ? "bg-energy/20 text-energy" : "bg-bg-deep text-fog",
            )}
          >
            {n.name.replace(/^The /, "")}
          </button>
        ))}
      </div>
    </section>
  );
}
