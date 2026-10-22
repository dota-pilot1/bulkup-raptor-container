import { useState } from "react";

const DEFAULT_HIGHLIGHT_INSTRUCTION = [
  "- 코드의 주요 표현과 계산·조건 로직은 노란색 형광펜(#fef08a)으로 강조합니다.",
  "- 설명의 핵심 문구는 초록색 형광펜(#bbf7d0)으로 강조합니다.",
  "- 문단 전체나 코드 전체를 칠하지 않고, 이해에 필요한 짧은 부분만 강조합니다.",
  "- Lexical의 text·code-highlight 노드 style에 background-color를 적용하고, 글자가 잘 보이는 색을 사용합니다.",
  "- 코드의 줄바꿈·들여쓰기를 유지하고, 저장 후 조회와 화면에서 강조 표시를 확인합니다.",
].join("\n");

/** 체크한 경우에만 수정된 형광펜 지침을 작업 지시에 포함한다. */
export function useHighlightInstruction() {
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState(DEFAULT_HIGHLIGHT_INSTRUCTION);
  return { enabled, setEnabled, text, setText, instructionText: enabled ? text.trim() : "" };
}

export default function HighlightInstructionOption({
  option,
}: {
  option: ReturnType<typeof useHighlightInstruction>;
}) {
  return (
    <div className="mt-6 rounded-lg border border-surface-border-soft bg-surface-muted/30 p-4">
      <label className="flex cursor-pointer items-center gap-2 text-xs font-black text-text-primary">
        <input
          type="checkbox"
          checked={option.enabled}
          onChange={(event) => option.setEnabled(event.target.checked)}
          className="size-4 accent-brand-primary"
        />
        형광펜 지침 포함
      </label>
      <p className="mt-3 text-[11px] leading-6 text-text-muted">
        체크하면 아래 지침을 작업 지시에 포함합니다. 지침은 체크 여부와 관계없이 수정할 수 있습니다.
      </p>
      <label className="mt-4 block">
        <span className="mb-2 block text-[11px] font-semibold text-text-secondary">형광펜 지침</span>
        <textarea
          value={option.text}
          onChange={(event) => option.setText(event.target.value)}
          rows={5}
          className="w-full resize-y rounded-lg border border-surface-border-soft bg-surface p-3 text-xs leading-6 text-text-primary outline-none focus:border-brand-border"
        />
      </label>
    </div>
  );
}
