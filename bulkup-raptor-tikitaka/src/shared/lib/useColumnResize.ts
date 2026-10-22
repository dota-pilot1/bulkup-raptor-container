import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

/** 마우스로 탐색 컬럼의 너비를 조절한다. */
export function useColumnResize(
  width: number,
  onChange: (width: number) => void,
  { min = 220, max = 560 }: { min?: number; max?: number } = {},
) {
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(width);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!dragging.current) return;
      onChange(Math.min(max, Math.max(min, startWidth.current + event.clientX - startX.current)));
    };
    const up = () => {
      dragging.current = false;
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, [max, min, onChange]);

  return useCallback((event: ReactPointerEvent<HTMLElement>) => {
    dragging.current = true;
    startX.current = event.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  }, [width]);
}
