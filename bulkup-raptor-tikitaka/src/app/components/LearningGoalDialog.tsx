"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Button } from "@/shared/ui/button";

export type LearningGoalInput = { groupName: string; task: string; skill: string; progress: number };
export type LearningGoal = LearningGoalInput & { id: number; completed: boolean; orderIdx: number };
export type GoalDialogState = { kind: "create" } | { kind: "edit" | "delete"; goal: LearningGoal };

type Props = {
  state: GoalDialogState;
  groups: string[];
  pending: boolean;
  onSave: (input: LearningGoalInput) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
  onRestoreFocus: () => void;
};

const inputClass = "w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary";

export function LearningGoalDialog({ state, groups, pending, onSave, onDelete, onClose, onRestoreFocus }: Props) {
  const [form, setForm] = useState<LearningGoalInput>(() => state.kind === "create"
    ? { groupName: "", task: "", skill: "", progress: 0 }
    : { groupName: state.goal.groupName, task: state.goal.task, skill: state.goal.skill, progress: state.goal.progress });
  const [error, setError] = useState("");
  const groupListId = useId();
  const firstInput = useRef<HTMLInputElement | null>(null);
  const cancelButton = useRef<HTMLButtonElement | null>(null);
  const deleting = state.kind === "delete";
  const title = deleting ? "계획 삭제" : state.kind === "create" ? "새 계획 추가" : "계획 수정";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError("");
    const input = { ...form, groupName: form.groupName.trim(), task: form.task.trim(), skill: form.skill.trim() };
    if (!deleting && (!input.groupName || !input.task || !input.skill)) {
      setError("분류, 과제명, 핵심 스킬을 입력해 주세요.");
      return;
    }
    try {
      if (deleting) await onDelete();
      else await onSave(input);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "요청을 처리하지 못했습니다.");
    }
  };

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[180] bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[190] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-xl"
          onPointerDownOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => { event.preventDefault(); (deleting ? cancelButton.current : firstInput.current)?.focus(); }}
          onEscapeKeyDown={(event) => { if (pending) event.preventDefault(); }}
          onCloseAutoFocus={(event) => { event.preventDefault(); onRestoreFocus(); }}
        >
          <Dialog.Title className="pr-8 text-lg font-bold text-text-primary">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 break-keep text-sm leading-6 text-text-secondary">
            {deleting ? "이 계획과 진행률을 삭제합니다. 연결된 노트 문서는 삭제하지 않습니다." : "학습할 내용과 분류를 입력하세요. 새로운 분류도 직접 추가할 수 있습니다."}
          </Dialog.Description>
          <Dialog.Close asChild><Button variant="ghost" size="sm-icon" disabled={pending} aria-label="닫기" className="absolute right-4 top-4"><X className="size-4" /></Button></Dialog.Close>
          <form onSubmit={submit} className="mt-5 space-y-4" aria-busy={pending}>
            {deleting ? (
              <div className="break-words rounded-lg bg-surface-muted p-4">
                <p className="text-xs text-text-secondary">{state.goal.groupName}</p>
                <p className="mt-1 font-bold text-text-primary">{state.goal.task}</p>
                <p className="mt-2 text-xs text-text-muted">삭제 후에는 되돌릴 수 없습니다.</p>
              </div>
            ) : (
              <fieldset disabled={pending} className="space-y-4 disabled:opacity-60">
                <label className="block space-y-1.5 text-sm font-semibold text-text-primary">
                  <span>분류</span>
                  <input ref={firstInput} className={inputClass} required maxLength={40} list={groupListId} value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} placeholder="예: 라이브러리 활용" />
                  <datalist id={groupListId}>{groups.map((group) => <option key={group} value={group} />)}</datalist>
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-text-primary">
                  <span>과제명</span>
                  <input className={inputClass} required maxLength={160} value={form.task} onChange={(e) => setForm({ ...form, task: e.target.value })} placeholder="예: React Hook Form으로 입력 폼 만들기" />
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-text-primary">
                  <span>핵심 스킬</span>
                  <input className={inputClass} required maxLength={160} value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })} placeholder="예: 입력 검증, 오류 처리" />
                </label>
                <label className="block space-y-1.5 text-sm font-semibold text-text-primary">
                  <span>학습 완성도 (%)</span>
                  <input className={inputClass} type="number" min={0} max={100} step={1} required value={form.progress} onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })} />
                </label>
              </fieldset>
            )}
            {error && <p role="alert" className="break-keep text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 border-t border-surface-border pt-4">
              <Dialog.Close asChild><Button ref={cancelButton} variant="secondary" disabled={pending}>취소</Button></Dialog.Close>
              <Button type="submit" disabled={pending} className={deleting ? "border-red-600 bg-red-600 text-white" : undefined}>
                {pending ? "처리 중…" : deleting ? "삭제" : state.kind === "create" ? "추가" : "저장"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
