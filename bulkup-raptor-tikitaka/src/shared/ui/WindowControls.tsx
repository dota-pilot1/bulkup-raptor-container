import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";

// 참조앱과 동일하게, 네이티브 신호등 대신 공용 헤더에서 창 조작을 제공한다.
const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const windowControlClass =
  "flex size-8 items-center justify-center rounded-md border border-transparent text-text-muted transition-colors hover:border-surface-border-soft hover:bg-surface-muted hover:text-text-primary";

function WindowControls() {
  const win = isTauri;
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!win) return;
    let disposed = false;
    void invoke<boolean>("window_is_maximized")
      .then((value) => { if (!disposed) setMaximized(value); })
      .catch((error) => console.error("window_is_maximized failed", error));
    return () => {
      disposed = true;
    };
  }, [win]);

  const toggleMaximize = async () => {
    if (!win) return;
    try {
      const value = await invoke<boolean>("window_toggle_maximize");
      setMaximized(value);
    } catch (error) {
      console.error("window_toggle_maximize failed", error);
      try {
        await getCurrentWindow().toggleMaximize();
        setMaximized(await getCurrentWindow().isMaximized());
      } catch (fallbackError) {
        console.error("window toggle fallback failed", fallbackError);
      }
    }
  };

  if (!win) return null;

  return (
    <div className="flex shrink-0 items-center gap-1" data-no-drag>
      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => void invoke("window_minimize").catch((error) => console.error("window_minimize failed", error))}
        title="최소화"
        aria-label="최소화"
        className={windowControlClass}
      >
        <Minus className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => void toggleMaximize()}
        title="최대화 / 복원"
        aria-label="최대화 / 복원"
        className={windowControlClass}
      >
        {maximized ? (
          <Copy className="size-[14px]" strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Square className="size-[14px]" strokeWidth={1.75} aria-hidden="true" />
        )}
      </button>
      <button
        type="button"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={() => void invoke("window_close").catch((error) => console.error("window_close failed", error))}
        title="닫기"
        aria-label="닫기"
        className={`${windowControlClass} hover:border-destructive hover:bg-destructive hover:text-destructive-foreground`}
      >
        <X className="size-[15px]" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

export default WindowControls;
