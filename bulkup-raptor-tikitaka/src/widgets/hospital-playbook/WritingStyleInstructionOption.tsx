import { useId, useState } from "react";

const WRITING_STYLES = [
  {
    id: "simple",
    label: "ASD-STE100 스타일",
    description: "짧은 문장과 쉬운 단어 · 기본값",
    instruction: [
      "- ASD-STE100(Simplified Technical English)의 원칙을 참고해 쉽고 간단한 한국어 설명체로 작성합니다.",
      "- 짧은 문장을 사용하고, 한 문장에는 한 가지 내용을 담습니다.",
      "- 쉬운 단어와 능동형 문장을 사용합니다. 필요한 기술 용어는 처음 나올 때 뜻을 설명합니다.",
      "- 같은 대상에는 같은 용어를 사용합니다. 불필요한 설명과 반복은 줄입니다.",
      "- 문장 끝은 ‘~한다’, ‘~이다’로 통일하고, 코드의 이름과 동작은 정확히 유지합니다.",
    ].join("\n"),
  },
  {
    id: "conversational",
    label: "친절한 대화체",
    description: "옆에서 알려 주듯 부드러운 말투",
    instruction: [
      "- 독자에게 직접 설명하듯 친절하고 자연스러운 한국어 대화체로 작성합니다.",
      "- 문장 끝은 ‘~해요’, ‘~이에요’로 통일합니다. 과한 감탄과 칭찬은 사용하지 않습니다.",
      "- 어려운 기술 용어는 쉬운 말로 풀고, 필요하면 익숙한 예시를 덧붙입니다.",
      "- 부드러운 말투를 사용하되 코드의 이름과 동작은 정확히 설명합니다.",
    ].join("\n"),
  },
  {
    id: "technical",
    label: "간결한 기술 문서체",
    description: "정확한 용어와 담백한 말투",
    instruction: [
      "- 정확한 기술 용어를 사용해 간결하고 객관적인 한국어 문서체로 작성합니다.",
      "- 문장 끝은 ‘~한다’, ‘~이다’로 통일합니다. 대화식 질문과 비유는 줄입니다.",
      "- 동작, 조건, 결과를 명확히 설명합니다. 모호한 표현과 불필요한 수식어는 제외합니다.",
      "- 필요한 기술 용어는 유지하고, 같은 대상에는 같은 용어를 사용합니다.",
    ].join("\n"),
  },
] as const;

type WritingStyleId = (typeof WRITING_STYLES)[number]["id"];

/** 스타일별 수정 내용을 유지하고 선택한 지침만 작업 지시에 넣는다. */
export function useWritingStyleInstruction() {
  const [selectedId, setSelectedId] = useState<WritingStyleId>("simple");
  const [texts, setTexts] = useState<Record<WritingStyleId, string>>({
    simple: WRITING_STYLES[0].instruction,
    conversational: WRITING_STYLES[1].instruction,
    technical: WRITING_STYLES[2].instruction,
  });
  const selectedStyle = WRITING_STYLES.find((style) => style.id === selectedId)!;
  const text = texts[selectedId];
  const setText = (value: string) => setTexts((current) => ({ ...current, [selectedId]: value }));

  return {
    selectedId, setSelectedId, text, setText,
    instructionText: [`- 선택한 스타일: ${selectedStyle.label}`, text.trim()].filter(Boolean).join("\n"),
  };
}

export default function WritingStyleInstructionOption({ option }: {
  option: ReturnType<typeof useWritingStyleInstruction>;
}) {
  const id = useId();

  return (
    <fieldset className="mt-6 rounded-lg border border-surface-border-soft bg-surface-muted/30 p-4">
      <legend className="px-1 text-xs font-black text-text-primary">설명 말투</legend>
      <div className="grid gap-3 pt-2 sm:grid-cols-3">
        {WRITING_STYLES.map((style) => (
          <label key={style.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-surface-border-soft bg-surface p-3 has-[:checked]:border-brand-border has-[:checked]:bg-brand-soft">
            <input
              type="radio"
              name={`${id}-writing-style`}
              value={style.id}
              checked={option.selectedId === style.id}
              onChange={() => option.setSelectedId(style.id)}
              className="mt-0.5 size-4 shrink-0 accent-brand-primary"
            />
            <span>
              <span className="block text-xs font-bold text-text-primary">{style.label}</span>
              <span className="mt-1 block text-[11px] leading-4 text-text-muted">{style.description}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-6 text-text-muted">선택한 말투의 지침을 작업 지시에 포함합니다. 아래 내용을 수정할 수 있으며, 다른 스타일로 바꿔도 수정한 내용은 유지됩니다.</p>
      <label className="mt-4 block">
        <span className="mb-2 block text-[11px] font-semibold text-text-secondary">설명 말투 지침</span>
        <textarea
          value={option.text}
          onChange={(event) => option.setText(event.target.value)}
          rows={5}
          className="w-full resize-y rounded-lg border border-surface-border-soft bg-surface p-3 text-xs leading-6 text-text-primary outline-none focus:border-brand-border"
        />
      </label>
    </fieldset>
  );
}
