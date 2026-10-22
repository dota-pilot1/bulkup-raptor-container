import type { PointerEvent } from "react";

function ColumnResizeHandle({ onPointerDown }: { onPointerDown: (event: PointerEvent<HTMLElement>) => void }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="컬럼 너비 조절"
      title="드래그하여 너비 조절"
      onPointerDown={onPointerDown}
      className="group relative z-30 block h-full w-4 shrink-0 cursor-col-resize touch-none select-none"
    >
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-slate-300 transition-colors group-hover:bg-brand-primary" />
    </div>
  );
}

export default ColumnResizeHandle;
