import { BookmarkButton } from "@/features/hospital-playbook/bookmarks";
import { buildDocumentDeepLink } from "@/features/hospital-playbook/document-deep-link";
import {
  DragDropProvider,
  type DragEndEvent,
} from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { documentOrderAfterDrop, documentSortableGroup } from "../../features/hospital-playbook/document-order";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookCopy,
  Braces,
  ChevronDown,
  ChevronRight,
  FileText,
  GripVertical,
  Loader2,
  MapPin,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  playbookApi,
  type PlaybookCategory,
  type PlaybookDocumentSummary,
  type PlaybookDomain,
} from "../../features/hospital-playbook/api";
import { copyToClipboard } from "../../shared/lib/clipboard";
import PageHeader from "../../shared/ui/PageHeader";
import { LexicalEditor } from "../../shared/ui/lexical/lexical-editor";
import { useToast } from "../../shared/ui/toast";
import RegisterDocumentSampleDialog from "./RegisterDocumentSampleDialog";

type DocumentRow = {
  document: PlaybookDocumentSummary;
  depth: number;
  indexPath: number[];
  visible: boolean;
};

function sameSet(left: Set<number>, right: Set<number>) {
  return left.size === right.size && [...left].every((id) => right.has(id));
}

function rowsFor(documents: PlaybookDocumentSummary[], collapsed: Set<number>) {
  const children = new Map<number, PlaybookDocumentSummary[]>();
  const roots: PlaybookDocumentSummary[] = [];
  documents.forEach((document) => {
    if (document.parentId === null) roots.push(document);
    else
      children.set(document.parentId, [
        ...(children.get(document.parentId) ?? []),
        document,
      ]);
  });
  const rows: DocumentRow[] = [];
  const visit = (
    items: PlaybookDocumentSummary[],
    depth: number,
    path: number[] = [],
    visible = true,
  ) => {
    items.forEach((document, index) => {
      const indexPath = [...path, index + 1];
      rows.push({ document, depth, indexPath, visible });
      visit(
        children.get(document.id) ?? [],
        depth + 1,
        indexPath,
        visible && !collapsed.has(document.id),
      );
    });
  };
  visit(roots, 0);
  return { rows, children };
}

function SortableDocumentRow({
  row,
  activeId,
  collapsed,
  children,
  onToggle,
  onNavigate,
}: {
  row: DocumentRow;
  activeId: number;
  collapsed: Set<number>;
  children: Map<number, PlaybookDocumentSummary[]>;
  onToggle: (id: number) => void;
  onNavigate: (id: number) => void;
}) {
  const { document, depth, indexPath, visible } = row;
  const {
    ref,
    handleRef,
    isDragSource,
    isDropTarget,
  } = useSortable({
    id: document.id,
    group: documentSortableGroup(document),
    type: documentSortableGroup(document),
    accept: documentSortableGroup(document),
    index: indexPath.at(-1)! - 1,
  });
  const hasChildren = (children.get(document.id)?.length ?? 0) > 0;
  const isActive = document.id === activeId;

  return (
    <div
      ref={ref}
      style={{
        paddingLeft: `${8 + depth * 22}px`,
      }}
      className={`${visible ? "flex" : "hidden"} min-h-10 items-center gap-1.5 rounded-md pr-2 transition-[background-color,box-shadow,opacity] duration-200 ${isDragSource ? "z-10 scale-[1.02] opacity-60 shadow-lg ring-2 ring-brand-border/40" : ""} ${isDropTarget && !isDragSource ? "bg-brand-glass ring-2 ring-brand-border/60" : ""} ${isActive ? "border-l-2 border-brand-border bg-brand-glass" : "hover:bg-surface-muted"}`}
    >
      <button
        type="button"
        ref={handleRef}
        className="grid size-5 shrink-0 cursor-grab touch-none place-items-center text-text-muted active:cursor-grabbing"
        title="드래그하여 같은 단계에서 순서 변경"
        aria-label={`${document.title} 드래그`}
      >
        <GripVertical className="size-3.5" />
      </button>
      {hasChildren ? (
        <button
          type="button"
          onClick={() => onToggle(document.id)}
          className="grid size-5 shrink-0 place-items-center text-text-muted"
          title={
            collapsed.has(document.id) ? "하위 문서 펼치기" : "하위 문서 접기"
          }
        >
          {collapsed.has(document.id) ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronDown className="size-3.5" />
          )}
        </button>
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <button
        type="button"
        onClick={() => onNavigate(document.id)}
        className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
      >
        <span className="rounded border border-surface-border-soft bg-surface-raised px-1 py-0.5 text-[10px] font-black text-text-muted">
          {indexPath.join(".")}
        </span>
        <FileText
          className={`size-3.5 shrink-0 ${isActive ? "text-brand-primary" : "text-text-muted"}`}
        />
        <span
          className={`${isActive ? "text-brand-primary" : "text-text-secondary"} truncate text-xs font-black`}
        >
          {document.title}
        </span>
      </button>
      {hasChildren && (
        <span className="shrink-0 rounded-md bg-surface-raised px-1.5 py-1 text-[10px] font-black text-text-muted">
          {children.get(document.id)?.length}개
        </span>
      )}
    </div>
  );
}

/** 목록 화면에서 독립적으로 읽고, 위치를 옮기고, 순서를 조절하는 전체 문서 보기. */
export default function DocumentPage({
  documentId,
  domain,
  title,
  categoryTitle,
  topicTitle,
  categoryId,
  topicId,
  categories,
  documents,
  onClose,
  onNavigate,
  onChangeLocation,
  onReorder,
  onRefresh,
  onEdit,
  onOpenContentApi,
  onDelete,
  deleting = false,
  reordering = false,
  canDelete = true,
}: {
  documentId: number;
  domain: PlaybookDomain;
  title: string;
  categoryTitle: string;
  topicTitle: string;
  categoryId: number;
  topicId: number;
  categories: PlaybookCategory[];
  documents: PlaybookDocumentSummary[];
  onClose: () => void;
  onNavigate: (id: number) => void;
  onChangeLocation: (
    categoryId: number,
    topicId: number,
    documentId: number,
  ) => void;
  onReorder: (ids: number[], parentId: number | null) => Promise<unknown>;
  onRefresh: () => void;
  onEdit: (id: number) => void;
  onOpenContentApi: (id: number) => void;
  onDelete: (id: number) => void;
  deleting?: boolean;
  reordering?: boolean;
  canDelete?: boolean;
}) {
  const { showToast } = useToast();
  const [collapsed, setCollapsed] = useState<Set<number>>(
    () =>
      new Set(
        documents
          .filter((item) => item.parentId !== null)
          .map((item) => item.parentId as number),
      ),
  );
  const [locationOpen, setLocationOpen] = useState(false);
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const collapsedTopicId = useRef(topicId);
  const [nextCategoryId, setNextCategoryId] = useState(categoryId);
  const [nextTopicId, setNextTopicId] = useState(topicId);
  const document = useQuery({
    queryKey: ["hospital-playbook", "document", documentId],
    queryFn: () => playbookApi.document(documentId),
  });

  const { rows, children } = useMemo(
    () => rowsFor(documents, collapsed),
    [documents, collapsed],
  );
  const nextCategory = useMemo(
    () => categories.find((item) => item.id === nextCategoryId),
    [categories, nextCategoryId],
  );
  const nextTopics = nextCategory?.topics ?? [];

  useEffect(() => {
    const parentIds = new Set(
      documents.flatMap((item) =>
        item.parentId === null ? [] : [item.parentId],
      ),
    );
    const isNewTopic = collapsedTopicId.current !== topicId;
    collapsedTopicId.current = topicId;
    setCollapsed((current) => {
      const next = isNewTopic
        ? parentIds
        : new Set([...current].filter((id) => parentIds.has(id)));
      return sameSet(current, next) ? current : next;
    });
  }, [topicId, documents]);

  const toggleCollapsed = (id: number) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openLocation = () => {
    setNextCategoryId(categoryId);
    setNextTopicId(topicId);
    setLocationOpen(true);
  };
  const copyDocumentLink = async () => {
    const url = buildDocumentDeepLink(documentId, document.data?.location?.spaceCode ?? domain);
    if (!url) {
      showToast("문서 링크를 만들지 못했습니다.", "error");
      return;
    }
    await copyToClipboard(url);
    setLinkCopied(true);
    showToast("이 문서를 여는 앱 링크를 복사했습니다.");
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  const handleCategory = (id: number) => {
    setNextCategoryId(id);
    setNextTopicId(
      categories.find((item) => item.id === id)?.topics[0]?.id ?? 0,
    );
  };

  const confirmLocation = () => {
    const nextTopic = nextTopics.find((item) => item.id === nextTopicId);
    const nextDocument =
      nextTopic?.documents.find((item) => item.parentId === null) ??
      nextTopic?.documents[0];
    if (!nextDocument) return;
    setLocationOpen(false);
    onChangeLocation(nextCategoryId, nextTopicId, nextDocument.id);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const order = documentOrderAfterDrop(documents, event);
    if (order) await onReorder(order.ids, order.parentId);
  };

  const refresh = async () => {
    await document.refetch();
    onRefresh();
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader hideRefresh>
        <FileText className="size-4 text-brand-primary" />
        <span className="text-[14px] font-bold tracking-tight text-text-primary">
          {title}
        </span>
        <span className="text-[12px] font-semibold text-text-muted">
          페이지 보기
        </span>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={document.isFetching}
          className="ui-icon-button ml-1 size-7 disabled:opacity-40"
          title="문서 새로고침"
        >
          <RefreshCw
            className={`size-3.5 ${document.isFetching ? "animate-spin" : ""}`}
          />
        </button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted p-3">
        <main className="mx-auto grid w-full max-w-[1800px] gap-3 lg:grid-cols-[420px_minmax(0,1fr)]">
          <button
            type="button"
            onClick={onClose}
            className="ui-icon-button h-9 w-fit gap-1.5 border-brand-border px-3 text-xs font-black text-brand-primary hover:bg-brand-glass lg:col-span-2"
          >
            <ArrowLeft className="size-4" /> 목록으로
          </button>
          <aside className="h-fit rounded-lg border border-surface-border bg-surface-raised p-2 shadow-sm lg:sticky lg:top-0 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
            <div className="flex items-center justify-between border-b border-surface-border-soft px-2 py-2">
              <div>
                <h2 className="text-sm font-black text-text-primary">
                  문서 목록
                </h2>
                <p className="mt-0.5 text-[10px] font-semibold text-text-muted">
                  같은 단계에서 드래그해 순서를 바꿉니다.
                </p>
              </div>
              <span className="rounded-md bg-surface-muted px-2 py-1 text-[10px] font-black text-text-muted">
                {rows.length}
              </span>
            </div>
            <DragDropProvider onDragEnd={(event) => void handleDragEnd(event)}>
              <div
                className={`mt-2 grid gap-1 ${reordering ? "pointer-events-none opacity-60" : ""}`}
              >
                {rows.map((row) => (
                  <SortableDocumentRow
                    key={row.document.id}
                    row={row}
                    activeId={documentId}
                    collapsed={collapsed}
                    onToggle={toggleCollapsed}
                    onNavigate={onNavigate}
                  >
                    {children}
                  </SortableDocumentRow>
                ))}
              </div>
            </DragDropProvider>
          </aside>
          <section className="min-w-0 overflow-hidden rounded-lg border border-surface-border bg-surface-raised shadow-sm">
            {document.isPending ? (
              <div className="grid min-h-[560px] place-items-center text-text-muted">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : document.isError || !document.data ? (
              <div className="grid min-h-[560px] place-items-center text-sm font-bold text-destructive">
                문서를 불러오지 못했습니다.
              </div>
            ) : (
              <>
                <header className="flex items-start justify-between gap-3 border-b border-surface-border px-5 py-4">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={openLocation}
                      className="flex items-center gap-1 text-left text-[11px] font-black text-brand-primary hover:underline"
                      title="문서 위치 선택"
                    >
                      <MapPin className="size-3.5" /> {categoryTitle} &gt;{" "}
                      {topicTitle}
                    </button>
                    <h1 className="mt-1 text-xl font-black text-text-primary">
                      {document.data.title}
                    </h1>
                    <p className="mt-1 text-[11px] font-semibold text-text-muted">
                      최종 수정{" "}
                      {new Date(document.data.updatedAt).toLocaleString(
                        "ko-KR",
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <BookmarkButton document={document.data} />
                    <button
                      type="button"
                      onClick={() => void copyDocumentLink()}
                      className="ui-icon-button h-8 min-w-[76px] justify-center px-2.5 text-[11px] font-black"
                      title="앱 문서 링크 복사"
                      aria-label="앱 문서 링크 복사"
                    >
                      {linkCopied ? "복사됨" : "링크 복사"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenContentApi(documentId)}
                      className="ui-icon-button h-8 gap-1 px-2.5 text-[11px] font-black text-brand-primary"
                      title="본문 편집 지시"
                    >
                      <span>본문 편집</span>
                      <Braces className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSampleDialogOpen(true)}
                      disabled={!document.data.content.trim()}
                      className="ui-icon-button h-8 gap-1 px-2.5 text-[11px] font-black text-brand-primary disabled:opacity-45"
                      title="현재 본문을 샘플로 등록"
                      aria-label="현재 본문을 샘플로 등록"
                    >
                      <BookCopy className="size-3.5" />
                      샘플 등록
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(documentId)}
                      className="ui-icon-button-brand h-8 min-w-[58px] justify-center px-2.5 text-[11px] font-black"
                      title="수정"
                    >
                      수정
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => onDelete(documentId)}
                        disabled={deleting}
                        className="ui-icon-button size-8 text-destructive disabled:opacity-40"
                        title="삭제"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </header>
                <div className="p-4">
                  {document.data.content.trim() ? (
                    <LexicalEditor
                      key={`${document.data.id}-${document.data.version}`}
                      initialState={document.data.content}
                      onChange={() => undefined}
                      readOnly
                      minHeight="620px"
                    />
                  ) : (
                    <div className="grid min-h-[620px] place-items-center rounded-md border border-dashed border-surface-border bg-surface-muted text-center">
                      <div>
                        <p className="font-black text-text-primary">
                          아직 작성된 내용이 없습니다.
                        </p>
                        <button
                          type="button"
                          onClick={() => onEdit(documentId)}
                          className="mt-2 text-sm font-black text-brand-primary hover:underline"
                        >
                          지금 작성하기
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </section>
        </main>
      </div>
      {sampleDialogOpen && document.data && (
        <RegisterDocumentSampleDialog
          key={documentId}
          documentId={documentId}
          documentTitle={document.data.title}
          onClose={() => setSampleDialogOpen(false)}
        />
      )}
      {locationOpen && (
        <div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="문서 위치 선택"
        >
          <div className="w-full max-w-[680px] rounded-lg border border-surface-border bg-surface-raised p-5 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-text-primary">
                  문서 위치 선택
                </h2>
                <p className="mt-1 text-xs font-semibold text-text-muted">
                  선택한 주제의 첫 문서로 이동합니다.
                </p>
              </div>
              <MapPin className="size-5 text-brand-primary" />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <span className="flex items-center justify-between text-xs font-black text-text-primary">
                  <span>1차 노트 영역</span>
                  <span className="text-[10px] text-text-muted">
                    {categories.length}개
                  </span>
                </span>
                <div className="min-h-40 space-y-1 rounded-md border border-surface-border-soft bg-surface-muted p-1.5">
                  {categories.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleCategory(item.id)}
                      className={`w-full rounded-md px-3 py-2.5 text-left text-xs font-black transition-colors ${item.id === nextCategoryId ? "border-l-2 border-brand-border bg-brand-glass text-brand-primary" : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"}`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-w-0 space-y-2">
                <span className="flex items-center justify-between text-xs font-black text-text-primary">
                  <span>2차 노트 주제</span>
                  <span className="text-[10px] text-text-muted">
                    {nextTopics.length}개
                  </span>
                </span>
                <div className="min-h-40 space-y-1 rounded-md border border-surface-border-soft bg-surface-muted p-1.5">
                  {nextTopics.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setNextTopicId(item.id)}
                      className={`w-full rounded-md px-3 py-2.5 text-left text-xs font-black transition-colors ${item.id === nextTopicId ? "border-l-2 border-brand-border bg-brand-glass text-brand-primary" : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"}`}
                    >
                      {item.title}
                    </button>
                  ))}
                  {!nextTopics.length && (
                    <p className="px-2 py-3 text-xs font-bold text-text-muted">
                      선택한 영역에 주제가 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setLocationOpen(false)}
                className="ui-icon-button h-9 px-3 text-xs font-black"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmLocation}
                disabled={
                  !nextTopicId ||
                  !nextTopics.find((item) => item.id === nextTopicId)?.documents
                    .length
                }
                className="ui-icon-button-brand h-9 px-3 text-xs font-black disabled:opacity-40"
              >
                이동
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
