/* eslint-disable react-hooks/set-state-in-effect -- drawer state resets when the selected document changes. */
import { BookmarkButton } from "@/features/hospital-playbook/bookmarks";
import { buildDocumentDeepLink } from "@/features/hospital-playbook/document-deep-link";
import { BookCopy, Braces, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Loader2, MoreHorizontal, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlaybookDocument, PlaybookDocumentSummary } from "../../features/hospital-playbook/api";
import type { PlaybookDomain } from "../../features/hospital-playbook/api";
import { playbookApi } from "../../features/hospital-playbook/api";
import { ApiError, getApiBase } from "../../shared/api/client";
import { copyToClipboard } from "../../shared/lib/clipboard";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "../../shared/ui/dropdown-menu";
import { LexicalEditor } from "../../shared/ui/lexical/lexical-editor";
import { useToast } from "../../shared/ui/toast";
import DocumentComments from "./DocumentComments";
import DocumentLocationDialog from "./DocumentLocationDialog";
import DocumentPane from "./DocumentPane";
import RegisterDocumentSampleDialog from "./RegisterDocumentSampleDialog";

const DRAWER_SIZE_KEY = "pkt-study-document-drawer-size";
const DRAWER_SIZES = [
  { label: "S", value: 40 },
  { label: "M", value: 60 },
  { label: "L", value: 80 },
  { label: "XL", value: 92 },
] as const;

function storedDrawerSize() {
  const value = Number(window.localStorage.getItem(DRAWER_SIZE_KEY));
  return DRAWER_SIZES.some((size) => size.value === value) ? value : 60;
}

/** 문서를 읽고 같은 드로어 안에서 바로 수정할 수 있는 우측 드로어. */
function DocumentDrawer({
  document,
  domain,
  previous,
  next,
  onNavigate,
  onDelete,
  onClose,
  onOpenPage,
  onOpenContentApi,
  onOpenApiDesign,
  onChanged,
  onRefresh,
  documents,
  onMove,
  onMoveToTopic,
  deleting = false,
  deleteError,
  loading = false,
  canDelete = true,
}: {
  document: PlaybookDocument;
  domain: PlaybookDomain;
  previous?: PlaybookDocument;
  next?: PlaybookDocument;
  onNavigate: (document: PlaybookDocument) => void;
  onDelete: () => void;
  onClose: () => void;
  onOpenPage?: () => void;
  onOpenContentApi: () => void;
  onOpenApiDesign: () => void;
  onChanged: () => void;
  onRefresh: () => Promise<unknown>;
  documents: PlaybookDocumentSummary[];
  onMove: (parentId: number | null) => Promise<void>;
  onMoveToTopic: () => void;
  deleting?: boolean;
  deleteError?: string;
  loading?: boolean;
  canDelete?: boolean;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [drawerSize, setDrawerSize] = useState(storedDrawerSize);
  const { showToast } = useToast();
  const [isSharing, setIsSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [agentCopied, setAgentCopied] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClosing(false);
    setIsEditing(false);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchMatchIndex(0);
    setSearchMatchCount(0);
    setMoreActionsOpen(false);
    setSampleDialogOpen(false);
  }, [document.id]);

  const drawerWidth =
    drawerSize === 40
      ? "clamp(620px, 46vw, 800px)"
      : drawerSize === 60
        ? "clamp(760px, 62vw, 1080px)"
        : drawerSize === 80
          ? "clamp(900px, 80vw, 1440px)"
          : "clamp(1040px, 92vw, 1680px)";

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchMatchIndex(0);
    setSearchMatchCount(0);
  }, []);

  const openSearch = useCallback(() => {
    if (isEditing || !document.content.trim()) return;
    setSearchOpen(true);
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [document.content, isEditing]);

  const selectSearchMatch = (index: number) => {
    if (!searchMatchCount) return;
    setSearchMatchIndex((index + searchMatchCount) % searchMatchCount);
  };

  const moveSearchMatch = (direction: 1 | -1) => {
    selectSearchMatch(searchMatchIndex + direction);
  };

  const refreshDocument = async () => {
    if (isRefreshing) return;
    const startedAt = performance.now();
    setIsRefreshing(true);
    try {
      await onRefresh();
      showToast("문서를 새로고침했습니다.");
    } catch {
      showToast("문서를 새로고침하지 못했습니다.", "error");
    } finally {
      // 빠른 로컬 응답에서도 상단 새로고침과 같은 한 번의 회전 피드백을 끝까지 보여 준다.
      const remaining = 650 - (performance.now() - startedAt);
      if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
      setIsRefreshing(false);
    }
  };

  const copyShareLink = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      const { token } = await playbookApi.shareDocument(document.id);
      const url = `${getApiBase()}/api/public/hospital-playbook/documents/${token}`;
      await copyToClipboard(url);
      setShareCopied(true);
      showToast("공유 링크를 복사했습니다.");
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch (error) {
      showToast(error instanceof ApiError ? `공유 링크 발급 실패: ${error.message}` : "클립보드에 복사하지 못했습니다.", "error");
    } finally {
      setIsSharing(false);
    }
  };

  const copyDocumentLink = async () => {
    const url = buildDocumentDeepLink(document.id, document.location?.spaceCode ?? domain);
    if (!url) {
      showToast("문서 링크를 만들지 못했습니다.", "error");
      return;
    }
    await copyToClipboard(url);
    setLinkCopied(true);
    showToast("이 문서를 여는 앱 링크를 복사했습니다.");
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  const copyAgentConnection = async () => {
    const base = `${window.location.origin}${getApiBase()}/api/llm/hospital-playbook/documents/${document.id}`;
    const value = [
      `# ${document.title} 조회·수정 API`,
      `documentId: ${document.id}`,
      `parentId: ${document.parentId ?? "null"}`,
      `expectedVersion: ${document.version}`,
      "",
      `GET ${base}`,
      "수정 전에 제목·Lexical 본문·parentId·최신 version을 확인합니다.",
      "",
      `PATCH ${base}/content`,
      "Content-Type: application/json",
      "",
      JSON.stringify({
        title: document.title,
        content: "Lexical EditorState JSON 문자열",
        expectedVersion: document.version,
        parentId: document.parentId,
      }, null, 2),
      "",
      "409 충돌이면 GET으로 최신 version을 다시 확인한 뒤 PATCH합니다.",
    ].join("\n");
    try {
      await copyToClipboard(value);
      setAgentCopied(true);
      showToast("Agent용 문서 조회·수정 정보를 한 번에 복사했습니다.");
      window.setTimeout(() => setAgentCopied(false), 1800);
    } catch {
      showToast("Agent 연결 정보를 클립보드에 복사하지 못했습니다.", "error");
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "f" &&
        !isEditing &&
        document.content.trim()
      ) {
        event.preventDefault();
        openSearch();
        return;
      }
      if (event.key === "Escape") {
        if (sampleDialogOpen) {
          setSampleDialogOpen(false);
          return;
        }
        if (searchOpen) {
          closeSearch();
          return;
        }
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [document.content, isEditing, sampleDialogOpen, searchOpen, handleClose, closeSearch, openSearch]);

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-black/25 ${
        isClosing ? "animate-drawer-fade-out" : "animate-drawer-fade-in"
      }`}
      onMouseDown={handleClose}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${document.title} 상세 보기`}
        onMouseDown={(event) => event.stopPropagation()}
        className={`relative flex h-full w-full max-w-[760px] flex-col border-l border-surface-border bg-surface-raised shadow-2xl transition-[width] duration-300 ease-in-out ${
          isClosing ? "animate-drawer-slide-out" : "animate-drawer-slide-in"
        }`}
        style={{ width: drawerWidth, maxWidth: "100vw" }}
      >
        {loading && (
          <div className="absolute inset-0 z-30 grid place-items-center bg-surface-raised/75 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-4 py-3 text-sm font-bold text-text-secondary shadow-lg">
              <Loader2 className="size-4 animate-spin text-brand-primary" />
              문서를 불러오는 중...
            </div>
          </div>
        )}
        <div className="absolute left-0 z-20 flex -translate-x-full -translate-y-1/2 flex-col items-center gap-0.5 rounded-l-xl border border-r-0 border-surface-border bg-surface-raised p-1.5 shadow-[-4px_0_14px_rgba(0,0,0,0.07)]" style={{ top: "26%" }} aria-label="상세 보기 너비">
          {DRAWER_SIZES.map((size) => <button key={size.label} type="button" aria-label={`드로어 크기 ${size.label}`} title={`너비 ${size.label} (${size.value}%)`} aria-pressed={drawerSize === size.value} onClick={() => { setDrawerSize(size.value); window.localStorage.setItem(DRAWER_SIZE_KEY, String(size.value)); }} className={`grid size-8 place-items-center rounded-lg text-[11px] font-black transition-all ${drawerSize === size.value ? "bg-brand-primary text-white shadow-xs" : "text-text-muted hover:bg-surface-muted hover:text-text-primary"}`}>{size.label}</button>)}
        </div>
        <header className="relative shrink-0 border-b border-surface-border bg-surface-raised">
          <div className="flex min-h-[64px] items-center gap-3 px-5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-black text-brand-primary">개발 노트 · {isEditing ? "수정" : "상세 보기"}</p>
              {!isEditing && <h2 className="mt-0.5 truncate text-lg font-black text-text-primary">{document.title}</h2>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button type="button" className={`ui-icon-button size-8 ${searchOpen ? "border-emerald-500 bg-emerald-50 text-emerald-600" : "text-text-muted"}`} onClick={searchOpen ? closeSearch : openSearch} disabled={isEditing || !document.content.trim()} title="본문 검색 (⌘/Ctrl+F)" aria-label="본문 검색" aria-pressed={searchOpen}><Search className="size-3.5" /></button>
              <button type="button" className="ui-icon-button size-8 text-text-muted transition-colors hover:text-brand-primary disabled:opacity-40" onClick={() => void refreshDocument()} disabled={isRefreshing} title="문서 새로고침" aria-label="문서 새로고침"><RefreshCw className={`size-4 ${isRefreshing ? "refresh-icon-spin" : ""}`} /></button>
              <BookmarkButton document={document} />
              <button type="button" className="ui-icon-button h-8 gap-1 px-2.5 text-[11px] font-black text-brand-primary" onClick={onOpenContentApi} title="본문 편집 지시" aria-label="본문 편집 지시"><span>본문 편집</span><Braces className="size-3.5" /></button>
              <button type="button" className="ui-icon-button h-8 gap-1 px-2.5 text-[11px] font-black text-brand-primary disabled:opacity-45" onClick={() => setSampleDialogOpen(true)} disabled={isEditing || !document.content.trim()} title="현재 본문을 샘플로 등록" aria-label="현재 본문을 샘플로 등록"><BookCopy className="size-3.5" /><span>샘플 등록</span></button>
              <button type="button" className={`ui-icon-button h-8 px-2.5 text-[11px] font-black ${isEditing ? "bg-brand-primary text-white" : ""}`} onClick={() => { closeSearch(); setIsEditing(true); }} title="수정">수정</button>
              <DropdownMenu
                open={moreActionsOpen}
                onOpenChange={setMoreActionsOpen}
                trigger={<button type="button" className="ui-icon-button size-8" title="추가 도구" aria-label="추가 도구"><MoreHorizontal className="size-4" /></button>}
              >
                <DropdownMenuItem onAction={() => setLocationDialogOpen(true)} disabled={isEditing}>위치 이동</DropdownMenuItem>
                <DropdownMenuItem onAction={onMoveToTopic} disabled={isEditing}>다른 주제로 이동</DropdownMenuItem>
                {onOpenPage && <DropdownMenuItem onAction={onOpenPage}>전체 보기</DropdownMenuItem>}
                <DropdownMenuItem onAction={() => void copyDocumentLink()}>{linkCopied ? "앱 링크 복사됨" : "앱 링크 복사"}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-brand-primary" onAction={() => void copyShareLink()} disabled={isSharing}>{shareCopied ? "공유 링크 복사됨" : "공유 링크"}</DropdownMenuItem>
                <DropdownMenuItem className="text-brand-primary" onAction={() => void copyAgentConnection()}>{agentCopied ? "Agent 정보 복사됨" : "본문 조회·수정"}</DropdownMenuItem>
                <DropdownMenuItem className="gap-1 text-brand-primary" onAction={onOpenApiDesign}>API 설계 <Braces className="size-3.5" /></DropdownMenuItem>
                {canDelete ? <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive" onAction={() => setDeleteConfirmOpen(true)}><Trash2 className="mr-1 size-3.5" />삭제</DropdownMenuItem></> : null}
              </DropdownMenu>
              <button type="button" className="ui-icon-button size-8" onClick={handleClose} title="닫기" aria-label="닫기"><X className="size-4" /></button>
            </div>
          </div>
        </header>

        {searchOpen && !isEditing && (
          <div className="flex shrink-0 items-center gap-2 border-b border-surface-border-soft bg-surface-muted px-5 py-2">
            <Search className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setSearchMatchIndex(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  closeSearch();
                  return;
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  moveSearchMatch(event.shiftKey ? -1 : 1);
                }
              }}
              placeholder="본문에서 검색"
              aria-label="본문에서 검색"
              className="h-8 min-w-0 flex-1 bg-transparent text-xs font-semibold text-text-primary outline-none placeholder:text-text-muted"
            />
            <span className="shrink-0 text-[11px] font-bold text-text-muted">{searchMatchCount ? `${searchMatchIndex + 1}/${searchMatchCount}` : "0/0"}</span>
            <button type="button" onClick={() => moveSearchMatch(-1)} disabled={!searchMatchCount} className="ui-icon-button size-7 disabled:opacity-35" title="이전 검색 결과" aria-label="이전 검색 결과"><ChevronUp className="size-3.5" /></button>
            <button type="button" onClick={() => moveSearchMatch(1)} disabled={!searchMatchCount} className="ui-icon-button size-7 disabled:opacity-35" title="다음 검색 결과" aria-label="다음 검색 결과"><ChevronDown className="size-3.5" /></button>
            <button type="button" onClick={closeSearch} className="ui-icon-button size-7" title="검색 닫기" aria-label="검색 닫기"><X className="size-3.5" /></button>
          </div>
        )}

        <div ref={contentRef} className="drawer-document-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
          {isEditing ? (
            <DocumentPane
              documentId={document.id}
              onChanged={onChanged}
              onSaved={() => setIsEditing(false)}
              onCancel={() => setIsEditing(false)}
            />
          ) : document.content.trim() ? (
            <div className="drawer-document-content w-full overflow-hidden rounded-xl border border-surface-border-soft bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <LexicalEditor
                key={`${document.id}-${document.version}`}
                initialState={document.content}
                onChange={() => undefined}
                readOnly
                minHeight="240px"
                searchQuery={searchOpen ? searchQuery : ""}
                searchMatchIndex={searchMatchIndex}
                searchContainerRef={contentRef}
                onSearchMatchesChange={setSearchMatchCount}
              />
            </div>
          ) : (
            <div className="grid min-h-56 place-items-center rounded-lg border border-dashed border-surface-border bg-surface-muted px-6 text-center">
              <div>
                <p className="text-sm font-black text-text-primary">아직 작성된 내용이 없습니다.</p>
                <p className="mt-1 text-xs font-semibold text-text-muted">상단의 수정 버튼을 눌러 학습 내용을 작성하세요.</p>
              </div>
            </div>
          )}
          <p className="mt-3 text-right text-[11px] font-semibold text-text-muted">
            마지막 수정 {new Date(document.updatedAt).toLocaleString("ko-KR")}
          </p>
          <DocumentComments documentId={document.id} />
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-surface-border px-4 py-3">
          <button
            type="button"
            className="ui-icon-button h-9 gap-1.5 px-3 text-xs font-black disabled:opacity-35"
            onClick={() => previous && onNavigate(previous)}
            disabled={isEditing || !previous}
          >
            <ChevronLeft className="size-4" /> 이전 문서
          </button>
          <button
            type="button"
            className="ui-icon-button h-9 gap-1.5 px-3 text-xs font-black disabled:opacity-35"
            onClick={() => next && onNavigate(next)}
            disabled={isEditing || !next}
          >
            다음 문서 <ChevronRight className="size-4" />
          </button>
        </footer>

        {deleteConfirmOpen && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/30 p-5">
            <div className="w-full max-w-sm rounded-lg border border-surface-border bg-surface-raised p-5 shadow-xl">
              <h3 className="text-base font-black text-text-primary">문서를 삭제할까요?</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                <strong>{document.title}</strong> 문서와 하위 문서, 댓글을 함께 삭제합니다. 삭제 후 복구할 수 없습니다.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" onClick={() => setDeleteConfirmOpen(false)} className="ui-icon-button h-9 px-3 text-xs font-black">취소</button>
                <button type="button" disabled={deleting} onClick={onDelete} className="ui-icon-button-danger h-9 px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50">
                  {deleting ? "삭제 중..." : "삭제"}
                </button>
              </div>
              {deleteError && <p className="mt-3 text-xs font-bold text-destructive">{deleteError}</p>}
            </div>
          </div>
        )}
        {locationDialogOpen && (
          <DocumentLocationDialog
            document={document}
            documents={documents}
            onClose={() => setLocationDialogOpen(false)}
            onMove={onMove}
          />
        )}
        {sampleDialogOpen && (
          <RegisterDocumentSampleDialog
            key={document.id}
            documentId={document.id}
            documentTitle={document.title}
            onClose={() => setSampleDialogOpen(false)}
          />
        )}
      </aside>
    </div>
  );
}

export default DocumentDrawer;
