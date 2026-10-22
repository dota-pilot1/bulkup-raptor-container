import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { PlaybookSampleKey } from "../../features/hospital-playbook/api";
import { getApiBase } from "../../shared/api/client";
import { copyToClipboard } from "../../shared/lib/clipboard";
import { useToast } from "../../shared/ui/toast";
import ApiGuideDialogShell from "./ApiGuideDialogShell";
import { DOCUMENT_WRITING_GUIDELINES } from "./document-writing-guidelines";
import ImplementationNoteSamplePreview from "./ImplementationNoteSamplePreview";

type HttpMethod = "GET" | "POST" | "PATCH";
type ApiItem = { id: string; label: string; method: HttpMethod; endpoint: string; summary: string; content: string };
type DocumentContextApiDialogProps = { documentId: number; topicId: number; documentTitle: string; onClose: () => void };
type ApiPreset = "default" | "basic-edit" | "custom";

const methodClass: Record<HttpMethod, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PATCH: "bg-amber-100 text-amber-700",
};

export default function DocumentContextApiDialog({ documentId, topicId, documentTitle, onClose }: DocumentContextApiDialogProps) {
  const { showToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [preset, setPreset] = useState<ApiPreset>("default");
  const [selectedSampleKeys, setSelectedSampleKeys] = useState<PlaybookSampleKey[]>([]);
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [instructionCopied, setInstructionCopied] = useState(false);
  const base = "/api/llm/hospital-playbook";
  const items = useMemo<ApiItem[]>(() => [
    {
      id: "get-context", label: "본문·하위 문서 전체 조회", method: "GET", endpoint: `${base}/documents/${documentId}/context`,
      summary: "현재 본문과 모든 하위 문서를 트리로 읽고, 중복 생성 여부와 최신 version을 확인합니다.",
      content: `GET ${base}/documents/${documentId}/context\n\n현재 본문(${documentTitle})과 모든 하위 문서를 children 트리로 조회합니다. 새 하위 문서를 만들기 전에 먼저 사용합니다.`,
    },
    {
      id: "get-child", label: "하위 문서 하나 조회", method: "GET", endpoint: `${base}/documents/{childDocumentId}`,
      summary: "선택한 하위 문서의 제목·본문·parentId·최신 version을 읽습니다.",
      content: `GET ${base}/documents/{childDocumentId}\n\n{childDocumentId}에는 context 응답의 children.id를 넣습니다. 수정 전 version과 parentId를 확인합니다.`,
    },
    {
      id: "create-child", label: "하위 문서 추가", method: "POST", endpoint: `${base}/topics/${topicId}/children`,
      summary: "현재 본문 아래에 실제 코드·명령어·검증을 기록할 상세 문서를 만듭니다.",
      content: `POST ${base}/topics/${topicId}/children\nContent-Type: application/json\n\n{\n  "parentId": ${documentId},\n  "title": "TODO 1. Docker PostgreSQL 실행",\n  "content": "Lexical JSON 문자열"\n}\n\nparentId에는 현재 본문 문서 ID ${documentId}를 사용합니다.`,
    },
    {
      id: "patch-child", label: "하위 문서 편집", method: "PATCH", endpoint: `${base}/documents/{childDocumentId}/content`,
      summary: "조회한 최신 expectedVersion으로 하위 문서의 제목과 Lexical 본문을 저장합니다.",
      content: `PATCH ${base}/documents/{childDocumentId}/content\nContent-Type: application/json\n\n{\n  "title": "수정 제목",\n  "content": "Lexical JSON 문자열",\n  "expectedVersion": "GET으로 확인한 최신 version",\n  "parentId": ${documentId}\n}\n\n409 충돌이면 하위 문서를 다시 GET한 뒤 최신 version으로 다시 요청합니다.`,
    },
    {
      id: "get-samples", label: "작성 샘플 목록 조회", method: "GET", endpoint: `${base}/samples`,
      summary: "등록된 본문·하위 문서 작성 샘플의 제목과 sampleKey 목록을 읽습니다.",
      content: `GET ${base}/samples\n\n등록된 샘플의 sampleKey와 제목을 확인합니다. 실제 샘플 본문은 단건 조회 API로 읽습니다.`,
    },
    {
      id: "get-sample", label: "작성 샘플 하나 조회", method: "GET", endpoint: `${base}/samples/{sampleKey}`,
      summary: "선택한 샘플의 Lexical 본문, 제목, 최신 version과 하위 샘플을 읽습니다.",
      content: `GET ${base}/samples/{sampleKey}\n\n{sampleKey}에는 목록 조회에서 확인한 키를 넣습니다. 현재 작업에 맞는 Lexical 구조를 참고합니다.`,
    },
    {
      id: "create-sample", label: "작성 샘플 등록", method: "POST", endpoint: `${base}/samples`,
      summary: "반복해서 쓸 본문 또는 하위 문서 작성 형식을 새 샘플로 등록합니다.",
      content: `POST ${base}/samples\nContent-Type: application/json\n\n{\n  "sampleKey": "DB_SETUP_IMPLEMENTATION",\n  "title": "DB 설정 구현 기록 샘플",\n  "content": "Lexical JSON 문자열"\n}\n\nsampleKey는 대문자 스네이크 케이스로 정하고, 실제 작업 문서가 아닌 재사용 가능한 형식만 등록합니다.`,
    },
    {
      id: "patch-sample", label: "작성 샘플 편집", method: "PATCH", endpoint: `${base}/samples/{sampleKey}`,
      summary: "샘플의 키·제목·Lexical 본문을 최신 version 기준으로 수정합니다.",
      content: `PATCH ${base}/samples/{sampleKey}\nContent-Type: application/json\n\n{\n  "sampleKey": "DB_SETUP_IMPLEMENTATION",\n  "title": "DB 설정 구현 기록 샘플",\n  "content": "Lexical JSON 문자열",\n  "expectedVersion": <GET으로 확인한 최신 version>\n}\n\n수정 전 반드시 단건 조회로 최신 version을 확인합니다.`,
    },
  ], [base, documentId, documentTitle, topicId]);
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const allSelected = selectedIds.length === items.length;
  const fullUrl = (endpoint: string) => `${window.location.origin}${getApiBase()}${endpoint}`;
  const selectedGuide = [
    "# 하위 문서 작업 API",
    "",
    `topicId: ${topicId}`,
    `parentDocumentId: ${documentId}`,
    `parentDocumentTitle: ${documentTitle}`,
    "",
    ...selectedItems.flatMap((item) => [`# ${item.label}`, "", item.content, ""]),
    ...selectedSampleKeys.flatMap((sampleKey) => ["# 작성 샘플 참고", "", `GET ${base}/samples/${sampleKey}`, "", `${sampleKey} 샘플의 Lexical 작성 구조를 조회합니다.`, ""]),
  ].join("\n");
  const instruction = [
    "다음 작업을 진행해 주세요.",
    "",
    "## 작업 대상",
    `- 상위 문서: ${documentTitle}`,
    `- parentDocumentId: ${documentId}`,
    `- topicId: ${topicId}`,
    "",
    "## 작업 목표",
    "현재 본문 아래에 구현 상세를 하위 문서로 기록합니다. 새 문서를 만들기 전 기존 하위 문서를 확인해 중복 생성을 피하세요.",
    "",
    ...DOCUMENT_WRITING_GUIDELINES,
    ...(additionalInstruction.trim() ? ["", "## 추가 지시", additionalInstruction.trim()] : []),
    "",
    "## 선택한 API",
    ...(selectedItems.length ? selectedItems.flatMap((item) => [`### ${item.label}`, item.content, ""]) : ["- 선택한 API 없음"]),
    "## 선택한 작성 샘플",
    ...(selectedSampleKeys.length ? selectedSampleKeys.map((sampleKey) => `- GET ${base}/samples/${sampleKey}: ${sampleKey} Lexical 작성 구조 참고`) : ["- 선택한 샘플 없음"]),
    "",
    "## 작업 방식",
    "먼저 최신 context와 version을 조회하고, 저장 시 expectedVersion을 사용하세요. 충돌(409)이면 다시 조회한 최신 version으로 반영하세요.",
  ].join("\n");

  const applyPreset = (nextPreset: Exclude<ApiPreset, "custom">) => {
    setPreset(nextPreset);
    setSelectedIds(nextPreset === "basic-edit" ? ["get-context", "get-child", "create-child", "patch-child"] : []);
  };
  const toggleItem = (id: string) => {
    setPreset("custom");
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const toggleAll = () => {
    setPreset("custom");
    setSelectedIds(allSelected ? [] : items.map((item) => item.id));
  };
  const copyItem = async (item: ApiItem) => {
    try {
      await copyToClipboard([`${item.method} ${fullUrl(item.endpoint)}`, "", item.summary].join("\n"));
      setCopiedId(item.id);
      showToast("API 전체 URL과 설명을 복사했습니다.");
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      showToast("클립보드에 복사하지 못했습니다.", "error");
    }
  };
  const copyInstruction = async () => {
    try {
      await copyToClipboard(instruction);
      setInstructionCopied(true);
      showToast("Codex 작업 지시를 복사했습니다.");
      window.setTimeout(() => setInstructionCopied(false), 1600);
    } catch {
      showToast("클립보드에 복사하지 못했습니다.", "error");
    }
  };

  return (
    <ApiGuideDialogShell
      title="하위 문서 작업 API"
      description={`본문 ‘${documentTitle}’ 아래의 구현 상세 문서를 조회·추가·편집합니다.`}
      copyText={selectedGuide}
      onClose={onClose}
      ariaLabel="하위 문서 작업 API"
      contentAriaLabel="하위 문서 API 선택"
      copyLabel={`선택 항목 복사 (${selectedItems.length + selectedSampleKeys.length})`}
      headerActions={
        <button type="button" onClick={() => void copyInstruction()} className="ui-icon-button h-8 gap-1.5 px-3 text-xs font-black text-brand-primary">
          {instructionCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {instructionCopied ? "지시문 복사됨" : "지시문 복사"}
        </button>
      }
      footer="본문은 목표·범위·완료 조건만 관리합니다. 실제 구현 기록은 하위 문서에 작성합니다."
    >
      <div className="grid min-h-full min-w-0 grid-cols-1 lg:grid-cols-2">
        <section className="min-h-0 overflow-auto border-b border-surface-border-soft bg-surface-raised p-5 lg:border-b-0 lg:border-r">
          <label className="block">
            <span className="mb-1 block text-sm font-black text-text-primary">추가 지시</span>
            <span className="mb-2 block text-[11px] font-semibold leading-5 text-text-muted">선택한 API와 샘플에 함께 넣을 작업 조건을 작성하세요.</span>
            <textarea value={additionalInstruction} onChange={(event) => setAdditionalInstruction(event.target.value)} rows={5} placeholder="예: 기존 문서 구조를 따르고, 중복 하위 문서는 만들지 마세요." className="w-full resize-y rounded-lg border border-surface-border-soft bg-surface p-3 text-xs leading-5 text-text-primary outline-none focus:border-brand-border" />
          </label>

          <div className="mb-2 mt-5 flex items-center justify-between gap-3">
            <h3 className="text-sm font-black text-text-primary">하위 문서 API</h3>
            <div className="flex rounded-lg border border-surface-border-soft bg-surface-muted p-1" role="group" aria-label="하위 문서 API 선택 프리셋">
              <button type="button" onClick={() => applyPreset("default")} className={`rounded-md px-3 py-1.5 text-[11px] font-black transition ${preset === "default" ? "bg-brand-primary text-white shadow-sm" : "text-text-muted hover:bg-white hover:text-text-primary"}`}>디폴트</button>
              <button type="button" onClick={() => applyPreset("basic-edit")} className={`rounded-md px-3 py-1.5 text-[11px] font-black transition ${preset === "basic-edit" ? "bg-brand-primary text-white shadow-sm" : "text-text-muted hover:bg-white hover:text-text-primary"}`}>기본 편집 (4)</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-surface-border-soft">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead className="bg-surface-muted text-text-secondary">
                <tr><th scope="col" className="w-12 px-3 py-3 text-center font-black"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="모든 API 선택" className="size-4 accent-brand-primary" /></th><th scope="col" className="w-16 px-3 py-3 font-black">방식</th><th scope="col" className="min-w-48 px-3 py-3 font-black">API</th><th scope="col" className="min-w-52 px-3 py-3 font-black">하는 일</th><th scope="col" className="w-16 px-3 py-3 text-center font-black">복사</th></tr>
              </thead>
              <tbody>{items.map((item) => <tr key={item.id} className="border-t border-surface-border-soft align-top hover:bg-surface-muted/60"><td className="!align-middle px-3 py-3 text-center"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={() => toggleItem(item.id)} aria-label={`${item.label} 선택`} className="size-4 accent-brand-primary" /></td><td className="px-3 py-3"><span className={`rounded px-1.5 py-1 font-mono text-[10px] font-black ${methodClass[item.method]}`}>{item.method}</span></td><td className="break-words px-3 py-3 font-mono text-[11px] leading-5 text-text-primary [overflow-wrap:anywhere]">{item.endpoint}</td><td className="px-3 py-3 font-semibold leading-5 text-text-muted">{item.summary}</td><td className="!align-middle px-2 py-3 text-center"><button type="button" onClick={() => void copyItem(item)} aria-label={`${item.label} API URL과 설명 복사`} title="HTTP 메서드, 전체 URL, 설명 복사" className="ui-icon-button size-7 text-brand-primary">{copiedId === item.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button></td></tr>)}</tbody>
            </table>
          </div>

          <details className="mt-4 rounded-lg border border-surface-border-soft" open>
            <summary className="cursor-pointer px-3 py-2 text-xs font-black text-text-primary">작성 샘플 참고</summary>
            <div className="border-t border-surface-border-soft"><ImplementationNoteSamplePreview selectedKeys={selectedSampleKeys} onSelectedKeysChange={setSelectedSampleKeys} showInlinePreview={false} /></div>
          </details>
        </section>
        <section aria-label="Codex 작업 지시 미리보기" className="flex min-h-0 flex-col bg-surface-muted/20 p-5">
          <div className="mb-2 flex items-center justify-between gap-3"><div><h3 className="text-sm font-black text-text-primary">Codex에 보낼 작업 지시</h3><p className="mt-1 text-[11px] font-semibold text-text-muted">선택 항목과 추가 지시에 따라 즉시 갱신됩니다.</p></div><button type="button" onClick={() => void copyInstruction()} className="ui-icon-button-brand h-8 gap-1.5 px-2.5 text-[11px] font-black">{instructionCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{instructionCopied ? "복사됨" : "전체 복사"}</button></div>
          <textarea value={instruction} readOnly aria-label="생성된 Codex 작업 지시" className="min-h-[560px] flex-1 resize-y rounded-lg border border-surface-border-soft bg-surface-raised p-3 font-mono text-[11px] leading-5 text-text-secondary outline-none" />
        </section>
      </div>
    </ApiGuideDialogShell>
  );
}
