import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { getApiBase } from "../../shared/api/client";
import { copyToClipboard } from "../../shared/lib/clipboard";
import { useToast } from "../../shared/ui/toast";
import ApiGuideDialogShell from "./ApiGuideDialogShell";
import { DOCUMENT_WRITING_GUIDELINES } from "./document-writing-guidelines";
import LexicalSamplePreview from "./LexicalSamplePreview";

type HttpMethod = "GET" | "PATCH";
type ApiItem = { id: string; label: string; method: HttpMethod; endpoint: string; summary: string; content: string };
type AiEditConnectionDialogProps = { connection: string; documentTitle: string; isChildDocument: boolean; onClose: () => void };

const methodClass: Record<HttpMethod, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  PATCH: "bg-amber-100 text-amber-700",
};

export default function AiEditConnectionDialog({ connection, documentTitle, isChildDocument, onClose }: AiEditConnectionDialogProps) {
  const lines = connection.split("\n");
  const documentInfo = lines.filter((line) => /^(documentId|documentRole|parentId|expectedVersion):/.test(line));
  const getContent = lines.filter((line) => line.startsWith("GET ") || line.startsWith("Authorization:") || line.startsWith("TOKEN:")).join("\n");
  const patchContent = lines.filter((line) => line.startsWith("PATCH ") || line.startsWith("PATCH body:")).join("\n");
  const role = isChildDocument ? "TODO 하위 문서(이 TODO의 Step 1~N)" : "2차 주제 본문 문서(전체 TODO 계획)";
  const sampleLabel = isChildDocument ? "하위 문서 Step 1~N 샘플" : "본문 TODO 계획 샘플";
  const [selectedIds, setSelectedIds] = useState<string[]>(["get", "patch"]);
  const [sampleSelected, setSampleSelected] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedApisCopied, setSelectedApisCopied] = useState(false);
  const { showToast } = useToast();

  const items: ApiItem[] = [
    {
      id: "get",
      label: "현재 문서 조회",
      method: "GET",
      endpoint: getContent.split("\n")[0]?.replace(/^GET /, "") || "/api/llm/hospital-playbook/documents/{documentId}",
      summary: "수정 전에 이 문서의 제목·본문·parentId·최신 version을 확인합니다.",
      content: getContent || "GET /api/llm/hospital-playbook/documents/{documentId}",
    },
    {
      id: "patch",
      label: "현재 문서 본문 수정",
      method: "PATCH",
      endpoint: patchContent.split("\n")[0]?.replace(/^PATCH /, "") || "/api/llm/hospital-playbook/documents/{documentId}/content",
      summary: "조회한 최신 version을 expectedVersion으로 사용해 제목과 Lexical 본문을 저장합니다.",
      content: patchContent || "PATCH /api/llm/hospital-playbook/documents/{documentId}/content",
    },
  ];

  const toggleApi = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const allItemsSelected = selectedIds.length === items.length;
  const toggleAllItems = () => {
    setSelectedIds(allItemsSelected ? [] : items.map((item) => item.id));
  };
  const copyApiItem = async (item: ApiItem) => {
    const value = [
      `${item.method} ${window.location.origin}${getApiBase()}${item.endpoint}`,
      "",
      item.summary,
    ].join("\n");
    try {
      await copyToClipboard(value);
      setCopiedId(item.id);
      showToast("API URL과 설명을 복사했습니다.");
      window.setTimeout(() => setCopiedId(null), 1600);
    } catch {
      showToast("클립보드에 복사하지 못했습니다.", "error");
    }
  };

  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const copyText = [
    "# 개별 문서 편집 API for LLM",
    `문서: ${documentTitle}`,
    `문서 유형: ${role}`,
    ...documentInfo,
    "",
    "이 연결은 위 문서 하나만 조회·수정합니다. 다른 문서 생성·삭제·정렬 API는 포함하지 않습니다.",
    "content는 Markdown이나 HTML이 아닌 Lexical EditorState JSON 문자열입니다.",
    "GET으로 기존 문서 전체와 최신 version을 확인한 뒤 PATCH합니다.",
    DOCUMENT_WRITING_GUIDELINES.join("\n"),
    ...selectedItems.flatMap((item) => [`# ${item.label}`, "", item.content]),
    ...(sampleSelected ? ["# 참고 Lexical 샘플", `샘플 유형: ${sampleLabel}`, "현재 문서 유형에 맞는 본문 구조와 heading·quote·list 노드 구성을 참고합니다."] : []),
  ].join("\n\n---\n\n");
  const copySelectedApis = async () => {
    if (selectedItems.length === 0) {
      showToast("복사할 API를 선택하세요.", "info");
      return;
    }
    const value = selectedItems.map((item) => [
      `# ${item.label}`,
      `${item.method} ${window.location.origin}${getApiBase()}${item.endpoint}`,
      "",
      item.summary,
    ].join("\n")).join("\n\n---\n\n");
    try {
      await copyToClipboard(value);
      setSelectedApisCopied(true);
      showToast("선택한 API 정보를 복사했습니다.");
      window.setTimeout(() => setSelectedApisCopied(false), 1600);
    } catch {
      showToast("클립보드에 복사하지 못했습니다.", "error");
    }
  };

  return (
    <ApiGuideDialogShell
      title="개별 문서 편집 API for LLM"
      description={`대상 문서 · ${documentTitle}`}
      copyText={copyText}
      onClose={onClose}
      ariaLabel="개별 문서 편집 API for LLM"
      contentAriaLabel="현재 문서에 필요한 API 선택"
      previewAriaLabel="현재 문서 유형에 맞는 Lexical 샘플"
      previewTitle={sampleLabel}
      previewDescription={`${role}에 사용하는 본문 구조 샘플입니다.`}
      preview={<LexicalSamplePreview initialTab={isChildDocument ? "step1" : "todo"} />}
      copyLabel={`선택 항목 복사 (${selectedItems.length + (sampleSelected ? 1 : 0)})`}
      footer={<p><strong className="text-text-primary">선택 항목 복사</strong>는 대상 문서 정보와 체크한 API, 선택한 문서 유형의 Lexical 샘플 지침만 복사합니다.</p>}
    >
      <div className="flex min-h-full min-w-0 flex-col bg-surface-raised">
        <div className="min-h-0 flex-1 overflow-auto p-5">
          <div className="mb-4 rounded-lg border border-brand-primary/20 bg-brand-primary/5 px-4 py-3">
            <p className="text-[11px] font-black text-brand-primary">이 API가 편집하는 문서</p>
            <h3 className="mt-1 text-base font-black text-text-primary">{documentTitle}</h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-text-muted">{role}</p>
            <div className="mt-3 space-y-1 font-mono text-[11px] text-text-secondary">
              {documentInfo.map((line) => <p key={line}>{line}</p>)}
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-text-muted">이 문서의 조회·본문 수정에 필요한 API만 제공합니다. 문서 생성·삭제·정렬은 포함하지 않습니다.</p>
          </div>

          <div className="mb-2 flex justify-end">
            <button type="button" onClick={() => void copySelectedApis()} className="ui-icon-button-brand h-8 gap-1.5 px-2.5 text-[11px] font-black">
              {selectedApisCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              선택 API 복사 ({selectedItems.length})
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-surface-border-soft">
            <table className="w-full min-w-[730px] border-collapse text-left text-xs">
              <thead className="bg-surface-muted text-text-secondary">
                <tr><th scope="col" className="w-12 px-3 py-3 text-center font-black"><input type="checkbox" checked={allItemsSelected} onChange={toggleAllItems} aria-label="모든 API 선택" className="size-4 accent-brand-primary" /></th><th scope="col" className="w-16 px-3 py-3 font-black">방식</th><th scope="col" className="min-w-44 px-3 py-3 font-black">API</th><th scope="col" className="min-w-44 px-3 py-3 font-black">하는 일</th><th scope="col" className="w-32 px-3 py-3 text-center font-black">복사</th></tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const checked = selectedIds.includes(item.id);
                  return <tr key={item.id} className="border-t border-surface-border-soft align-top hover:bg-surface-muted/60">
                    <td className="!align-middle px-3 py-3 text-center"><input type="checkbox" checked={checked} onChange={() => toggleApi(item.id)} aria-label={item.label + " 선택"} className="size-4 accent-brand-primary" /></td>
                    <td className="px-3 py-3"><span className={`rounded px-1.5 py-1 font-mono text-[10px] font-black ${methodClass[item.method]}`}>{item.method}</span></td>
                    <td className="break-words px-3 py-3 font-mono text-[11px] leading-5 text-text-primary [overflow-wrap:anywhere]">{item.endpoint}</td>
                    <td className="px-3 py-3 font-semibold leading-5 text-text-muted">{item.summary}</td>
                    <td className="px-2 py-3 text-center"><button type="button" onClick={() => void copyApiItem(item)} aria-label={item.label + " API URL과 설명 복사"} className="ui-icon-button size-7 text-brand-primary" title="HTTP 메서드, 전체 URL, 설명 복사">{copiedId === item.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-surface-border-soft bg-surface-muted px-4 py-3">
            <input type="checkbox" checked={sampleSelected} onChange={(event) => setSampleSelected(event.target.checked)} className="mt-0.5 size-4 accent-brand-primary" />
            <span><strong className="block text-xs font-black text-text-primary">{sampleLabel} 포함</strong><span className="mt-1 block text-[11px] font-semibold leading-5 text-text-muted">오른쪽 미리보기와 같은 문서 유형의 Lexical 작성 구조를 복사합니다.</span></span>
          </label>
        </div>
      </div>
    </ApiGuideDialogShell>
  );
}
