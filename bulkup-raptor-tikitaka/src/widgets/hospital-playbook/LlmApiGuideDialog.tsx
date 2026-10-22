import { useState } from "react";
import { Check, Copy, FileJson, ListTree } from "lucide-react";
import type { PlaybookDomain, PlaybookSampleKey } from "../../features/hospital-playbook/api";
import { getApiBase } from "../../shared/api/client";
import { copyToClipboard } from "../../shared/lib/clipboard";
import { useToast } from "../../shared/ui/toast";
import { ViewModeToggle } from "../../shared/ui/view-mode-toggle";
import ApiGuideDialogShell from "./ApiGuideDialogShell";
import ImplementationNoteSamplePreview from "./ImplementationNoteSamplePreview";
import { DOCUMENT_WRITING_GUIDELINES } from "./document-writing-guidelines";
import HighlightInstructionOption, { useHighlightInstruction } from "./HighlightInstructionOption";
import WritingStyleInstructionOption, { useWritingStyleInstruction } from "./WritingStyleInstructionOption";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
type ApiItem = { id: string; label: string; method: HttpMethod; endpoint: string; summary: string; content: string };

type LlmApiGuideDialogProps = {
  domain: PlaybookDomain;
  topicId?: number | null;
  topicTitle?: string | null;
  categoryTitle?: string | null;
  parentDocumentId?: number | null;
  scope: "all" | "topic";
  onClose: () => void;
};

const methodClass: Record<HttpMethod, string> = {
  GET: "bg-emerald-100 text-emerald-700",
  POST: "bg-blue-100 text-blue-700",
  PATCH: "bg-amber-100 text-amber-700",
  DELETE: "bg-rose-100 text-rose-700",
};

export default function LlmApiGuideDialog({ domain, topicId = null, topicTitle = null, categoryTitle = null, parentDocumentId = null, scope, onClose }: LlmApiGuideDialogProps) {
  const [mode, setMode] = useState<"general" | "api-design">("general");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSampleKeys, setSelectedSampleKeys] = useState<PlaybookSampleKey[]>([]);
  const [apiDesignTitle, setApiDesignTitle] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedApisCopied, setSelectedApisCopied] = useState(false);
  const [additionalInstruction, setAdditionalInstruction] = useState("");
  const highlight = useHighlightInstruction();
  const writingStyle = useWritingStyleInstruction();
  const [instructionCopied, setInstructionCopied] = useState(false);
  const { showToast } = useToast();
  const base = "/api/llm/hospital-playbook";
  const topic = String(topicId ?? "{topicId}");
  const parent = String(parentDocumentId ?? "{parentDocumentId}");

  const items: ApiItem[] = [
    {
      id: "tree", label: "현재 메뉴 위치 확인", method: "GET",
      endpoint: base + "/tree?spaceCode=" + domain,
      summary: "현재 1차·2차 메뉴와 문서 ID를 확인합니다. 새 구조를 만들기 전에 항상 사용합니다.",
      content: ["GET " + base + "/tree?spaceCode=" + domain, "", "현재 화면의 메뉴·주제·문서 ID를 확인합니다.", "같은 이름의 메뉴와 문서가 있으면 중복 생성하지 않습니다."].join("\n"),
    },
    {
      id: "topic", label: "주제와 기존 문서 확인", method: "GET",
      endpoint: base + "/topics/" + topic,
      summary: "선택한 2차 주제의 문서, parentId, 최신 version을 확인합니다.",
      content: ["GET " + base + "/topics/" + topic, "", "기존 문서와 최신 version을 확인합니다.", "문서를 수정할 때는 응답의 version을 expectedVersion으로 사용합니다."].join("\n"),
    },
    {
      id: "topic-documents", label: "주제 문서 트리와 조회 URL 확인", method: "GET",
      endpoint: base + "/topics/" + topic + "/documents",
      summary: "선택한 2차 주제의 본문·하위 문서 전체와 각 문서의 조회·context·본문 URL을 재귀적으로 확인합니다.",
      content: ["GET " + base + "/topics/" + topic + "/documents", "", "선택한 2차 주제의 최상위 문서와 모든 하위 문서를 children 트리로 반환합니다.", "각 문서의 documentUrl, contextUrl, contentUrl을 사용해 필요한 범위만 조회·수정합니다."].join("\n"),
    },
    {
      id: "move-topic", label: "2차 메뉴 이동", method: "PATCH",
      endpoint: base + "/topics/" + topic,
      summary: "2차 메뉴와 모든 하위 문서를 다른 1차 메뉴로 이동합니다.",
      content: ["PATCH " + base + "/topics/" + topic, "Content-Type: application/json", "", "{", "  \"categoryId\": 160", "}", "", "tree 조회로 확인한 같은 플레이북의 1차 메뉴 ID만 사용합니다.", "목적지에 같은 이름의 2차 메뉴가 있으면 이동하지 않습니다."].join("\n"),
    },
    {
      id: "move-document-topic", label: "다른 2차 메뉴로 문서 이동", method: "PATCH",
      endpoint: base + "/documents/{documentId}",
      summary: "문서와 하위 문서를 같은 1차 메뉴 안의 다른 2차 메뉴로 옮깁니다.",
      content: ["PATCH " + base + "/documents/{documentId}", "Content-Type: application/json", "", "{", "  \"topicId\": " + topic, "}", "", "이동 문서는 대상 2차 메뉴의 루트 문서가 되고, 하위 문서는 함께 유지됩니다."].join("\n"),
    },
    {
      id: "samples", label: "구현 노트 샘플 조회", method: "GET",
      endpoint: base + "/samples/API_IMPLEMENTATION",
      summary: "실제 파일·코드·검증을 적는 구현 기록 형식을 확인합니다.",
      content: ["GET " + base + "/samples/API_IMPLEMENTATION", "GET " + base + "/samples/FRONTEND_IMPLEMENTATION", "", "구현 기록을 만들기 전에 작업 성격에 맞는 샘플을 조회합니다."].join("\n"),
    },
    {
      id: "create-document", label: "본문 문서 만들기", method: "POST",
      endpoint: base + "/topics/" + topic + "/documents",
      summary: "2차 주제 아래에 새 본문 문서를 만듭니다. 같은 목적의 문서가 없을 때만 사용합니다.",
      content: ["POST " + base + "/topics/" + topic + "/documents", "Content-Type: application/json", "", "{", "  \"title\": \"문서 제목\",", "  \"content\": \"Lexical JSON 문자열\",", "  \"parentId\": null", "}", "", "정책·설계 문서는 목적 하나당 본문 문서 하나를 만듭니다."].join("\n"),
    },
    {
      id: "patch-content", label: "기존 본문 고치기", method: "PATCH",
      endpoint: base + "/documents/{documentId}/content",
      summary: "기존 문서의 제목·본문을 최신 version 기준으로 수정합니다.",
      content: ["PATCH " + base + "/documents/{documentId}/content", "Content-Type: application/json", "", "{", "  \"title\": \"문서 제목\",", "  \"content\": \"Lexical JSON 문자열\",", "  \"expectedVersion\": \"GET으로 확인한 최신 version\",", "  \"parentId\": null", "}", "", "409 충돌이 나면 문서를 다시 조회한 뒤 최신 version으로 다시 요청합니다."].join("\n"),
    },
    {
      id: "create-child", label: "구현 상세 문서 만들기", method: "POST",
      endpoint: base + "/topics/" + topic + "/children",
      summary: "긴 구현 작업을 API·Front 같은 하위 문서로 나눌 때 사용합니다.",
      content: ["POST " + base + "/topics/" + topic + "/children", "Content-Type: application/json", "", "{", "  \"parentId\": " + parent + ",", "  \"title\": \"TODO 1. API 구현\",", "  \"content\": \"Lexical JSON 문자열\"", "}", "", "정책·기획 문서에는 하위 문서를 억지로 만들지 않습니다."].join("\n"),
    },
    {
      id: "reorder", label: "문서 순서 바꾸기", method: "POST",
      endpoint: base + "/topics/" + topic + "/documents/reorder",
      summary: "같은 부모 아래 문서의 표시 순서를 바꿉니다.",
      content: ["POST " + base + "/topics/" + topic + "/documents/reorder", "Content-Type: application/json", "", "{", "  \"ids\": [201, 202, 203],", "  \"parentId\": " + parent, "}", "", "ids에는 같은 부모를 가진 실제 문서 ID를 원하는 순서대로 넣습니다."].join("\n"),
    },
    {
      id: "delete", label: "메뉴·문서 삭제", method: "DELETE",
      endpoint: base + "/documents/{documentId}",
      summary: "대상을 다시 확인한 뒤 문서 또는 메뉴를 삭제합니다.",
      content: ["DELETE " + base + "/documents/{documentId}", "DELETE " + base + "/categories/{categoryId}", "DELETE " + base + "/topics/" + topic, "", "삭제 전에는 tree 또는 document 조회로 대상 ID와 하위 문서 범위를 확인합니다."].join("\n"),
    },
  ];

  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const isApiDesignMode = scope === "topic" && mode === "api-design";
  const topicLabel = topicTitle?.trim() || "제목 미확인";
  const categoryLabel = categoryTitle?.trim() || "1차 메뉴 미확인";
  const title = isApiDesignMode
    ? `API 설계 문서 추가 — ${topicLabel}`
    : scope === "topic"
      ? `2차 주제 편집 — ${topicLabel}`
      : "전체 노트 편집";
  const description = isApiDesignMode
    ? "API 설계 본문을 추가하거나, 같은 목적의 기존 문서를 보강합니다."
    : scope === "topic"
    ? "선택한 주제의 문서·하위 문서를 조회·작성·수정합니다."
    : "현재 영역의 전체 노트 구조와 문서를 조회·작성·수정합니다.";
  const instruction = [
    isApiDesignMode ? "다음 API 설계 문서를 작성하거나 보강해 주세요." : "다음 작업을 진행해 주세요.",
    "",
    "## 작업 대상",
    ...(scope === "topic"
      ? [
          `- 1차 메뉴: ${categoryLabel}`,
          `- 2차 주제: ${topicLabel}`,
          `- 2차 주제 ID: ${topicId ?? "확인 필요"}`,
          `- spaceCode: ${domain}`,
        ]
      : [`- 전체 노트 영역: ${domain}`]),
    "",
    isApiDesignMode ? "## API 설계 목표" : "## 작업 목표",
    isApiDesignMode ? "선택한 2차 주제의 기존 API 설계 문서를 먼저 확인합니다. 같은 목적의 문서가 있으면 최신 version을 기준으로 보강하고, 없으면 API 엔드포인트 하나당 본문 문서 하나를 만듭니다. 하위 문서는 만들지 않습니다." : scope === "topic" ? "선택한 2차 주제의 기존 문서와 하위 문서를 확인한 뒤, 필요한 문서를 조회·작성·수정합니다." : "현재 영역의 메뉴·2차 주제·문서 구조를 확인한 뒤, 필요한 노트를 조회·작성·수정합니다.",
    ...(isApiDesignMode ? ["", "## 새 API 설계 문서", `- 제목: ${apiDesignTitle.trim() || "미작성 — API 목적에 맞는 제목을 제안해 주세요."}`, "", "## API 설계 문서 기준", "- API의 목적, 범위·제외 범위, 요청 계약, 성공 응답, 서버 처리 규칙, 오류 응답 기준, 구현·검증 연결을 작성합니다.", "- 요청·성공 응답은 JSON 코드 블록으로 작성합니다.", "- 일반 설명은 기본 본문 텍스트·제목·목록으로 구성하고, 인용문은 경고·예외·결정 보류처럼 특별히 강조할 내용에만 사용합니다."] : []),
    "",
    ...DOCUMENT_WRITING_GUIDELINES,
    "", "## 설명 말투", writingStyle.instructionText,
    ...(highlight.instructionText ? ["", "## 형광펜 지침", highlight.instructionText] : []),
    ...(additionalInstruction.trim() ? ["", "## 추가 지시", additionalInstruction.trim()] : []),
    "",
    "## 선택한 API",
    ...(selectedItems.length ? selectedItems.flatMap((item) => [`### ${item.label}`, item.content, ""]) : ["- 선택한 API 없음"]),
    "",
    "## 선택한 작성 샘플",
    ...(selectedSampleKeys.length ? selectedSampleKeys.map((sampleKey) => `- GET ${base}/samples/${sampleKey}: ${sampleKey} Lexical 작성 구조 참고`) : ["- 선택한 샘플 없음"]),
    "",
    "## 작업 방식",
    isApiDesignMode ? "먼저 현재 위치와 기존 문서를 조회해 중복 생성을 피하세요. 같은 목적의 문서가 있으면 해당 본문을 GET으로 다시 조회한 뒤 최신 expectedVersion으로 저장하고, 없으면 새 본문을 만드세요. 인용문 대신 일반 본문·제목·목록·JSON 코드 블록으로 문서 위계를 구성하세요. 409 충돌이면 최신 version을 다시 조회해 반영하세요." : "먼저 현재 위치와 기존 문서를 조회해 중복 생성을 피하세요. 수정 전 최신 version을 확인하고, 저장 시 expectedVersion을 사용하세요. 충돌(409)이면 다시 조회한 최신 version으로 반영하세요.",
  ].join("\n");

  const applyQuickSelection = (ids: string[]) => setSelectedIds(ids);
  const switchMode = (nextMode: "general" | "api-design") => {
    setMode(nextMode);
    setSelectedIds(nextMode === "api-design" ? ["tree", "topic", "topic-documents", "create-document", "patch-content"] : []);
  };
  const toggleItem = (id: string) => {
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
      title={title}
      contextLabel={scope === "topic"
        ? `${categoryLabel} > ${topicLabel}`
        : `편집 범위: 전체 노트${topicTitle ? ` (현재 위치: ${categoryLabel} > ${topicLabel})` : ""}`}
      description={description}
      copyText={instruction}
      onClose={onClose}
      ariaLabel={title}
      copyLabel="지시문 복사"
      headerActions={scope === "topic" ? <ViewModeToggle value={mode} onChange={switchMode} ariaLabel="2차 주제 편집 모드" items={[{ value: "general", label: "일반 편집", icon: ListTree }, { value: "api-design", label: "API 설계", icon: FileJson }]} /> : undefined}
      footer={<p>{isApiDesignMode ? "API 설계 문서는 엔드포인트 하나당 본문 하나로 관리합니다. 실제 구현 기록은 별도 TODO에서 이어갑니다." : "API와 작성 샘플을 선택하거나 추가 지시를 입력하면 오른쪽 작업 지시가 즉시 갱신됩니다."}</p>}
    >
      <div className="grid min-h-full min-w-0 grid-cols-1 lg:grid-cols-2">
        <section className="min-h-0 overflow-auto border-b border-surface-border-soft bg-surface-raised p-5 lg:border-b-0 lg:border-r">
          {isApiDesignMode && <label className="mb-5 block"><span className="mb-1 block text-sm font-black text-text-primary">API 설계 문서 제목</span><span className="mb-2 block text-[11px] font-semibold leading-5 text-text-muted">예: 회원 가입 API 설계 — 요청·응답과 처리 흐름</span><input value={apiDesignTitle} onChange={(event) => setApiDesignTitle(event.target.value)} placeholder="API 설계 문서 제목" className="h-10 w-full rounded-lg border border-surface-border-soft bg-surface px-3 text-sm text-text-primary outline-none focus:border-brand-border" /></label>}
          <label className="mb-5 block">
            <span className="mb-1 block text-sm font-black text-text-primary">추가 지시</span>
            <span className="mb-2 block text-[11px] font-semibold leading-5 text-text-muted">선택한 API와 작성 샘플에 함께 넣을 작업 조건을 작성하세요.</span>
            <textarea value={additionalInstruction} onChange={(event) => setAdditionalInstruction(event.target.value)} rows={5} placeholder="예: 기존 문서 구조를 따르고, 중복 문서는 만들지 마세요." className="w-full resize-y rounded-lg border border-surface-border-soft bg-surface p-3 text-xs leading-5 text-text-primary outline-none focus:border-brand-border" />
          </label>
          <WritingStyleInstructionOption option={writingStyle} />
          <HighlightInstructionOption option={highlight} />
          <div className="mb-4 mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5" aria-label="자주 쓰는 API 빠른 선택">
              <span className="mr-1 text-[11px] font-black text-text-muted">빠른 선택</span>
              <button type="button" onClick={() => applyQuickSelection(scope === "topic" ? ["topic", "topic-documents"] : ["tree"])} className="rounded-md border border-surface-border-soft bg-surface-raised px-2.5 py-1.5 text-[11px] font-black text-text-secondary hover:border-brand-border hover:text-brand-primary">현재 위치 확인</button>
              <button type="button" onClick={() => applyQuickSelection(["tree", "topic", "topic-documents", "create-document", "patch-content"])} className="rounded-md border border-surface-border-soft bg-surface-raised px-2.5 py-1.5 text-[11px] font-black text-text-secondary hover:border-brand-border hover:text-brand-primary">문서 편집</button>
              <button type="button" onClick={() => applyQuickSelection(["tree", "topic", "topic-documents", "samples", "create-child"])} className="rounded-md border border-surface-border-soft bg-surface-raised px-2.5 py-1.5 text-[11px] font-black text-text-secondary hover:border-brand-border hover:text-brand-primary">구현 기록</button>
              <button type="button" onClick={() => applyQuickSelection([])} className="rounded-md px-2 py-1.5 text-[11px] font-black text-text-muted hover:text-text-primary">초기화</button>
            </div>
            <button type="button" onClick={() => void copySelectedApis()} className="ui-icon-button-brand h-8 shrink-0 gap-1.5 px-2.5 text-[11px] font-black">
              {selectedApisCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              선택 API 복사 ({selectedItems.length})
            </button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-surface-border-soft">
            <table className="w-full min-w-[790px] border-collapse text-left text-xs">
              <thead className="bg-surface-muted text-text-secondary">
                <tr><th scope="col" className="w-12 px-3 py-3 text-center font-black"><input type="checkbox" checked={allItemsSelected} onChange={toggleAllItems} aria-label="모든 API 선택" className="size-4 accent-brand-primary" /></th><th scope="col" className="w-16 px-3 py-3 font-black">방식</th><th scope="col" className="min-w-40 px-3 py-3 font-black">API</th><th scope="col" className="min-w-36 px-3 py-3 font-black">하는 일</th><th scope="col" className="w-32 px-3 py-3 text-center font-black">복사</th></tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const checked = selectedIds.includes(item.id);
                  return <tr key={item.id} className="border-t border-surface-border-soft align-top hover:bg-surface-muted/60">
                    <td className="!align-middle px-3 py-3 text-center"><input type="checkbox" checked={checked} onChange={() => toggleItem(item.id)} aria-label={item.label + " 선택"} className="size-4 accent-brand-primary" /></td>
                    <td className="px-3 py-3"><span className={"rounded px-1.5 py-1 font-mono text-[10px] font-black " + methodClass[item.method]}>{item.method}</span></td>
                    <td className="break-words px-3 py-3 font-mono text-[11px] leading-5 text-text-primary [overflow-wrap:anywhere]">{item.endpoint}</td>
                    <td className="px-3 py-3 font-semibold leading-5 text-text-muted">{item.summary}</td>
                    <td className="!align-middle px-2 py-3 text-center">
                      <div className="flex justify-center">
                        <button type="button" onClick={() => void copyApiItem(item)} aria-label={item.label + " API URL과 설명 복사"} className="ui-icon-button size-7 text-brand-primary" title="HTTP 메서드, 전체 URL, 설명 복사">{copiedId === item.id ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}</button>
                      </div>
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
          <details className="mt-6 rounded-lg border border-surface-border-soft" open>
            <summary className="cursor-pointer px-3 py-2 text-xs font-black text-text-primary">작성 샘플 참고</summary>
            <div className="border-t border-surface-border-soft"><ImplementationNoteSamplePreview selectedKeys={selectedSampleKeys} onSelectedKeysChange={setSelectedSampleKeys} showInlinePreview={false} /></div>
          </details>
        </section>
        <section aria-label="Codex 작업 지시 미리보기" className="flex min-h-0 flex-col bg-surface-muted/20 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><h3 className="text-sm font-black text-text-primary">{isApiDesignMode ? "Codex에 보낼 API 설계 요청" : "Codex에 보낼 작업 지시"}</h3><p className="mt-1 text-[11px] font-semibold text-text-muted">선택 항목과 추가 지시에 따라 즉시 갱신됩니다.</p></div>
            <button type="button" onClick={() => void copyInstruction()} className="ui-icon-button-brand h-8 gap-1.5 px-2.5 text-[11px] font-black">{instructionCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{instructionCopied ? "복사됨" : "전체 복사"}</button>
          </div>
          <textarea value={instruction} readOnly aria-label="생성된 Codex 작업 지시" className="min-h-[560px] flex-1 resize-y rounded-lg border border-surface-border-soft bg-surface-raised p-3 font-mono text-[11px] leading-5 text-text-secondary outline-none" />
        </section>
      </div>
    </ApiGuideDialogShell>
  );
}
