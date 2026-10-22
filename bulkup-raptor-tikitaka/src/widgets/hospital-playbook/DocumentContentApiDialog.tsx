import { useMemo, useState } from "react";
import type { PlaybookSampleKey } from "../../features/hospital-playbook/api";
import ApiGuideDialogShell from "./ApiGuideDialogShell";
import ImplementationNoteSamplePreview from "./ImplementationNoteSamplePreview";
import { DOCUMENT_WRITING_GUIDELINES } from "./document-writing-guidelines";
import HighlightInstructionOption, { useHighlightInstruction } from "./HighlightInstructionOption";
import WritingStyleInstructionOption, { useWritingStyleInstruction } from "./WritingStyleInstructionOption";

type DocumentContentApiDialogProps = {
  documentId: number;
  topicId: number;
  documentTitle: string;
  topicTitle?: string;
  categoryTitle?: string;
  onClose: () => void;
};

type WorkMode = "content" | "children";

/** 본문 편집과 하위 문서 작업을 한 화면에서 전환해 각각에 맞는 API 지시문을 만든다. */
export default function DocumentContentApiDialog({
  documentId,
  topicId,
  documentTitle,
  topicTitle,
  categoryTitle,
  onClose,
}: DocumentContentApiDialogProps) {
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const highlight = useHighlightInstruction();
  const writingStyle = useWritingStyleInstruction();
  const [workMode, setWorkMode] = useState<WorkMode>("content");
  const [selectedSampleKeys, setSelectedSampleKeys] = useState<PlaybookSampleKey[]>([]);
  const base = "/api/llm/hospital-playbook";
  const isChildWork = workMode === "children";
  const instruction = useMemo(
    () => [
      isChildWork ? "다음 본문과 하위 문서 작업을 진행해 주세요." : "다음 본문 문서를 수정해 주세요.",
      "",
      "## 작업 대상",
      `- ${isChildWork ? "상위 문서" : "문서"}: ${documentTitle}`,
      `- ${isChildWork ? "parentDocumentId" : "documentId"}: ${documentId}`,
      ...(isChildWork ? [`- topicId: ${topicId}`] : []),
      "",
      "## 작업 방식",
      ...(isChildWork
        ? [
            "먼저 현재 본문과 하위 문서 트리를 조회해 중복 생성을 피합니다.",
            "새 하위 문서는 parentId에 상위 문서 ID를 사용합니다. 기존 하위 문서를 수정할 때는 해당 문서를 다시 조회해 최신 version과 parentId를 확인합니다.",
          ]
        : ["먼저 현재 문서와 최신 version을 조회합니다. 수정할 때는 조회 결과의 version을 expectedVersion으로 사용하고, parentId는 조회 결과의 값을 그대로 유지합니다."]),
      "",
      ...DOCUMENT_WRITING_GUIDELINES,
      "", "## 설명 말투", writingStyle.instructionText,
      ...(highlight.instructionText ? ["", "## 형광펜 지침", highlight.instructionText] : []),
      ...(additionalInstruction.trim()
        ? ["", "## 추가 지시", additionalInstruction.trim()]
        : []),
      "",
      "## 선택한 작성 샘플",
      ...(selectedSampleKeys.length
        ? selectedSampleKeys.map(
            (sampleKey) => `- GET ${base}/samples/${sampleKey}: ${sampleKey} Lexical 작성 구조 참고`,
          )
        : ["- 선택한 샘플 없음"]),
      "",
      ...(isChildWork
        ? [
            "## 본문과 하위 문서 트리 조회",
            `GET ${base}/documents/${documentId}/context`,
            "",
            "## 새 하위 문서 생성",
            `POST ${base}/topics/${topicId}/children`,
            "Content-Type: application/json",
            "",
            "{",
            `  "parentId": ${documentId},`,
            '  "title": "하위 문서 제목",',
            '  "content": "Lexical JSON 문자열"',
            "}",
            "",
            "## 기존 하위 문서 편집",
            `GET ${base}/documents/{childDocumentId}`,
            "",
            `PATCH ${base}/documents/{childDocumentId}/content`,
            "Content-Type: application/json",
            "",
            "{",
            '  "title": "수정 제목",',
            '  "content": "Lexical JSON 문자열",',
            '  "expectedVersion": "GET으로 확인한 최신 version",',
            '  "parentId": "GET으로 확인한 기존 parentId"',
            "}",
            "",
            "409 충돌이면 해당 하위 문서를 다시 조회해 최신 version으로 다시 요청합니다.",
          ]
        : [
            "## 현재 본문 조회",
            `GET ${base}/documents/${documentId}`,
            "",
            "## 현재 본문 수정",
            `PATCH ${base}/documents/${documentId}/content`,
            "Content-Type: application/json",
            "",
            "{",
            '  "title": "수정 제목",',
            '  "content": "Lexical JSON 문자열",',
            '  "expectedVersion": "GET으로 확인한 최신 version",',
            '  "parentId": "GET으로 확인한 현재 parentId"',
            "}",
            "",
            "409 충돌이면 문서를 다시 조회해 최신 version으로 다시 요청합니다.",
            "하위 문서를 만들거나 parentId를 현재 documentId로 바꾸지 않습니다.",
          ]),
    ].join("\n"),
    [additionalInstruction, writingStyle.instructionText, highlight.instructionText, base, documentId, documentTitle, isChildWork, selectedSampleKeys, topicId],
  );

  return (
    <ApiGuideDialogShell
      title={isChildWork ? "하위 문서 작업 API" : "본문 편집 API"}
      contextLabel={`${categoryTitle ? `${categoryTitle} > ` : ""}${topicTitle || "주제 확인 중"}`}
      description={isChildWork
        ? `본문 ‘${documentTitle}’ 아래의 하위 문서를 조회·생성·수정합니다.`
        : `본문 ‘${documentTitle}’ 자체를 조회·수정합니다.`}
      copyText={instruction}
      onClose={onClose}
      ariaLabel={isChildWork ? "하위 문서 작업 API" : "본문 편집 API"}
      copyLabel="전체 복사"
      headerActions={
        <div className="flex rounded-lg border border-surface-border-soft bg-surface-muted p-1" role="group" aria-label="문서 작업 방식">
          <button type="button" onClick={() => setWorkMode("content")} aria-pressed={!isChildWork} className={`rounded-md px-3 py-1.5 text-[11px] font-black transition ${!isChildWork ? "bg-brand-primary text-white shadow-sm" : "text-text-muted hover:bg-surface-raised hover:text-text-primary"}`}>본문 편집</button>
          <button type="button" onClick={() => setWorkMode("children")} aria-pressed={isChildWork} className={`rounded-md px-3 py-1.5 text-[11px] font-black transition ${isChildWork ? "bg-brand-primary text-white shadow-sm" : "text-text-muted hover:bg-surface-raised hover:text-text-primary"}`}>하위 문서 작업</button>
        </div>
      }
      footer="추가 지시와 작성 샘플을 선택하면 오른쪽 작업 지시에 즉시 반영됩니다."
    >
      <div className="grid min-h-full min-w-0 grid-cols-1 lg:grid-cols-2">
        <section className="min-h-0 overflow-auto border-b border-surface-border-soft bg-surface-raised p-5 lg:border-b-0 lg:border-r">
          <label className="block">
            <span className="mb-1 block text-sm font-black text-text-primary">추가 지시</span>
            <span className="mb-2 block text-[11px] font-semibold leading-5 text-text-muted">{isChildWork ? "하위 문서의 생성·편집 범위와 검증 조건을 적으면 오른쪽 작업 지시에 포함됩니다." : "본문에 반영할 범위·표현·검증 조건을 적으면 오른쪽 작업 지시에 포함됩니다."}</span>
            <textarea
              value={additionalInstruction}
              onChange={(event) => setAdditionalInstruction(event.target.value)}
              rows={5}
              placeholder={isChildWork ? "예: 기존 하위 문서를 확인하고, API 구현과 Front 구현을 각각 하위 문서로 정리하세요." : "예: saveAndFlush 설명을 Repository 문서 맨 아래로 옮기고, 중복 설명은 제거하세요."}
              className="w-full resize-y rounded-lg border border-surface-border-soft bg-surface p-3 text-xs leading-5 text-text-primary outline-none focus:border-brand-border"
            />
          </label>
          <WritingStyleInstructionOption option={writingStyle} />
          <HighlightInstructionOption option={highlight} />

          <div className="mt-6">
            <h3 className="text-sm font-black text-text-primary">{isChildWork ? "하위 문서 작업 API" : "본문 편집 API"}</h3>
            <p className="mt-1 text-[11px] font-semibold leading-5 text-text-muted">{isChildWork ? "현재 본문을 부모로 하는 하위 문서의 조회·생성·편집만 다룹니다." : "현재 문서 자체만 다룹니다. 하위 문서 생성 API는 포함하지 않습니다."}</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-surface-border-soft">
              <div className="grid grid-cols-[72px_minmax(0,1fr)] border-b border-surface-border-soft bg-surface-muted px-3 py-2 text-[11px] font-black text-text-secondary">
                <span>방식</span><span>API와 하는 일</span>
              </div>
              <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 border-b border-surface-border-soft px-3 py-3 text-xs">
                <span className="h-fit w-fit rounded bg-emerald-100 px-1.5 py-1 font-mono text-[10px] font-black text-emerald-700">GET</span>
                <div><code className="break-all font-mono text-[11px] text-text-primary">{isChildWork ? `${base}/documents/${documentId}/context` : `${base}/documents/${documentId}`}</code><p className="mt-1 font-semibold leading-5 text-text-muted">{isChildWork ? "현재 본문과 하위 문서 트리, 각 문서의 최신 version을 확인합니다." : "본문과 최신 version을 확인합니다."}</p></div>
              </div>
              {isChildWork ? <>
                <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 border-b border-surface-border-soft px-3 py-3 text-xs"><span className="h-fit w-fit rounded bg-blue-100 px-1.5 py-1 font-mono text-[10px] font-black text-blue-700">POST</span><div><code className="break-all font-mono text-[11px] text-text-primary">{base}/topics/{topicId}/children</code><p className="mt-1 font-semibold leading-5 text-text-muted">현재 본문 ID를 parentId로 지정해 새 하위 문서를 만듭니다.</p></div></div>
                <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 px-3 py-3 text-xs"><span className="h-fit w-fit rounded bg-amber-100 px-1.5 py-1 font-mono text-[10px] font-black text-amber-700">PATCH</span><div><code className="break-all font-mono text-[11px] text-text-primary">{base}/documents/{"{childDocumentId}"}/content</code><p className="mt-1 font-semibold leading-5 text-text-muted">기존 하위 문서를 최신 version 기준으로 제목·Lexical 본문을 수정합니다.</p></div></div>
              </> : <div className="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 px-3 py-3 text-xs"><span className="h-fit w-fit rounded bg-amber-100 px-1.5 py-1 font-mono text-[10px] font-black text-amber-700">PATCH</span><div><code className="break-all font-mono text-[11px] text-text-primary">{base}/documents/{documentId}/content</code><p className="mt-1 font-semibold leading-5 text-text-muted">최신 version으로 제목·Lexical 본문을 수정합니다.</p></div></div>}
            </div>
          </div>
          <details className="mt-5 rounded-lg border border-surface-border-soft" open>
            <summary className="cursor-pointer px-3 py-2 text-xs font-black text-text-primary">작성 샘플 참고</summary>
            <div className="border-t border-surface-border-soft">
              <ImplementationNoteSamplePreview
                selectedKeys={selectedSampleKeys}
                onSelectedKeysChange={setSelectedSampleKeys}
                showInlinePreview={false}
              />
            </div>
          </details>
        </section>

        <section aria-label="Codex 작업 지시 미리보기" className="flex min-h-0 flex-col bg-surface-muted/20 p-5">
          <div><h3 className="text-sm font-black text-text-primary">Codex에 보낼 작업 지시</h3><p className="mt-1 text-[11px] font-semibold text-text-muted">추가 지시를 입력하면 즉시 반영됩니다.</p></div>
          <textarea
            readOnly
            value={instruction}
            aria-label={isChildWork ? "하위 문서 작업 지시" : "본문 편집 작업 지시"}
            className="mt-3 min-h-[560px] flex-1 resize-y rounded-lg border border-surface-border-soft bg-surface-raised p-3 font-mono text-[11px] leading-5 text-text-secondary outline-none"
          />
        </section>
      </div>
    </ApiGuideDialogShell>
  );
}
