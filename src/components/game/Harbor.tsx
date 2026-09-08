import { CoveIso } from "./CoveIso";

type HarborProps = {
  coveNode: number;
  focus: number;
  onFocus: (i: number) => void;
  onOpen?: () => void;
};

export function Harbor({ coveNode, focus, onFocus, onOpen }: HarborProps) {
  return (
    <div className="absolute inset-0" data-harbor-world>
      <CoveIso coveNode={coveNode} focus={focus} onFocus={onFocus} onOpen={onOpen} />
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
