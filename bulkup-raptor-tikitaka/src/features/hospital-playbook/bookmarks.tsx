"use client";

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { Bookmark } from "lucide-react";
import { useToast } from "@/shared/ui/toast";

type SavedDocument = { id: number; title: string; savedAt: string };
const BookmarkKey = createContext<string | null>(null);
const CHANGE_EVENT = "pkt-study-bookmarks-changed";
const emptySnapshot = () => "[]";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

function parse(raw: string): SavedDocument[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("Invalid bookmarks");
  return value.filter((item): item is SavedDocument => item && Number.isSafeInteger(item.id) && item.id > 0 && typeof item.title === "string" && typeof item.savedAt === "string");
}

export function BookmarkProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return <BookmarkKey.Provider value={`pkt-study-bookmarks-v1:${userId}`}>{children}</BookmarkKey.Provider>;
}

export function useBookmarks() {
  const key = useContext(BookmarkKey);
  const { showToast } = useToast();
  const raw = useSyncExternalStore(subscribe, () => {
    try { return key ? window.localStorage.getItem(key) ?? "[]" : "[]"; }
    catch { return "[]"; }
  }, emptySnapshot);
  const bookmarks = useMemo(() => { try { return parse(raw); } catch { return []; } }, [raw]);
  const update = (document: { id: number; title: string }, remove: boolean) => {
    try {
      if (!key) throw new Error("No bookmark scope");
      const current = parse(window.localStorage.getItem(key) ?? "[]");
      const next = current.filter((item) => item.id !== document.id);
      if (!remove) next.unshift({ id: document.id, title: document.title, savedAt: new Date().toISOString() });
      window.localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(CHANGE_EVENT));
      showToast(remove ? "북마크를 해제했습니다." : "북마크에 저장했습니다.");
    } catch { showToast("북마크를 저장하지 못했습니다. 기기 저장 공간과 설정을 확인하세요.", "error"); }
  };
  return { bookmarks, update };
}

export function BookmarkButton({ document }: { document: { id: number; title: string } }) {
  const { bookmarks, update } = useBookmarks();
  const saved = bookmarks.some((item) => item.id === document.id);
  return <button type="button" aria-pressed={saved} aria-label={saved ? "북마크 해제" : "북마크 추가"} title={saved ? "북마크 해제" : "북마크 추가"} onClick={() => update(document, saved)} className={`ui-icon-button h-8 shrink-0 gap-1.5 px-2 text-xs font-bold ${saved ? "bg-brand-glass text-brand-primary" : ""}`}>
    <Bookmark className="size-4" fill={saved ? "currentColor" : "none"} /><span>{saved ? "북마크됨" : "북마크"}</span>
  </button>;
}
