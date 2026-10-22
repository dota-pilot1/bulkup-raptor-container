"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";

export type SearchDialogItem = {
  id: number | string;
  title: string;
  description?: string;
  category?: string;
  price?: number;
  visual?: ReactNode;
  visualClass?: string;
  actionLabel?: string;
  actionDoneLabel?: string;
  onAction?: (item: SearchDialogItem) => void;
  onClick?: (item: SearchDialogItem) => void;
};

export type SearchDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  placeholder?: string;
  items?: SearchDialogItem[];
  recommendTags?: string[];
  recommendItems?: { id: number | string; title: string; price?: number; visual?: ReactNode }[];
  emptyMessage?: string;
  footerHint?: string;
};

/**
 * 공통 검색 다이어로그 컴포넌트
 * - 타이핑 시 실시간 필터링 대신, 'Enter' 입력 또는 '검색' 버튼 클릭 시에만 검색 실행
 * - 한글 IME 조합 중 Enter 버그 방어
 * - 추천 검색어 칩 클릭 시 즉각 검색 실행
 * - 범용적인 SearchDialogItem 구조로 다양한 도메인에서 재사용 가능
 */
export function SearchDialog({
  isOpen,
  onClose,
  placeholder = "검색어를 입력 후 Enter를 누르세요",
  items = [],
  recommendTags = [],
  recommendItems = [],
  emptyMessage = "일치하는 검색 결과가 없습니다.",
  footerHint = "Enter를 눌러 검색하고 바로 장바구니에 담아보세요",
}: SearchDialogProps) {
  const [inputValue, setInputValue] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [actedId, setActedId] = useState<number | string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 모달 오픈 시 초기화 및 인풋 포커스
  useEffect(() => {
    if (isOpen) {
      setInputValue("");
      setSubmittedQuery("");
      setActedId(null);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [isOpen]);

  const handleSearch = (keyword: string) => {
    const trimmed = keyword.trim();
    setSubmittedQuery(trimmed);
    setInputValue(trimmed);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(inputValue);
  };

  const handleClear = () => {
    setInputValue("");
    setSubmittedQuery("");
    inputRef.current?.focus();
  };

  const handleAction = (item: SearchDialogItem, e: React.MouseEvent) => {
    e.stopPropagation();
    item.onAction?.(item);
    setActedId(item.id);
    setTimeout(() => setActedId(null), 1200);
  };

  // 제출된 쿼리 기준으로 필터링
  const query = submittedQuery.toLowerCase();
  const searchResults = query
    ? items.filter((item) => {
        return (
          item.title.toLowerCase().includes(query) ||
          (item.description && item.description.toLowerCase().includes(query)) ||
          (item.category && item.category.toLowerCase().includes(query))
        );
      })
    : [];

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-xl">
      <div className="-mt-1">
        {/* 검색 폼 (Enter 또는 제출 버튼으로 실행) */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-b border-zinc-100 pb-3" noValidate>
          <svg className="h-5 w-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              // 한글 IME 조합 중 Enter 중복 방지
              if (e.key === "Enter" && (e.nativeEvent.isComposing || e.keyCode === 229)) {
                e.preventDefault();
                handleSearch(inputValue);
              }
            }}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none"
          />

          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 transition"
              aria-label="입력 초기화"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          <button
            type="submit"
            className="shrink-0 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-zinc-800 cursor-pointer"
          >
            검색
          </button>
        </form>

        {/* 결과 / 초기 추천 영역 */}
        <div className="max-h-[360px] min-h-[160px] overflow-y-auto py-3">
          {submittedQuery ? (
            searchResults.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between px-2 pb-2">
                  <p className="text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                    &lsquo;{submittedQuery}&rsquo; 검색 결과 {searchResults.length}건
                  </p>
                  <button
                    type="button"
                    onClick={() => setSubmittedQuery("")}
                    className="text-[11px] font-medium text-emerald-600 hover:underline cursor-pointer"
                  >
                    추천 목록 보기
                  </button>
                </div>
                {searchResults.map((item) => {
                  const isActed = actedId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => item.onClick?.(item)}
                      className={`group flex items-center justify-between gap-3 rounded-xl p-2.5 transition hover:bg-zinc-50 ${
                        item.onClick ? "cursor-pointer" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.visual && (
                          <div
                            className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg ${
                              item.visualClass ?? "bg-zinc-100"
                            }`}
                          >
                            {item.visual}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-bold text-zinc-900">
                              {item.title}
                            </span>
                            {item.category && (
                              <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                                {item.category}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="truncate text-xs text-zinc-400">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {item.price !== undefined && (
                          <span className="text-sm font-extrabold text-zinc-950">
                            {item.price.toLocaleString()}원
                          </span>
                        )}
                        {item.onAction && (
                          <button
                            type="button"
                            onClick={(e) => handleAction(item, e)}
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                              isActed
                                ? "bg-emerald-600 text-white"
                                : "bg-zinc-100 text-zinc-700 hover:bg-emerald-50 hover:text-emerald-700"
                            }`}
                          >
                            {isActed ? (item.actionDoneLabel ?? "✓ 완료") : (item.actionLabel ?? "+ 담기")}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid h-40 place-items-center text-center">
                <div>
                  <p className="text-sm font-semibold text-zinc-700">
                    &lsquo;{submittedQuery}&rsquo;에 일치하는 결과가 없습니다
                  </p>
                  <p className="mt-1 text-xs text-zinc-400">{emptyMessage}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedQuery("");
                      setInputValue("");
                      inputRef.current?.focus();
                    }}
                    className="mt-3 rounded-full border border-zinc-200 px-3 py-1 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer"
                  >
                    추천 키워드로 찾기
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="py-2">
              {recommendTags.length > 0 && (
                <div>
                  <p className="px-2 text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                    추천 키워드 (클릭 시 바로 검색)
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-2 px-2">
                    {recommendTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleSearch(tag)}
                        className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-emerald-600 hover:text-emerald-700 cursor-pointer"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recommendItems.length > 0 && (
                <div className="mt-5 border-t border-zinc-100 pt-3">
                  <p className="px-2 text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
                    추천 상품
                  </p>
                  <div className="mt-2 space-y-1">
                    {recommendItems.map((rec) => (
                      <div
                        key={rec.id}
                        onClick={() => handleSearch(rec.title)}
                        className="flex items-center justify-between rounded-lg p-2 transition hover:bg-zinc-50 cursor-pointer"
                      >
                        <span className="text-xs font-semibold text-zinc-700">
                          {rec.visual && <span className="mr-1.5">{rec.visual}</span>}
                          {rec.title}
                        </span>
                        {rec.price !== undefined && (
                          <span className="text-xs font-bold text-zinc-900">
                            {rec.price.toLocaleString()}원
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 힌트 */}
        <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-3 text-[11px] text-zinc-400">
          <span>{footerHint}</span>
          <div className="flex items-center gap-2">
            <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-sans font-bold">↵ Enter</kbd>
            <span>검색</span>
            <kbd className="ml-1 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-sans font-bold">ESC</kbd>
            <span>닫기</span>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
