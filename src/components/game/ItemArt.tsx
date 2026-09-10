import { useEffect, useState } from "react";
import { ITEMS, type ChainId } from "@/lib/game/catalog";
import { useGame } from "@/lib/game/store";
import { cn } from "@/lib/utils";

const INK: Record<ChainId, string> = {
  tide: "#2a6f7a",
  hearth: "#8a5a2b",
  craft: "#4a4338",
  net: "#1f6f8a",
  bloom: "#3d7a45",
  wreck: "#6a4a28",
  keep: "#b56a28",
  hammer: "#4a4338",
  paint: "#2f6f8a",
  lamp: "#c48a22",
  special: "#6a5a38",
};

function ObjectMark({ id, chain, ink }: { id: string; chain: ChainId; ink: string }) {
  if (chain === "keep") {
    return (
      <>
        <circle cx="16" cy="16" r="9" fill="#c47a38" stroke={ink} strokeWidth="1.2" />
        <circle cx="16" cy="16" r="6" fill="none" stroke="#f0d7a0" strokeWidth="1" />
        <path d="M10 16c2-3 10-3 12 0" fill="none" stroke="#f0d7a0" strokeWidth="1.2" />
      </>
    );
  }
  if (chain === "wreck") {
    return (
      <>
        <rect x="12" y="6" width="8" height="6" rx="1.5" fill="#c4a070" stroke={ink} strokeWidth="1.1" />
        <path d="M11 12h10v12c-1 2-9 2-10 0z" fill="#3d8a5a" stroke={ink} strokeWidth="1.1" />
      </>
    );
  }
  if (chain === "craft") {
    return (
      <>
        <ellipse cx="16" cy="18" rx="8" ry="5" fill="none" stroke={ink} strokeWidth="1.8" />
        <path d="M10 18c2-4 10-4 12 0" fill="none" stroke={ink} strokeWidth="1.4" />
        <path d="M8 14l3 4M24 14l-3 4" stroke={ink} strokeWidth="1.3" strokeLinecap="round" />
      </>
    );
  }
  if (chain === "tide") {
    return <path d="M7 20c3-8 15-8 18 0-4-3-14-3-18 0z" fill="#4eb3c4" stroke={ink} strokeWidth="1.1" />;
  }
  if (chain === "hearth") {
    return (
      <>
        <path d="M8 12h16l-1.5 12H9.5z" fill="#d8c08a" stroke={ink} strokeWidth="1.2" />
        <path d="M12 12c0-4 8-4 8 0" fill="none" stroke={ink} strokeWidth="1.2" />
      </>
    );
  }
  if (chain === "bloom") {
    return (
      <>
        <circle cx="16" cy="13" r="5" fill="#7cbc6a" stroke={ink} strokeWidth="1.1" />
        <path d="M16 18v7" stroke={ink} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M16 22c-3 0-4 2-4 2M16 22c3 0 4 2 4 2" fill="none" stroke="#3d7a45" strokeWidth="1.1" />
      </>
    );
  }
  if (chain === "net") {
    return (
      <>
        <ellipse cx="17" cy="16" rx="7" ry="5" fill="#3aa0c8" stroke={ink} strokeWidth="1.1" />
        <path d="M10 16l-4-3v6z" fill="#3aa0c8" stroke={ink} strokeWidth="0.8" />
        <circle cx="20" cy="14.5" r="0.9" fill={ink} />
      </>
    );
  }
  if (chain === "hammer") {
    return (
      <>
        <rect x="14" y="8" width="4" height="16" rx="1" fill="#c4a070" stroke={ink} strokeWidth="1" />
        <rect x="9" y="8" width="14" height="6" rx="1.2" fill="#8a8f96" stroke={ink} strokeWidth="1.1" />
      </>
    );
  }
  if (chain === "paint") {
    return (
      <>
        <path d="M14 6h4l1 12h-6z" fill="#4eb3c4" stroke={ink} strokeWidth="1.1" />
        <path d="M13 18h6l-1 8h-4z" fill="#c4a070" stroke={ink} strokeWidth="1.1" />
      </>
    );
  }
  if (chain === "lamp") {
    return (
      <>
        <path d="M12 14c0-6 8-6 8 0v4H12z" fill="#f0d7a0" stroke={ink} strokeWidth="1.1" />
        <rect x="14" y="18" width="4" height="7" fill="#8a5a2b" />
        <path d="M16 8l1.2 3h-2.4z" fill="#e8c24a" />
      </>
    );
  }
  if (id.startsWith("gen-") || id.startsWith("chest")) {
    return (
      <>
        <rect x="7" y="12" width="18" height="12" rx="2" fill="#c4a070" stroke={ink} strokeWidth="1.2" />
        <path d="M7 16h18" stroke={ink} strokeWidth="1.1" />
        <rect x="14" y="15" width="4" height="3" rx="0.6" fill="#8a5a2b" />
      </>
    );
  }
  return <circle cx="16" cy="16" r="7" fill="#d8c08a" stroke={ink} strokeWidth="1.4" />;
}

function Glyph({ itemId }: { itemId: string }) {
  const def = ITEMS[itemId];
  if (!def) return null;
  const ink = INK[def.chain];
  return (
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden>
      <ObjectMark id={itemId} chain={def.chain} ink={ink} />
    </svg>
  );
}

export function ItemArt({
  itemId,
  className,
  alt,
}: {
  itemId: string;
  className?: string;
  alt?: string;
}) {
  const def = ITEMS[itemId];
  const [ok, setOk] = useState(true);
  useEffect(() => {
    setOk(true);
  }, [itemId]);
  if (!def) return null;
  // Starred grades have no artwork of their own: they reuse the capstone's PNG,
  // tinted, with a pip per grade. Filters are inline so the whole feature stays
  // out of styles.css.
  const starFilter =
    def.star === 2
      ? "brightness(1.2) saturate(1.5) hue-rotate(-8deg)"
      : def.star === 1
        ? "brightness(1.12) saturate(1.25)"
        : undefined;
  return (
    <span className={cn("relative grid place-items-center overflow-hidden", className)}>
      {ok ? (
        <img
          src={def.src}
          alt={alt ?? ""}
          draggable={false}
          style={starFilter ? { filter: starFilter } : undefined}
          className="h-full w-full object-contain pointer-events-none select-none"
          onError={() => {
            setOk(false);
            useGame.getState().noteArtFault(itemId);
          }}
        />
      ) : (
        <Glyph itemId={itemId} />
      )}
      {def.star ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 text-[7px] leading-none tracking-tighter text-energy"
        >
          {def.star === 2 ? "\u2726\u2726" : "\u2726"}
        </span>
      ) : null}
    </span>
  );
}

export function PearlMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("size-4", className)} aria-hidden>
      <circle cx="10" cy="10" r="7.2" fill="currentColor" opacity="0.95" />
      <circle cx="8" cy="8" r="2.2" fill="var(--color-bg)" opacity="0.22" />
    </svg>
  );
}
