import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { copyToClipboard } from "../../shared/lib/clipboard";
import { useToast } from "../../shared/ui/toast";
import ApiGuideDialogShell from "./ApiGuideDialogShell";
import { DOCUMENT_WRITING_GUIDELINES } from "./document-writing-guidelines";
import HighlightInstructionOption, { useHighlightInstruction } from "./HighlightInstructionOption";
import WritingStyleInstructionOption, { useWritingStyleInstruction } from "./WritingStyleInstructionOption";

type ApiDesignDocumentDialogProps = {
  documentId: number;
  topicId: number;
  documentTitle: string;
  onClose: () => void;
};

type ApiItem = {
  id: "get-document" | "patch-document";
  method: "GET" | "PATCH";
  label: string;
  endpoint: string;
  summary: string;
  content: string;
};

const methodClass = {
  GET: "bg-emerald-100 text-emerald-700",
  PATCH: "bg-amber-100 text-amber-700",
} as const;

/** 기존 본문을 API 설계 문서로 작성·보완하도록 Codex 작업 지시를 만든다. */
export default function ApiDesignDocumentDialog({ documentId, topicId, documentTitle, onClose }: ApiDesignDocumentDialogProps) {
  const { showToast } = useToast();
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const highlight = useHighlightInstruction();
  const writingStyle = useWritingStyleInstruction();
  const [selectedIds, setSelectedIds] = useState<ApiItem["id"][]>(["get-document", "patch-document"]);
  const [copied, setCopied] = useState(false);
  const base = "/api/llm/hospital-playbook";
  const items = useMemo<ApiItem[]>(() => [
    {
      id: "get-document",
      method: "GET",
      label: "현재 본문 조회",
      endpoint: `${base}/documents/${documentId}`,
      summary: "제목·Lexical 본문·parentId·최신 version을 확인합니다.",
      content: `GET ${base}/documents/${documentId}\n\n현재 본문 ‘${documentTitle}’의 제목, Lexical 본문, parentId, 최신 version을 조회합니다. 수정 전에 반드시 사용합니다.`,
    },
    {
      id: "patch-document",
      method: "PATCH",
      label: "API 설계 본문 저장",
      endpoint: `${base}/documents/${documentId}/content`,
      summary: "조회한 최신 version을 기준으로 API 설계 본문을 저장합니다.",
      content: `PATCH ${base}/documents/${documentId}/content\nContent-Type: application/json\n\n{\n  "title": "API 설계 문서 제목",\n  "content": "Lexical JSON 문자열",\n  "expectedVersion": "GET으로 확인한 최신 version",\n  "parentId": null\n}\n\n409 충돌이면 본문을 다시 GET한 뒤 최신 version으로 다시 요청합니다. parentId는 조회 결과를 그대로 사용합니다.`,
    },
  ], [base, documentId, documentTitle]);
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const allSelected = selectedIds.length === items.length;
  const guide = selectedItems.flatMap((item) => [`# ${item.label}`, "", item.content, ""]).join("\n");
  const instruction = [
    "다음 작업을 진행해 주세요.",
    "",
    "## 작업 대상",
    `- 문서: ${documentTitle}`,
    `- documentId: ${documentId}`,
    `- topicId: ${topicId}`,
    "",
    "## 작업 목표",
    "현재 본문을 구현 전에 합의할 API 설계 문서로 작성하거나 보강합니다. 먼저 최신 본문과 version을 조회하고, 같은 문서에만 반영합니다. 하위 문서는 만들지 않습니다.",
    "",
    ...DOCUMENT_WRITING_GUIDELINES,
    "", "## 설명 말투", writingStyle.instructionText,
    ...(highlight.instructionText ? ["", "## 형광펜 지침", highlight.instructionText] : []),
    ...(additionalInstruction.trim() ? ["", "## 추가 지시", additionalInstruction.trim()] : []),
    "",
    "## 권장 문서 구조",
    "- API의 목적을 한 문장으로 설명한다.",
    "- API 범위와 제외 범위를 명확히 한다.",
    "- 요청 계약과 성공 응답은 각각 JSON 코드 블록으로 작성한다.",
    "- 서버 처리 규칙, 오류 응답 기준, 구현·검증 연결을 분리한다.",
    "- 확정되지 않은 내용은 단정하지 말고 결정이 필요한 항목으로 표시한다.",
    "- API 범위·요청·응답의 일반 설명은 인용문이 아닌 기본 본문 텍스트로 작성하고, 제목 크기와 여백으로 위계를 구분한다.",
    "- 인용문은 보안 경고, 반드시 지켜야 할 예외, 결정 보류처럼 특별히 강조할 내용에만 쓴다. 인용문 바로 아래에 실행 규칙 목록을 붙이지 말고, 실행 규칙은 일반 문단으로 설명한 뒤 목록으로 묶는다.",
    "",
    "## 선택한 API",
    ...(selectedItems.length ? selectedItems.flatMap((item) => [`### ${item.label}`, item.content, ""]) : ["- 선택한 API 없음"]),
    "## 작업 방식",
    "저장 시 GET으로 확인한 expectedVersion과 parentId를 사용하세요. 409 충돌이면 다시 조회한 최신 version으로 반영하세요. 본문은 표준 Lexical heading, 일반 본문, JSON 코드 블록 구조로 작성하세요.",
  ].join("\n");

  const toggleItem = (id: ApiItem["id"]) => setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const copyInstruction = async () => {
    try {
      await copyToClipboard(instruction);
      setCopied(true);
      showToast("Codex API 설계 작업 지시를 복사했습니다.");
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      showToast("클립보드에 복사하지 못했습니다.", "error");
    }
  };

  return (
    <ApiGuideDialogShell
      title="API 설계 작업 요청"
      description={`본문 ‘${documentTitle}’을 API 설계 문서로 작성·보강할 Codex 지시를 만듭니다.`}
      copyText={guide}
      onClose={onClose}
      ariaLabel="API 설계 작업 요청"
      contentAriaLabel="API 설계 작업 API 선택"
      copyLabel={`선택 항목 복사 (${selectedItems.length})`}
      headerActions={<button type="button" onClick={() => void copyInstruction()} className="ui-icon-button h-8 gap-1.5 px-3 text-xs font-black text-brand-primary">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "지시문 복사됨" : "지시문 복사"}</button>}
      footer="이 요청은 본문 전체 설계를 위한 것입니다. 개별 요청·응답 블록을 직접 작성할 때는 Lexical의 API 설계 블록 삽입을 사용하세요."
    >
      <div className="grid min-h-full min-w-0 grid-cols-1 lg:grid-cols-2">
        <section className="min-h-0 overflow-auto border-b border-surface-border-soft bg-surface-raised p-5 lg:border-b-0 lg:border-r">
          <label className="block"><span className="mb-1 block text-sm font-black text-text-primary">추가 지시</span><span className="mb-2 block text-[11px] font-semibold leading-5 text-text-muted">업무 규칙, 보안 요구사항, 제외 범위를 적습니다.</span><textarea value={additionalInstruction} onChange={(event) => setAdditionalInstruction(event.target.value)} rows={5} placeholder="예: 역할은 요청에서 받지 않고 기본 USER 역할을 부여해 주세요." className="w-full resize-y rounded-lg border border-surface-border-soft bg-surface p-3 text-xs leading-5 text-text-primary outline-none focus:border-brand-border" /></label>
          <WritingStyleInstructionOption option={writingStyle} />
          <HighlightInstructionOption option={highlight} />
          <div className="mb-4 mt-6 flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-text-primary">본문 작성 API</h3><p className="mt-1 text-[11px] font-semibold text-text-muted">저장 전 최신 본문과 version을 읽도록 기본 선택합니다.</p></div><label className="flex items-center gap-2 text-[11px] font-black text-text-muted"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected ? [] : items.map((item) => item.id))} className="size-4 accent-brand-primary" />전체 선택</label></div>
          <div className="overflow-hidden rounded-lg border border-surface-border-soft">{items.map((item) => <label key={item.id} className="flex cursor-pointer gap-3 border-b border-surface-border-soft px-3 py-3 last:border-b-0 hover:bg-surface-muted/60"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleItem(item.id)} className="mt-0.5 size-4 shrink-0 accent-brand-primary" /><span className="min-w-0"><span className="flex items-center gap-2"><span className={`rounded px-1.5 py-1 font-mono text-[10px] font-black ${methodClass[item.method]}`}>{item.method}</span><strong className="text-xs text-text-primary">{item.label}</strong></span><code className="mt-1 block break-all text-[11px] text-text-secondary">{item.endpoint}</code><span className="mt-1 block text-[11px] leading-5 text-text-muted">{item.summary}</span></span></label>)}</div>
        </section>
        <section className="flex min-h-0 flex-col bg-surface-muted/20 p-5"><div className="mb-2 flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-text-primary">Codex에 보낼 API 설계 요청</h3><p className="mt-1 text-[11px] font-semibold text-text-muted">선택 항목과 추가 지시에 따라 즉시 갱신됩니다.</p></div><button type="button" onClick={() => void copyInstruction()} className="ui-icon-button-brand h-8 gap-1.5 px-2.5 text-[11px] font-black">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied ? "복사됨" : "전체 복사"}</button></div><textarea value={instruction} readOnly aria-label="생성된 Codex API 설계 작업 지시" className="min-h-[560px] flex-1 resize-y rounded-lg border border-surface-border-soft bg-surface-raised p-3 font-mono text-[11px] leading-5 text-text-secondary outline-none" /></section>
      </div>
    </ApiGuideDialogShell>
  );
}
