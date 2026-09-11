import { CoveIso } from "./CoveIso";
import { SEASON_DECALS, seasonFor } from "@/lib/game/loop";
import { useGame } from "@/lib/game/store";
import { asset } from "@/lib/utils";

type HarborProps = {
  coveNode: number;
  focus: number;
  onFocus: (i: number) => void;
  onOpen?: () => void;
};

export function Harbor({ coveNode, focus, onFocus, onOpen }: HarborProps) {
  // dailyDay is the store's existing daily rollover, so the costume follows the
  // date without a timer of its own.
  useGame((s) => s.dailyDay);
  const season = seasonFor();
  const decals = SEASON_DECALS[season];
  return (
    <div className="absolute inset-0" data-harbor-world>
      <CoveIso coveNode={coveNode} focus={focus} onFocus={onFocus} onOpen={onOpen} />
      {decals?.corners ? (
        <>
          <span
            aria-hidden
            className="season-corner season-corner-l"
            style={{ backgroundImage: `url(${asset(`/season/${season}-corner-l.png`)})` }}
          />
          <span
            aria-hidden
            className="season-corner season-corner-r"
            style={{ backgroundImage: `url(${asset(`/season/${season}-corner-r.png`)})` }}
          />
        </>
      ) : null}
      <button
        type="button"
        className="harbor-enter"
        onClick={onOpen}
        aria-label="Walk the cove"
      >
        Walk the cove
      </button>
    </div>
  );
}
