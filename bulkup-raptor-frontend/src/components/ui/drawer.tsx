"use client";

import { useEffect, useId, type ReactNode } from "react";

export type DrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  widthClassName?: string;
  closeDisabled?: boolean;
};

/**
 * 공통 사이드 드로어 (Drawer) 컴포넌트
 * - 오른쪽에서 스르륵 미끄러져 들어오는 부드러운 Slide-in 애니메이션
 * - 배경 딤드 페이드 인/아웃 및 오버레이 클릭 시 닫기
 * - ESC 키로 닫기 및 바디 스크롤 잠금 (Scroll Lock) 지원
 */
export function Drawer({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  widthClassName = "max-w-md",
  closeDisabled = false,
}: DrawerProps) {
  const titleId = useId();

  // ESC 키 닫기 및 바디 스크롤 락
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) {
        onClose();
      }
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeDisabled, onClose]);

  return (
    <div
      className={`fixed inset-0 z-50 transition-visibility duration-300 ${
        isOpen ? "pointer-events-auto visible" : "pointer-events-none invisible"
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      {/* 딤드 배경 (Fade In / Out) */}
      <div
        onClick={() => {
          if (!closeDisabled) onClose();
        }}
        className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ease-out ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden="true"
      />

      {/* 사이드 서랍 패널 (Slide In / Out) */}
      <div
        className={`fixed inset-y-0 right-0 flex w-full flex-col border-l border-zinc-200 bg-white shadow-2xl transition-transform duration-300 ease-out ${widthClassName} ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4.5">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 id={titleId} className="text-lg font-bold tracking-tight text-zinc-950">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-zinc-500">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition cursor-pointer"
            aria-label="닫기"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 스크롤 영역 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {/* 하단 고정 푸터 */}
        {footer && (
          <div className="border-t border-zinc-100 bg-zinc-50/50 p-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
