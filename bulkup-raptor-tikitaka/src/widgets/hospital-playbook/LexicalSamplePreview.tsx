import { useState } from "react";
import { LexicalEditor } from "../../shared/ui/lexical/lexical-editor";
import { STEP1_SAMPLE_LEXICAL_STATE, TODO_PLAN_SAMPLE_LEXICAL_STATE } from "./documentApiSamples";

type LexicalSamplePreviewProps = {
  minHeight?: string;
  initialTab?: "todo" | "step1";
};

/** 2차 주제 본문 문서와 TODO 하위 문서에서 사용하는 탭형 Lexical 샘플. */
export default function LexicalSamplePreview({ minHeight = "620px", initialTab = "todo" }: LexicalSamplePreviewProps) {
  const [tab, setTab] = useState<"todo" | "step1">(initialTab);
  const sample = tab === "todo" ? TODO_PLAN_SAMPLE_LEXICAL_STATE : STEP1_SAMPLE_LEXICAL_STATE;

  return (
    <div className="flex min-h-0 flex-col">
      <div className="flex shrink-0 gap-1 border-b border-surface-border-soft bg-surface-raised px-4 pt-3" role="tablist" aria-label="Lexical 샘플 종류">
        <button type="button" onClick={() => setTab("todo")} className={`border-b-2 px-3 pb-2 text-xs font-black ${tab === "todo" ? "border-brand-primary text-brand-primary" : "border-transparent text-text-muted"}`} aria-selected={tab === "todo"} role="tab">
          본문 TODO 계획 샘플
        </button>
        <button type="button" onClick={() => setTab("step1")} className={`border-b-2 px-3 pb-2 text-xs font-black ${tab === "step1" ? "border-brand-primary text-brand-primary" : "border-transparent text-text-muted"}`} aria-selected={tab === "step1"} role="tab">
          하위 문서 Step 1~N 샘플
        </button>
      </div>
      <div className="min-h-0 p-4">
        <LexicalEditor key={tab} initialState={sample} onChange={() => undefined} readOnly minHeight={minHeight} scrollable />
      </div>
    </div>
  );
}

