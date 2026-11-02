"use client";

import type { ReactNode } from "react";
import { Dialog } from "./dialog";

type ConfirmDialogProps = {
  isOpen: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmDialog({
  isOpen, title, description, children,
  confirmLabel = "확인", cancelLabel = "취소", isPending = false,
  onConfirm, onClose,
}: ConfirmDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      title={title}
      description={description}
      onClose={onClose}
      closeDisabled={isPending}
      footer={<>
        <button type="button" onClick={onClose} disabled={isPending}
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} disabled={isPending} aria-busy={isPending}
          className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60">
          {isPending ? "처리 중…" : confirmLabel}
        </button>
      </>}
    >
      {children}
    </Dialog>
  );
}
