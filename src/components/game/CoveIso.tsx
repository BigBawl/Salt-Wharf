import { useEffect, useRef } from "react";
import { COVE_NODES, seasonLook } from "@/lib/game/loop";

type Props = {
  coveNode: number;
  focus: number;
  onFocus?: (i: number) => void;
  onOpen?: () => void;
  className?: string;
};

const TAU = Math.PI * 2;

type Site = {
  id: string;
  x: number;
  y: number;
  kind: "inn" | "cafe" | "garden" | "shed" | "pier" | "slip" | "lanterns" | "square";
};

const SITES: Site[] = [
  { id: "garden", x: 1.1, y: 0.4, kind: "garden" },
  { id: "shed", x: 6.6, y: 0.7, kind: "shed" },
  { id: "stoop", x: 2.15, y: 2.15, kind: "inn" },
  { id: "gull", x: 4.85, y: 2.05, kind: "cafe" },
  { id: "lights", x: 3.7, y: 3.45, kind: "square" },
  { id: "lanterns", x: 6.15, y: 3.7, kind: "lanterns" },
  { id: "pier", x: 4.9, y: 5.35, kind: "pier" },
  { id: "slip", x: 0.85, y: 4.7, kind: "slip" },
];

type Hit = { i: number; x: number; y: number; r: number };

export function CoveIso({ coveNode, focus, onFocus, onOpen, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const hits = useRef<Hit[]>([]);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let alive = true;

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const loop = (now: number) => {
      if (!alive) return;
      tRef.current = now / 1000;
      paint(ctx, canvas.width, canvas.height, coveNode, focus, tRef.current, hits.current);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [coveNode, focus]);

  return (
    <canvas
      ref={ref}
      className={className ?? "absolute inset-0 h-full w-full"}
      data-cove-iso
      onPointerUp={(e) => {
        const canvas = ref.current;
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        const dpr = canvas.width / Math.max(1, r.width);
        const px = x * dpr;
        const py = y * dpr;
        let best: Hit | null = null;
        let bestD = 1e9;
        for (const h of hits.current) {
          const d = Math.hypot(px - h.x, py - h.y);
          if (d < h.r && d < bestD) {
            best = h;
            bestD = d;
          }
        }
        if (best && onFocus) onFocus(best.i);
        onOpen?.();
      }}
    />
  );
}

function paint(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  coveNode: number,
  focus: number,
  t: number,
  hits: Hit[],
) {
  hits.length = 0;
  const look = seasonLook();
  ctx.clearRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, look.sky[0]);
  sky.addColorStop(0.42, look.sky[1]);
  sky.addColorStop(1, look.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const s = Math.min(w, h) * 0.092;
  const ox = w * 0.52;
  const oy = h * 0.22;
  const P = (x: number, y: number, z = 0) => ({
    x: ox + (x - y) * s,
    y: oy + (x + y) * s * 0.5 - z * s * 0.72,
  });

  water(ctx, P, s, t, w, h, look.water);
  land(ctx, P, s, look.grass);
  pierBoards(ctx, P, s, coveNode > 2);
  lighthouse(ctx, P, s, coveNode >= 7);

  const order = [...SITES].sort((a, b) => a.x + a.y - (b.x + b.y));
  for (const site of order) {
    const i = COVE_NODES.findIndex((n) => n.id === site.id);
    const restored = i >= 0 && i < coveNode;
    const current = i === coveNode || i === focus;
    drawSite(ctx, P, s, site, restored, current, t);
    const p = P(site.x + 0.7, site.y + 0.5, 1.4);
    hits.push({ i: Math.max(0, i), x: p.x, y: p.y, r: s * 1.35 });
    if (!restored && i > coveNode) clouds(ctx, p.x, p.y - s * 0.4, s, t + i);
    if (current) ring(ctx, p.x, p.y - s * 0.15, s * 0.95, t);
  }

  trees(ctx, P, s, coveNode, look.foliage);
  if (look.pumpkins) pumpkins(ctx, P, s);
  gulls(ctx, P, s, t);
}

function water(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  s: number,
  t: number,
  w: number,
  h: number,
  tones: readonly [string, string, string],
) {
  const a = P(-2, 4.2);
  const b = P(10, 4.2);
  const c = P(10, 9);
  const d = P(-2, 9);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, h + 20);
  ctx.lineTo(d.x, h + 20);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, a.y, 0, h);
  g.addColorStop(0, tones[0]);
  g.addColorStop(0.45, tones[1]);
  g.addColorStop(1, tones[2]);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#e8f6fa";
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 8; i++) {
    const y = a.y + 18 + i * s * 0.55 + Math.sin(t * 1.4 + i) * 3;
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 5, w - 20, y + 2);
    ctx.stroke();
  }
  ctx.restore();
}

function land(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  s: number,
  grass: string,
) {
  poly(
    ctx,
    [P(-1.4, -1.2), P(8.6, -1.2), P(8.6, 5.1), P(-1.4, 5.1)],
    grass,
  );
  poly(
    ctx,
    [P(-1.6, 3.4), P(8.8, 3.4), P(8.8, 5.4), P(-1.6, 5.4)],
    "#dcc07a",
  );
  poly(
    ctx,
    [P(2.2, 3.5), P(6.4, 3.5), P(6.6, 5.6), P(2.0, 5.6)],
    "#c9a56a",
  );
  box(ctx, P, 3.2, 3.7, 0, 1.4, 1.4, 0.06, "#b39262", "#9a7a4c", "#c4a878");
}

function pierBoards(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  s: number,
  restored: boolean,
) {
  const wood = restored ? "#c9955a" : "#7a6248";
  const top = restored ? "#e0b070" : "#8a6a48";
  for (let i = 0; i < 7; i++) {
    box(ctx, P, 4.55, 4.7 + i * 0.42, 0.08, 1.55, 0.38, 0.12, wood, "#5a3a22", top);
  }
  for (const x of [4.6, 5.9]) {
    box(ctx, P, x, 5.1, -0.55, 0.12, 0.12, 0.7, "#5a3a22", "#3a2414", "#6a4a28");
    box(ctx, P, x, 6.6, -0.55, 0.12, 0.12, 0.7, "#5a3a22", "#3a2414", "#6a4a28");
  }
  if (restored) {
    box(ctx, P, 6.3, 6.2, 0.2, 1.5, 0.45, 0.16, "#d8c4a0", "#8a6a48", "#efe0c0");
  }
}

function lighthouse(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  s: number,
  on: boolean,
) {
  box(ctx, P, 6.7, 6.9, 0, 0.7, 0.7, 2.4, on ? "#f4f1ea" : "#8a8680", "#6a6660", on ? "#fff" : "#a8a49c");
  box(ctx, P, 6.62, 6.82, 2.4, 0.86, 0.86, 0.35, "#2f8f80", "#1e6a60", "#3aa090");
  const cap = P(7.05, 7.25, 3.05);
  ctx.fillStyle = "#c45a3c";
  ctx.beginPath();
  ctx.moveTo(cap.x, cap.y - s * 0.45);
  ctx.lineTo(cap.x + s * 0.42, cap.y + s * 0.08);
  ctx.lineTo(cap.x - s * 0.42, cap.y + s * 0.08);
  ctx.closePath();
  ctx.fill();
  if (on) {
    ctx.fillStyle = "rgba(240,215,160,0.55)";
    ctx.beginPath();
    ctx.arc(cap.x, cap.y - s * 0.05, s * 0.22, 0, TAU);
    ctx.fill();
  }
}

function drawSite(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  s: number,
  site: Site,
  restored: boolean,
  current: boolean,
  t: number,
) {
  const { x, y, kind } = site;
  const teal = restored ? "#2f8f80" : "#6a736c";
  const cream = restored ? "#efe0c4" : "#b8aa90";
  const roof = restored ? "#c45a3c" : "#6a5348";
  const wood = restored ? "#c9955a" : "#5a3a22";
  if (kind === "inn") {
    box(ctx, P, x, y, 0, 1.7, 1.45, 1.55, teal, "#1e5a52", restored ? "#4aa898" : "#7a827c");
    roofPy(ctx, P, x, y, 1.55, 1.7, 1.45, 0.9, roof);
    box(ctx, P, x + 1.35, y + 0.2, 1.55, 0.22, 0.22, 0.45, "#9a5a42", "#6a3a28", "#b56a4a");
    box(ctx, P, x + 0.25, y + 1.45, 0, 1.2, 0.45, 0.08, wood, "#5a3a22", restored ? "#e0b070" : "#8a6a48");
    win(ctx, P, x + 0.25, y + 1.42, 0.7, restored);
    win(ctx, P, x + 0.95, y + 1.42, 0.7, restored);
    win(ctx, P, x + 0.25, y + 1.42, 1.15, restored);
  } else if (kind === "cafe") {
    box(ctx, P, x, y, 0, 1.5, 1.25, 1.15, cream, "#8a7a62", restored ? "#fff6e0" : "#c4b8a0");
    box(ctx, P, x - 0.05, y - 0.05, 1.15, 1.6, 1.35, 0.12, restored ? "#2f8f80" : "#5a3a22", "#1e5a52", restored ? "#3aa090" : "#6a4a28");
    box(ctx, P, x + 0.15, y + 1.2, 0.85, 1.2, 0.35, 0.06, restored ? "#1e9e90" : "#6a5348", "#146860", restored ? "#2fbeaa" : "#8a7460");
    win(ctx, P, x + 0.25, y + 1.2, 0.55, restored);
    win(ctx, P, x + 0.85, y + 1.2, 0.55, restored);
    table(ctx, P, x + 0.15, y + 1.55, restored, t);
    table(ctx, P, x + 0.95, y + 1.55, restored, t + 1);
  } else if (kind === "garden") {
    for (const [dx, dy] of [
      [0, 0.1],
      [0.95, 0.1],
      [0, 0.85],
      [0.95, 0.85],
    ] as const) {
      box(ctx, P, x + dx, y + dy, 0, 0.85, 0.65, 0.12, restored ? "#6a4a28" : "#3a3a38", "#2a2a28", restored ? "#8a5a32" : "#4a4a48");
      if (restored) {
        const p = P(x + dx + 0.4, y + dy + 0.3, 0.45);
        ctx.fillStyle = "#3d8a3a";
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 0.22, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#d45a6a";
        ctx.beginPath();
        ctx.arc(p.x, p.y - s * 0.08, s * 0.07, 0, TAU);
        ctx.fill();
      }
    }
    box(ctx, P, x + 0.35, y - 0.15, 0, 1.1, 0.7, restored ? 0.9 : 0.35, restored ? "#9fe4f0" : "#5a3a22", "#2a6a70", restored ? "#c8f0f6" : "#6a4a28");
  } else if (kind === "shed") {
    box(ctx, P, x, y, 0, 1.35, 1.1, 1.1, wood, "#3a2414", restored ? "#e0b070" : "#6a4a28");
    box(ctx, P, x - 0.08, y - 0.08, 1.1, 1.5, 1.25, 0.1, restored ? "#d4a060" : "#4a3a30", "#5a3a22", restored ? "#e8b878" : "#6a5a48");
  } else if (kind === "lanterns") {
    for (let i = 0; i < 3; i++) {
      box(ctx, P, x + i * 0.45, y, 0, 0.12, 0.12, 1.05, "#5a3a22", "#3a2414", "#6a4a28");
      const p = P(x + i * 0.45 + 0.06, y + 0.06, 1.2);
      ctx.fillStyle = restored ? "#f0d7a0" : "#6a6660";
      ctx.beginPath();
      ctx.arc(p.x, p.y, s * 0.12, 0, TAU);
      ctx.fill();
      if (restored) {
        ctx.fillStyle = "rgba(240,180,60,0.35)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, s * 0.22, 0, TAU);
        ctx.fill();
      }
    }
  } else if (kind === "square") {
    poly(
      ctx,
      [P(x, y), P(x + 1.6, y), P(x + 1.6, y + 1.6), P(x, y + 1.6)],
      restored ? "#b8b4ae" : "#7a6244",
    );
    box(ctx, P, x + 0.55, y + 0.55, 0, 0.5, 0.5, 0.35, "#8a8680", "#5c5854", "#c4c0ba");
    if (restored) {
      box(ctx, P, x + 0.1, y + 1.2, 0, 0.08, 0.08, 0.9, "#c9955a", "#5a3a22", "#e0b070");
      box(ctx, P, x + 1.35, y + 1.2, 0, 0.08, 0.08, 0.9, "#c9955a", "#5a3a22", "#e0b070");
    }
  } else if (kind === "pier") {
    box(ctx, P, x, y, 0.14, 1.15, 1.0, 0.95, wood, "#3a2414", restored ? "#e0b070" : "#6a4a28");
    roofPy(ctx, P, x, y, 1.09, 1.15, 1.0, 0.55, roof);
  } else if (kind === "slip") {
    for (let i = 0; i < 4; i++) {
      const p = P(x + (i % 2) * 0.7, y + Math.floor(i / 2) * 0.55, 0.25);
      ctx.fillStyle = "#7a746c";
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s * 0.28, s * 0.16, 0.3, 0, TAU);
      ctx.fill();
    }
    box(ctx, P, x + 0.15, y + 0.2, restored ? 0.28 : 0.1, 1.1, 0.4, 0.16, "#d8c4a0", "#8a6a48", "#efe0c0");
  }
}

function table(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  x: number,
  y: number,
  restored: boolean,
  t: number,
) {
  box(ctx, P, x, y, 0, 0.45, 0.45, 0.28, "#c9955a", "#5a3a22", "#e0b070");
  if (restored) {
    const p = P(x + 0.22, y + 0.22, 0.85 + Math.sin(t) * 0.02);
    ctx.fillStyle = "#1e9e90";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 18, 10, 0, 0, TAU);
    ctx.fill();
  }
}

function trees(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  s: number,
  coveNode: number,
  foliage: readonly [string, string],
) {
  const lush = coveNode > 2;
  const spots: Array<[number, number]> = [
    [0.2, 0.2],
    [0.8, -0.3],
    [7.4, 0.15],
    [7.9, 1.1],
    [1.6, -0.5],
    [5.5, -0.4],
  ];
  for (const [x, y] of spots) {
    box(ctx, P, x, y, 0, 0.16, 0.16, 0.55, "#5a3a22", "#3a2414", "#6a4a28");
    const p = P(x + 0.08, y + 0.08, 1.15);
    ctx.fillStyle = lush ? foliage[0] : "#6a7048";
    ctx.beginPath();
    ctx.arc(p.x, p.y, s * 0.42, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lush ? foliage[1] : "#7a8058";
    ctx.beginPath();
    ctx.arc(p.x - s * 0.12, p.y - s * 0.1, s * 0.28, 0, TAU);
    ctx.fill();
  }
}

function pumpkins(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  s: number,
) {
  const spots: Array<[number, number]> = [
    [5.4, 5.0],
    [3.4, 4.55],
    [0.6, 4.35],
  ];
  for (const [x, y] of spots) {
    const p = P(x, y, 0.22);
    ctx.fillStyle = "#d45a18";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, s * 0.18, s * 0.14, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#3d6a28";
    ctx.fillRect(p.x - 2, p.y - s * 0.18, 3, s * 0.1);
  }
}

function gulls(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  s: number,
  t: number,
) {
  ctx.strokeStyle = "#f4f1ea";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const a = t * 0.4 + i * 2.1;
    const p = P(3.5 + Math.cos(a) * 2.4, 2.2 + Math.sin(a) * 1.6, 2.8 + Math.sin(t * 1.5 + i) * 0.2);
    ctx.beginPath();
    ctx.moveTo(p.x - 7, p.y);
    ctx.quadraticCurveTo(p.x, p.y - 4, p.x + 7, p.y);
    ctx.stroke();
  }
}

function clouds(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number) {
  const bob = Math.sin(t * 1.3) * 3;
  ctx.fillStyle = "rgba(248,252,255,0.94)";
  const puffs = [
    [0, 0, 0.55],
    [-0.42, 0.08, 0.42],
    [0.4, 0.1, 0.4],
    [0.08, -0.22, 0.36],
  ];
  for (const [dx, dy, r] of puffs) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s + bob * 0.3, y + dy * s + bob, r * s, r * s * 0.62, 0, 0, TAU);
    ctx.fill();
  }
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  ctx.strokeStyle = `rgba(47,190,98,${0.55 + Math.sin(t * 3) * 0.25})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
}

function poly(ctx: CanvasRenderingContext2D, pts: Array<{ x: number; y: number }>, fill: string) {
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function box(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  left: string,
  right: string,
  top: string,
) {
  const A = P(x, y, z);
  const B = P(x + w, y, z);
  const C = P(x + w, y + d, z);
  const D = P(x, y + d, z);
  const A2 = P(x, y, z + h);
  const B2 = P(x + w, y, z + h);
  const C2 = P(x + w, y + d, z + h);
  const D2 = P(x, y + d, z + h);
  poly(ctx, [A, B, B2, A2], right);
  poly(ctx, [A, D, D2, A2], left);
  poly(ctx, [A2, B2, C2, D2], top);
}

function roofPy(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  color: string,
) {
  const peak = P(x + w / 2, y + d / 2, z + h);
  const A = P(x, y, z);
  const B = P(x + w, y, z);
  const C = P(x + w, y + d, z);
  const D = P(x, y + d, z);
  poly(ctx, [A, B, peak], shade(color, 1.08));
  poly(ctx, [B, C, peak], shade(color, 0.82));
  poly(ctx, [C, D, peak], shade(color, 0.7));
  poly(ctx, [D, A, peak], shade(color, 0.92));
}

function win(
  ctx: CanvasRenderingContext2D,
  P: (x: number, y: number, z?: number) => { x: number; y: number },
  x: number,
  y: number,
  z: number,
  on: boolean,
) {
  box(ctx, P, x, y, z, 0.28, 0.06, 0.32, "#3a322c", "#2a2620", on ? "#9fe4f0" : "#4a4338");
}

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
}
