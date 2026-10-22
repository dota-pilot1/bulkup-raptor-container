/* eslint-disable react-hooks/set-state-in-effect -- selection state follows the active category/topic data. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DragDropProvider,
  type DragEndEvent,
} from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { documentOrderAfterDrop, documentSortableGroup } from "../../features/hospital-playbook/document-order";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Braces,
  ChevronRight,
  ExternalLink,
  FileText,
  GitBranch,
  ListTodo,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import PageHeader from "../../shared/ui/PageHeader";
import PageHeaderSearch from "../../shared/ui/PageHeaderSearch";
import { useColumnResize } from "../../shared/lib/useColumnResize";
import ColumnResizeHandle from "../../shared/ui/ColumnResizeHandle";
import { TodoDrawer } from "../../features/todo/TodoDrawer";
import { useTodos } from "../../features/todo/useTodos";
import {
  playbookApi,
  type PlaybookCategory,
  type PlaybookDocument,
  type PlaybookDocumentSummary,
  type PlaybookDomain,
  type PlaybookTopic,
} from "../../features/hospital-playbook/api";
import { usePlaybookLayoutStore } from "../../features/hospital-playbook/layout-store";
import {
  playbookTreeKey,
  usePlaybookTree,
} from "../../features/hospital-playbook/queries";
import DocumentDrawer from "./DocumentDrawer";
import DocumentPage from "./DocumentPage";
import DocumentPane from "./DocumentPane";
import DocumentContentApiDialog from "./DocumentContentApiDialog";
import ApiDesignDocumentDialog from "./ApiDesignDocumentDialog";
import ListColumn from "./ListColumn";
import { crumbleMenu } from "./crumble-menu";
import LlmApiGuideDialog from "./LlmApiGuideDialog";
import { useToast } from "../../shared/ui/toast";
import { Dialog } from "../../shared/ui/dialog";

// 접힌 헤더에 제목·개수·펼치기 버튼이 나란히 들어갈 만큼은 남긴다. 더 좁히면 내용이 끼어 쪼그라들어 보인다.
const COLLAPSED_COLUMN_WIDTH = 148;
const EMPTY_CATEGORIES: PlaybookCategory[] = [];
const EMPTY_TOPICS: PlaybookCategory["topics"] = [];
const EMPTY_DOCUMENTS: PlaybookDocumentSummary[] = [];
const SYSTEM_GALLERY_DOMAINS: PlaybookDomain[] = [
  "UI_NAV",
  "UI_FORM",
  "UI_LAYOUT",
  "UI_STATE",
];
function reorderByIds<T extends { id: number }>(items: T[], ids: number[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return ids
    .map((id) => byId.get(id))
    .filter((item): item is T => Boolean(item));
}

type DeleteTarget = {
  kind: "category" | "topic";
  id: number;
  title: string;
  childCount: number;
};

type NewDocumentDraft = {
  topicId: number;
  parentId: number | null;
};

type MoveTopicTarget = {
  topic: PlaybookTopic;
  sourceCategoryId: number;
};

type MoveDocumentTarget = {
  document: PlaybookDocument;
  sourceTopicId: number;
};

function StructureDeleteConfirm({
  target,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  target: DeleteTarget;
  deleting: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isCategory = target.kind === "category";
  return (
    <Dialog
      title={`${isCategory ? "1차 영역" : "2차 주제"}을 삭제할까요?`}
      icon={<Trash2 className="size-4.5 text-destructive" />}
      ariaLabel={`${isCategory ? "1차 영역" : "2차 주제"} 삭제 확인`}
      zIndexClassName="z-[100]"
      onClose={onCancel}
      closeDisabled={deleting}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="ui-icon-button h-9 px-3 text-xs font-black disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="ui-icon-button-danger h-9 px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "삭제 중..." : "확인 후 삭제"}
          </button>
        </>
      }
    >
        <p className="text-sm leading-6 text-text-secondary">
          <strong className="text-text-primary">{target.title}</strong>
          {isCategory
            ? ` 영역과 하위 2차 주제 ${target.childCount}개, 본문 문서를 모두 삭제합니다.`
            : ` 주제와 본문 문서 ${target.childCount}개를 모두 삭제합니다.`}
          <br />
          삭제 후 복구할 수 없습니다.
        </p>
        {error && (
          <p className="mt-3 text-xs font-bold text-destructive">{error}</p>
        )}
    </Dialog>
  );
}

function SortableTreeDocumentRow({
  document,
  depth,
  indexPath,
  childCount,
  expanded,
  onOpen,
  onToggle,
  onAddChild,
  onOpenPage,
}: {
  document: PlaybookDocumentSummary;
  depth: number;
  indexPath: number[];
  childCount: number;
  expanded: boolean;
  onOpen: () => void;
  onToggle: () => void;
  onAddChild: () => void;
  onOpenPage: () => void;
}) {
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
  const hasChildren = childCount > 0;

  return (
    <div
      ref={ref}
      style={{
        marginLeft: `${depth * 24}px`,
      }}
      className={`flex min-h-12 items-center gap-2 rounded-md border border-surface-border-soft bg-surface-muted px-2.5 transition-[background-color,box-shadow,opacity] duration-200 hover:border-brand-border ${isDragSource ? "z-10 scale-[1.02] opacity-55 shadow-xl ring-2 ring-brand-border/50" : ""} ${isDropTarget && !isDragSource ? "border-brand-border bg-brand-glass ring-2 ring-brand-border/70" : ""}`}
    >
      <button
        type="button"
        ref={handleRef}
        className="grid size-5 shrink-0 cursor-grab touch-none place-items-center text-text-muted active:cursor-grabbing"
        title="드래그하여 같은 단계에서 순서 변경"
        aria-label={`${document.title} 드래그`}
      >
        ⠿
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-md border border-surface-border-soft bg-surface-raised text-[11px] font-black text-text-muted">
          {indexPath.join(".")}
        </span>
        <FileText className="size-4 shrink-0 text-brand-primary" />
        {depth > 0 && (
          <span className="text-xs font-bold text-brand-primary">ㄴ</span>
        )}
        <span className="truncate text-sm font-black text-text-primary">
          {document.title}
          {hasChildren && (
            <span className="ml-1.5 text-xs font-bold text-text-muted">
              ({childCount})
            </span>
          )}
        </span>
      </button>
      <span
        className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${document.hasContent ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
        title={document.hasContent ? "본문이 작성되어 있습니다." : "본문이 아직 비어 있습니다."}
      >
        {document.hasContent ? "작성됨" : "빈 본문"}
      </span>
      {hasChildren && (
        <button
          type="button"
          onClick={onToggle}
          className="ui-icon-button size-7"
          title={expanded ? "하위 문서 접기" : "하위 문서 펼치기"}
        >
          <ChevronRight
            className={
              (expanded ? "rotate-90 " : "") + "size-4 transition-transform"
            }
          />
        </button>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {depth < 1 && (
          <button
            type="button"
            onClick={onAddChild}
            className="ui-icon-button size-7 text-brand-primary"
            title="하위 문서 추가"
          >
            <GitBranch className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onOpenPage}
          className="ui-icon-button size-7"
          title="전체 페이지로 보기"
        >
          <ExternalLink className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

function flattenDocuments(documents: PlaybookDocumentSummary[]) {
  const children = new Map<number, PlaybookDocumentSummary[]>();
  const roots: PlaybookDocumentSummary[] = [];
  for (const document of documents) {
    if (document.parentId === null) roots.push(document);
    else
      children.set(document.parentId, [
        ...(children.get(document.parentId) ?? []),
        document,
      ]);
  }
  const rows: Array<{
    document: PlaybookDocumentSummary;
    depth: number;
    indexPath: number[];
  }> = [];
  const visit = (
    items: PlaybookDocumentSummary[],
    depth: number,
    parentPath: number[],
  ) => {
    items.forEach((document, index) => {
      const indexPath = [...parentPath, index + 1];
      rows.push({ document, depth, indexPath });
      visit(children.get(document.id) ?? [], depth + 1, indexPath);
    });
  };
  visit(roots, 0, []);
  return { rows, children };
}

function HospitalPlaybookModule({
  domain,
  title,
  initialCategoryId,
  initialTopicId,
  initialTopicTitle,
}: {
  domain: PlaybookDomain;
  title: string;
  initialCategoryId?: number;
  initialTopicId?: number;
  initialTopicTitle?: string;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const tree = usePlaybookTree(domain);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [topicId, setTopicId] = useState<number | null>(null);
  const [editingDocumentId, setEditingDocumentId] = useState<number | null>(
    null,
  );
  const [newDocumentDraft, setNewDocumentDraft] =
    useState<NewDocumentDraft | null>(null);
  const [drawerDocumentId, setDrawerDocumentId] = useState<number | null>(null);
  const [pageDocumentId, setPageDocumentId] = useState<number | null>(null);
  const [expandedDocumentIds, setExpandedDocumentIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [isRefreshingTree, setIsRefreshingTree] = useState(false);
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [pendingTopicSelection, setPendingTopicSelection] = useState<
    number | null
  >(null);
  const [llmApiGuideOpen, setLlmApiGuideOpen] = useState(false);
  const [llmApiGuideScope, setLlmApiGuideScope] = useState<"all" | "topic">("all");
  const [todoDrawerOpen, setTodoDrawerOpen] = useState(false);
  const [contentApiDocument, setContentApiDocument] =
    useState<PlaybookDocumentSummary | null>(null);
  const [apiDesignDocument, setApiDesignDocument] =
    useState<PlaybookDocumentSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [moveTopicTarget, setMoveTopicTarget] = useState<MoveTopicTarget | null>(null);
  const [moveDocumentTarget, setMoveDocumentTarget] = useState<MoveDocumentTarget | null>(null);
  const expandedTopicId = useRef<number | null>(null);
  const openedDeepLinkRef = useRef<string | null>(null);
  const categoryWidth = usePlaybookLayoutStore((state) => state.categoryWidth);
  const topicWidth = usePlaybookLayoutStore((state) => state.topicWidth);
  const categoryCollapsed = usePlaybookLayoutStore(
    (state) => state.categoryCollapsed,
  );
  const topicCollapsed = usePlaybookLayoutStore(
    (state) => state.topicCollapsed,
  );
  const rememberedMenu = usePlaybookLayoutStore(
    (state) => state.selectedMenus[domain],
  );
  const selectionHydrated = usePlaybookLayoutStore(
    (state) => state.selectionHydrated,
  );
  const isSystemGallery = SYSTEM_GALLERY_DOMAINS.includes(domain);
  const hydrateLayout = usePlaybookLayoutStore((state) => state.hydrate);
  const rememberSelectedMenu = usePlaybookLayoutStore(
    (state) => state.rememberSelectedMenu,
  );
  const setCategoryWidth = usePlaybookLayoutStore(
    (state) => state.setCategoryWidth,
  );
  const setTopicWidth = usePlaybookLayoutStore((state) => state.setTopicWidth);
  const toggleCategory = usePlaybookLayoutStore(
    (state) => state.toggleCategory,
  );
  const toggleTopic = usePlaybookLayoutStore((state) => state.toggleTopic);

  const categories: PlaybookCategory[] = tree.data ?? EMPTY_CATEGORIES;
  useEffect(() => {
    const saved = window.sessionStorage.getItem("pkt-study-menu-search-target");
    if (!saved) return;
    try {
      const target = JSON.parse(saved) as { spaceCode?: string; categoryId?: number; topicId?: number | null; documentId?: number };
      if (target.spaceCode !== domain || !categories.some((item) => item.id === target.categoryId)) return;
      setCategoryId(target.categoryId ?? null);
      setPendingTopicSelection(target.topicId ?? null);
      const targetDocument = categories.find((item) => item.id === target.categoryId)?.topics
        .find((item) => item.id === target.topicId)?.documents.find((item) => item.id === target.documentId);
      if (targetDocument) setPageDocumentId(targetDocument.id);
      window.sessionStorage.removeItem("pkt-study-menu-search-target");
    } catch {
      window.sessionStorage.removeItem("pkt-study-menu-search-target");
    }
  }, [categories, domain]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const documentId = Number(params.get("playbookDocument"));
    const spaceCode = params.get("spaceCode");
    const linkKey = `${spaceCode}:${documentId}`;
    if (spaceCode !== domain || !Number.isInteger(documentId) || documentId <= 0 || openedDeepLinkRef.current === linkKey) return;

    for (const nextCategory of categories) {
      for (const nextTopic of nextCategory.topics) {
        if (!nextTopic.documents.some((document) => document.id === documentId)) continue;
        openedDeepLinkRef.current = linkKey;
        setCategoryId(nextCategory.id);
        setTopicId(nextTopic.id);
        setPageDocumentId(documentId);
        return;
      }
    }
  }, [categories, domain]);
  const category = useMemo(
    () => categories.find((item) => item.id === categoryId) ?? null,
    [categories, categoryId],
  );
  const topic = useMemo(
    () => category?.topics.find((item) => item.id === topicId) ?? null,
    [category, topicId],
  );
  const contentApiCategory = contentApiDocument
    ? categories.find((item) => item.topics.some((entry) => entry.id === contentApiDocument.topicId))
    : undefined;
  const contentApiTopic = contentApiCategory?.topics.find((entry) => entry.id === contentApiDocument?.topicId);
  const todoScope = useMemo(
    () => ({
      spaceCode: domain,
      spaceTitle: title,
      categoryId: category?.id ?? null,
      categoryTitle: category?.title ?? null,
      topicId: topic?.id ?? null,
      topicTitle: topic?.title ?? null,
      includeCategoryTodos: domain === "PROTOTYPE" || domain === "PROTOTYPE_FRONT",
    }),
    [category?.id, category?.title, domain, title, topic?.id, topic?.title],
  );
  const { activeCount: activeTodoCount } = useTodos(todoScope);
  const documents = topic?.documents ?? EMPTY_DOCUMENTS;
  const { rows: documentRows, children } = useMemo(
    () => flattenDocuments(documents),
    [documents],
  );
  const drawerDocument = useQuery({
    queryKey: ["hospital-playbook", "document", drawerDocumentId],
    queryFn: () => playbookApi.document(drawerDocumentId!),
    enabled: drawerDocumentId !== null,
  });
  const searchResults = useQuery({
    queryKey: ["hospital-playbook", "search", submittedSearch],
    queryFn: () => playbookApi.search(submittedSearch, domain),
    enabled: submittedSearch.length > 0,
    retry: false,
  });

  const resizeCategory = useColumnResize(categoryWidth, setCategoryWidth, {
    min: 240,
    max: 560,
  });
  const resizeTopic = useColumnResize(topicWidth, setTopicWidth, {
    min: 260,
    max: 600,
  });
  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: playbookTreeKey(domain) });

  useEffect(() => {
    hydrateLayout();
  }, [hydrateLayout]);
  useEffect(() => {
    if (!selectionHydrated) return;
    if (!categories.length) {
      setCategoryId((current) => (current === null ? current : null));
      return;
    }
    if (!categories.some((item) => item.id === categoryId))
      setCategoryId(
        categories.find((item) => item.id === rememberedMenu?.categoryId)?.id ??
          categories.find((item) => item.id === initialCategoryId)?.id ??
          categories[0].id,
      );
  }, [categories, categoryId, initialCategoryId, rememberedMenu?.categoryId, selectionHydrated]);
  useEffect(() => {
    if (!selectionHydrated) return;
    const topics = category?.topics ?? EMPTY_TOPICS;
    if (!topics.length) {
      setTopicId((current) => (current === null ? current : null));
      return;
    }
    if (
      pendingTopicSelection !== null &&
      topics.some((item) => item.id === pendingTopicSelection)
    ) {
      setTopicId(pendingTopicSelection);
      setPendingTopicSelection(null);
      return;
    }
    if (!topics.some((item) => item.id === topicId))
      setTopicId(
        topics.find(
          (item) =>
            category?.id === rememberedMenu?.categoryId &&
            item.id === rememberedMenu.topicId,
        )?.id ??
          topics.find((item) => item.id === initialTopicId)?.id ??
          topics.find((item) => item.title === initialTopicTitle)?.id ??
          topics[0].id,
      );
  }, [category, topicId, pendingTopicSelection, initialTopicId, initialTopicTitle, rememberedMenu, selectionHydrated]);
  useEffect(() => {
    if (!selectionHydrated || !category || !topic) return;
    rememberSelectedMenu(domain, { categoryId: category.id, topicId: topic.id });
  }, [category, domain, rememberSelectedMenu, selectionHydrated, topic]);
  useEffect(() => {
    const ids = new Set(documents.map((item) => item.id));
    setExpandedDocumentIds((current) => {
      // 문서가 많은 주제도 처음에는 상위 문서만 보여 주어 목록의 구조를 먼저 읽게 한다.
      // 사용자가 펼친 상태는 같은 주제 안에서 유지하고, 주제가 바뀌면 다시 접는다.
      const isNewTopic = expandedTopicId.current !== topicId;
      const next = isNewTopic
        ? new Set<number>()
        : new Set([...current].filter((id) => ids.has(id)));
      expandedTopicId.current = topicId;
      if (
        next.size === current.size &&
        [...next].every((id) => current.has(id))
      )
        return current;
      return next;
    });
  }, [documents, topicId]);
  useEffect(() => {
    // 검색·페이지 보기·본문 열기로 하위 문서를 선택하면 부모 경로만 자동으로 펼친다.
    const activeId = pageDocumentId ?? editingDocumentId ?? drawerDocumentId;
    if (activeId === null) return;
    const byId = new Map(documents.map((item) => [item.id, item]));
    setExpandedDocumentIds((current) => {
      const next = new Set(current);
      let parentId = byId.get(activeId)?.parentId ?? null;
      while (parentId !== null) {
        next.add(parentId);
        parentId = byId.get(parentId)?.parentId ?? null;
      }
      if (
        next.size === current.size &&
        [...next].every((id) => current.has(id))
      )
        return current;
      return next;
    });
  }, [documents, drawerDocumentId, editingDocumentId, pageDocumentId]);

  const mutationError = (error: unknown, fallback: string) =>
    showToast(error instanceof Error ? error.message : fallback, "error");
  const createCategory = useMutation({
    mutationFn: (categoryTitle: string) =>
      playbookApi.createCategory(domain, categoryTitle),
    onSuccess: () => {
      invalidate();
      showToast("1차 메뉴를 추가했습니다.");
    },
    onError: (error) => mutationError(error, "1차 메뉴를 추가하지 못했습니다."),
  });
  const renameCategory = useMutation({
    mutationFn: (value: { id: number; title: string }) =>
      playbookApi.renameCategory(value.id, value.title),
    onSuccess: () => {
      invalidate();
      showToast("1차 메뉴 이름을 수정했습니다.");
    },
    onError: (error) =>
      mutationError(error, "1차 메뉴 이름을 수정하지 못했습니다."),
  });
  const deleteCategory = useMutation({
    mutationFn: (id: number) => playbookApi.deleteCategory(id),
    onSuccess: async (_result, id) => {
      setDeleteTarget(null);
      await crumbleMenu("1차 메뉴", id);
      queryClient.setQueryData<PlaybookCategory[]>(playbookTreeKey(domain), (current) =>
        current?.filter((category) => category.id !== id),
      );
      invalidate();
      showToast("1차 메뉴를 삭제했습니다.");
    },
    onError: (error) => mutationError(error, "1차 메뉴를 삭제하지 못했습니다."),
  });
  const reorderCategories = useMutation({
    mutationFn: (ids: number[]) => playbookApi.reorderCategories(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: playbookTreeKey(domain) });
      const previous = queryClient.getQueryData<PlaybookCategory[]>(
        playbookTreeKey(domain),
      );
      queryClient.setQueryData<PlaybookCategory[]>(
        playbookTreeKey(domain),
        (current) => (current ? reorderByIds(current, ids) : current),
      );
      return { previous };
    },
    onSuccess: () => showToast("1차 메뉴 순서를 저장했습니다."),
    onError: (error, _ids, context) => {
      if (context?.previous)
        queryClient.setQueryData(playbookTreeKey(domain), context.previous);
      mutationError(error, "1차 메뉴 순서를 저장하지 못했습니다.");
    },
    onSettled: invalidate,
  });
  const createTopic = useMutation({
    mutationFn: (value: { categoryId: number; title: string }) =>
      playbookApi.createTopic(value.categoryId, value.title),
    onSuccess: (created) => {
      setCategoryId(created.categoryId);
      setPendingTopicSelection(created.id);
      invalidate();
      showToast("2차 메뉴를 추가했습니다.");
    },
    onError: (error) => mutationError(error, "2차 메뉴를 추가하지 못했습니다."),
  });
  const renameTopic = useMutation({
    mutationFn: (value: { id: number; title: string }) =>
      playbookApi.renameTopic(value.id, value.title),
    onSuccess: () => {
      invalidate();
      showToast("2차 메뉴 이름을 수정했습니다.");
    },
    onError: (error) =>
      mutationError(error, "2차 메뉴 이름을 수정하지 못했습니다."),
  });
  const moveTopic = useMutation({
    mutationFn: (value: { topicId: number; categoryId: number }) =>
      playbookApi.moveTopic(value.topicId, value.categoryId),
    onSuccess: (moved) => {
      setMoveTopicTarget(null);
      setCategoryId(moved.categoryId);
      setPendingTopicSelection(moved.id);
      invalidate();
      showToast("2차 메뉴를 이동했습니다.");
    },
    onError: (error) => mutationError(error, "2차 메뉴를 이동하지 못했습니다."),
  });
  const moveDocumentToTopic = useMutation({
    mutationFn: (value: { documentId: number; topicId: number }) =>
      playbookApi.moveDocumentToTopic(value.documentId, value.topicId),
    onSuccess: (moved) => {
      setMoveDocumentTarget(null);
      setPendingTopicSelection(moved.topicId);
      setDrawerDocumentId(moved.id);
      invalidate();
      showToast("문서를 다른 2차 메뉴로 이동했습니다.");
    },
    onError: (error) => mutationError(error, "문서를 다른 2차 메뉴로 이동하지 못했습니다."),
  });
  const deleteTopic = useMutation({
    mutationFn: (id: number) => playbookApi.deleteTopic(id),
    onSuccess: async (_result, id) => {
      setDeleteTarget(null);
      await crumbleMenu("2차 메뉴", id);
      queryClient.setQueryData<PlaybookCategory[]>(playbookTreeKey(domain), (current) =>
        current?.map((category) => ({
          ...category, topics: category.topics.filter((topic) => topic.id !== id),
        })),
      );
      invalidate();
      showToast("2차 메뉴를 삭제했습니다.");
    },
    onError: (error) => mutationError(error, "2차 메뉴를 삭제하지 못했습니다."),
  });
  const reorderTopics = useMutation({
    mutationFn: (value: { categoryId: number; ids: number[] }) =>
      playbookApi.reorderTopics(value.categoryId, value.ids),
    onMutate: async (value) => {
      await queryClient.cancelQueries({ queryKey: playbookTreeKey(domain) });
      const previous = queryClient.getQueryData<PlaybookCategory[]>(
        playbookTreeKey(domain),
      );
      queryClient.setQueryData<PlaybookCategory[]>(
        playbookTreeKey(domain),
        (current) =>
          current?.map((category) =>
            category.id === value.categoryId
              ? {
                  ...category,
                  topics: reorderByIds(category.topics, value.ids),
                }
              : category,
          ),
      );
      return { previous };
    },
    onSuccess: () => showToast("2차 메뉴 순서를 저장했습니다."),
    onError: (error, _value, context) => {
      if (context?.previous)
        queryClient.setQueryData(playbookTreeKey(domain), context.previous);
      mutationError(error, "2차 메뉴 순서를 저장하지 못했습니다.");
    },
    onSettled: invalidate,
  });
  const deleteDocument = useMutation({
    mutationFn: (id: number) => playbookApi.deleteDocument(id),
    onSuccess: () => {
      setDrawerDocumentId(null);
      setEditingDocumentId(null);
      invalidate();
    },
  });
  const reorderDocuments = useMutation({
    mutationFn: (value: {
      topicId: number;
      ids: number[];
      parentId: number | null;
    }) =>
      playbookApi.reorderDocuments(value.topicId, value.ids, value.parentId),
    onMutate: (value) => {
      // 서버 응답을 기다리지 않고 캐시를 먼저 바꿔야 dnd-kit이 이동 경로를 애니메이션으로 계산한다.
      queryClient.setQueryData<PlaybookCategory[]>(
        playbookTreeKey(domain),
        (current) =>
          current?.map((category) => ({
            ...category,
            topics: category.topics.map((item) => {
              if (item.id !== value.topicId) return item;
              const moving = item.documents.filter(
                (document) => document.parentId === value.parentId,
              );
              const byId = new Map(
                moving.map((document) => [document.id, document]),
              );
              const reordered = value.ids
                .map((id, orderIdx) => {
                  const document = byId.get(id);
                  return document ? { ...document, orderIdx } : undefined;
                })
                .filter((document): document is PlaybookDocumentSummary =>
                  Boolean(document),
                );
              return {
                ...item,
                documents: item.documents.map((document) =>
                  document.parentId === value.parentId
                    ? (reordered.shift() ?? document)
                    : document,
                ),
              };
            }),
          })),
      );
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: playbookTreeKey(domain) });
      mutationError(error, "문서 순서를 저장하지 못했습니다.");
    },
    onSuccess: invalidate,
  });

  const isVisible = (document: PlaybookDocumentSummary) => {
    let parentId = document.parentId;
    while (parentId !== null) {
      if (!expandedDocumentIds.has(parentId)) return false;
      parentId =
        documents.find((item) => item.id === parentId)?.parentId ?? null;
    }
    return true;
  };
  const createNewDocument = (parentId: number | null = null) => {
    if (!topic) return;
    setEditingDocumentId(null);
    setNewDocumentDraft({ topicId: topic.id, parentId });
  };
  const requestStructureDelete = (target: DeleteTarget) =>
    setDeleteTarget(target);
  const confirmStructureDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.kind === "category")
      deleteCategory.mutate(deleteTarget.id);
    else deleteTopic.mutate(deleteTarget.id);
  };
  const refreshTree = async () => {
    if (isRefreshingTree) return;
    setSubmittedSearch("");
    queryClient.removeQueries({ queryKey: ["hospital-playbook", "search"] });
    setIsRefreshingTree(true);
    const startedAt = Date.now();
    try {
      await tree.refetch();
    } finally {
      const remaining = Math.max(0, 650 - (Date.now() - startedAt));
      window.setTimeout(() => setIsRefreshingTree(false), remaining);
    }
  };
  const submitSearch = (keyword: string) => setSubmittedSearch(keyword);
  const openSearchResult = (result: {
    categoryId: number;
    topicId: number;
    id: number;
  }) => {
    setCategoryId(result.categoryId);
    setPendingTopicSelection(result.topicId);
    setSubmittedSearch("");
    setEditingDocumentId(null);
    setDrawerDocumentId(result.id);
  };
  const handleTreeDragEnd = (event: DragEndEvent) => {
    if (!topic) return;
    const order = documentOrderAfterDrop(documents, event);
    if (order) reorderDocuments.mutate({ topicId: topic.id, ...order });
  };

  const flatDocuments = documentRows.map((row) => row.document);
  const drawerSummary =
    drawerDocumentId === null
      ? undefined
      : flatDocuments.find((item) => item.id === drawerDocumentId);
  const detail =
    drawerDocument.data ??
    (drawerSummary
      ? {
          ...drawerSummary,
          content: "",
          createdBy: null,
          approvedBy: null,
          approvedAt: null,
          updatedAt: new Date().toISOString(),
        }
      : undefined);
  const detailIndex = detail
    ? flatDocuments.findIndex((item) => item.id === detail.id)
    : -1;
  const previous = detailIndex > 0 ? flatDocuments[detailIndex - 1] : undefined;
  const next = detailIndex >= 0 ? flatDocuments[detailIndex + 1] : undefined;
  const contentApiDialog = contentApiDocument && (
    <DocumentContentApiDialog
      documentId={contentApiDocument.id}
      topicId={contentApiDocument.topicId}
      documentTitle={contentApiDocument.title}
      topicTitle={contentApiTopic?.title}
      categoryTitle={contentApiCategory?.title}
      onClose={() => setContentApiDocument(null)}
    />
  );

  if (pageDocumentId !== null && topic && category) {
    return (
      <>
      <DocumentPage
        documentId={pageDocumentId}
        domain={domain}
        title={title}
        categoryTitle={category.title}
        topicTitle={topic.title}
        categoryId={category.id}
        topicId={topic.id}
        categories={categories}
        documents={documents}
        onClose={() => setPageDocumentId(null)}
        onNavigate={setPageDocumentId}
        onChangeLocation={(nextCategoryId, nextTopicId, nextDocumentId) => {
          setCategoryId(nextCategoryId);
          setTopicId(nextTopicId);
          setPageDocumentId(nextDocumentId);
        }}
        onReorder={(ids, parentId) =>
          reorderDocuments.mutateAsync({ topicId: topic.id, ids, parentId })
        }
        onRefresh={() => void tree.refetch()}
        onEdit={(id) => {
          setPageDocumentId(null);
          setEditingDocumentId(id);
        }}
        onOpenContentApi={(id) => {
          const selected = categories
            .flatMap((item) => item.topics)
            .flatMap((item) => item.documents)
            .find((item) => item.id === id);
          if (selected) setContentApiDocument(selected);
        }}
        onDelete={(id) => {
          setPageDocumentId(null);
          setDrawerDocumentId(id);
        }}
        deleting={deleteDocument.isPending}
        reordering={reorderDocuments.isPending}
        canDelete={
          !isSystemGallery ||
          documents.find((item) => item.id === pageDocumentId)?.parentId !==
            null
        }
      />
      {contentApiDialog}
      </>
    );
  }

  return (
    <div className="hospital-playbook-root flex min-w-0 flex-1 flex-col">
      {/* 노트 트리만 다시 불러온다. 셸의 전역 새로고침은 본문을 리마운트해 선택 상태까지 초기화하므로 여기서는 감춘다. */}
      <PageHeader
        hideRefresh
        center={
          <div className="flex min-w-0 w-full items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <PageHeaderSearch
                value={submittedSearch}
                placeholder="현재 노트 제목·본문 검색"
                onSearch={submitSearch}
                onClear={() => setSubmittedSearch("")}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setLlmApiGuideScope("all");
                setLlmApiGuideOpen(true);
              }}
              className="ui-icon-button h-9 shrink-0 gap-1.5 px-2.5 text-[11px] font-black text-brand-primary"
              title="전체 노트 편집 {}"
            >
              <span>전체 노트 편집</span>{" "}
              <span className="font-mono text-xs leading-none">{"{}"}</span>
            </button>
            <button
              type="button"
              onClick={() => setTodoDrawerOpen(true)}
              className="ui-icon-button h-9 shrink-0 gap-1.5 px-2.5 text-[11px] font-black text-brand-primary"
              title="현재 주제의 할 일 관리 (TODO)"
            >
              <ListTodo className="size-3.5" />
              <span>할 일</span>
              {activeTodoCount > 0 && (
                <span className="rounded-full bg-brand-primary px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {activeTodoCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => void refreshTree()}
              disabled={isRefreshingTree}
              className="ui-icon-button size-9 shrink-0 disabled:opacity-40"
              title="현재 노트 목록 새로고침"
              aria-label="현재 노트 목록 새로고침"
            >
              <RefreshCw
                className={`size-3.5 ${isRefreshingTree ? "refresh-icon-spin" : ""}`}
              />
            </button>
          </div>
        }
      >
        <FileText className="size-4 text-brand-primary" />
        <span className="text-[14px] font-bold tracking-tight text-text-primary">
          {title}
        </span>
        {isSystemGallery && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-brand-border/50 bg-brand-glass px-2 py-1 text-[10px] font-black text-brand-primary"
            title="실제 컴포넌트 파일과 연결된 고정 갤러리"
          >
            <LockKeyhole className="size-3" /> 고정 갤러리
          </span>
        )}
        <button
          type="button"
          onClick={() => void refreshTree()}
          disabled={isRefreshingTree}
          className="ui-icon-button ml-1 size-7 disabled:opacity-40"
          title="노트 새로고침"
        >
          <RefreshCw
            className={`size-3.5 ${isRefreshingTree ? "refresh-icon-spin" : ""}`}
          />
        </button>
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-auto bg-surface-muted p-4">
        {tree.isPending ? (
          <div className="grid h-full place-items-center text-text-muted">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : tree.isError ? (
          <div className="grid h-full place-items-center text-sm font-semibold text-text-muted">
            노트를 불러오지 못했습니다.
          </div>
        ) : (
          <main className="flex h-full min-h-[640px] min-w-[960px] gap-1">
            <div
              className="h-full min-h-0 shrink-0 overflow-hidden"
              style={{
                width: categoryCollapsed
                  ? COLLAPSED_COLUMN_WIDTH
                  : categoryWidth,
              }}
            >
              <ListColumn
                title="1차 메뉴"
                items={categories.map((item) => ({
                  id: item.id,
                  title: item.title,
                  count: item.topics.length,
                }))}
                selectedId={categoryId}
                onSelect={setCategoryId}
                onCreate={(title) => createCategory.mutate(title)}
                onRename={(id, title) => renameCategory.mutate({ id, title })}
                onDelete={(id) => {
                  const item = categories.find(
                    (category) => category.id === id,
                  );
                  if (item)
                    requestStructureDelete({
                      kind: "category",
                      id,
                      title: item.title,
                      childCount: item.topics.length,
                    });
                }}
                onReorder={(ids) => reorderCategories.mutate(ids)}
                emptyLabel="아직 영역이 없습니다."
                createPlaceholder="영역 이름"
                expandedWidth={categoryWidth}
                collapsed={categoryCollapsed}
                onToggle={toggleCategory}
                protectedStructure={isSystemGallery}
                moveTargetMode={
                  moveTopicTarget
                    ? {
                        title: moveTopicTarget.topic.title,
                        sourceId: moveTopicTarget.sourceCategoryId,
                        moving: moveTopic.isPending,
                        onCancel: () => {
                          if (!moveTopic.isPending) setMoveTopicTarget(null);
                        },
                        onMoveTo: (targetCategoryId) =>
                          moveTopic.mutate({
                            topicId: moveTopicTarget.topic.id,
                            categoryId: targetCategoryId,
                          }),
                      }
                    : undefined
                }
              />
            </div>
            <div
              className={
                "shrink-0 transition-opacity duration-200 " +
                (categoryCollapsed
                  ? "pointer-events-none opacity-0"
                  : "opacity-100")
              }
            >
              <ColumnResizeHandle onPointerDown={resizeCategory} />
            </div>
            <div
              className="h-full min-h-0 shrink-0 overflow-hidden"
              style={{
                width: topicCollapsed ? COLLAPSED_COLUMN_WIDTH : topicWidth,
              }}
            >
              <ListColumn
                title="2차 메뉴"
                items={(category?.topics ?? EMPTY_TOPICS).map((item) => ({
                  id: item.id,
                  title: item.title,
                  count: item.documents.length,
                  badge: (
                    <FileText className="size-4 shrink-0 text-brand-primary" />
                  ),
                }))}
                selectedId={topicId}
                onSelect={setTopicId}
                onCreate={(title) =>
                  category &&
                  createTopic.mutate({ categoryId: category.id, title })
                }
                onRename={(id, title) => renameTopic.mutate({ id, title })}
                onMove={(id) => {
                  const item = category?.topics.find((topic) => topic.id === id);
                  if (item && category) setMoveTopicTarget({ topic: item, sourceCategoryId: category.id });
                }}
                onDelete={(id) => {
                  const item = category?.topics.find(
                    (topic) => topic.id === id,
                  );
                  if (item)
                    requestStructureDelete({
                      kind: "topic",
                      id,
                      title: item.title,
                      childCount: item.documents.length,
                    });
                }}
                onReorder={(ids) =>
                  category &&
                  reorderTopics.mutate({ categoryId: category.id, ids })
                }
                emptyLabel={
                  category ? "아직 주제가 없습니다." : "먼저 선택하세요."
                }
                createPlaceholder="주제 이름"
                disabled={!category}
                expandedWidth={topicWidth}
                collapsed={topicCollapsed}
                onToggle={toggleTopic}
                protectedStructure={isSystemGallery}
                moveTargetMode={
                  moveDocumentTarget
                    ? {
                        title: moveDocumentTarget.document.title,
                        sourceId: moveDocumentTarget.sourceTopicId,
                        moving: moveDocumentToTopic.isPending,
                        onCancel: () => {
                          if (!moveDocumentToTopic.isPending) setMoveDocumentTarget(null);
                        },
                        onMoveTo: (targetTopicId) =>
                          moveDocumentToTopic.mutate({
                            documentId: moveDocumentTarget.document.id,
                            topicId: targetTopicId,
                          }),
                      }
                    : undefined
                }
              />
            </div>
            <div
              className={
                "shrink-0 transition-opacity duration-200 " +
                (topicCollapsed
                  ? "pointer-events-none opacity-0"
                  : "opacity-100")
              }
            >
              <ColumnResizeHandle onPointerDown={resizeTopic} />
            </div>
            <section className="flex min-h-0 min-w-[420px] flex-1 flex-col rounded-lg border border-surface-border bg-surface-raised shadow-sm">
              <header className="flex h-12 min-h-12 shrink-0 items-center justify-between gap-3 border-b border-surface-border-soft px-4 py-0">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-brand-primary">
                    {category?.title ?? "영역 없음"} &gt;{" "}
                    {topic?.title ?? "주제 없음"}
                  </p>
                  {topic && (
                    <h1 className="mt-0.5 truncate text-lg font-black text-text-primary">
                      {topic.title}
                      <span className="ml-2 text-sm font-semibold text-text-muted">
                        ({documents.length})
                      </span>
                    </h1>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={!topic}
                    onClick={() => {
                      setLlmApiGuideScope("topic");
                      setLlmApiGuideOpen(true);
                    }}
                    className="ui-icon-button h-9 shrink-0 gap-1.5 px-2.5 text-[11px] font-black disabled:opacity-40"
                    title="2차 주제 편집 {}"
                    aria-label="2차 주제 편집 {}"
                  >
                    <span>2차 주제 편집</span>
                    <span className="font-mono text-xs leading-none">
                      {"{}"}
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={!topic || newDocumentDraft !== null}
                    onClick={() => createNewDocument()}
                    className="ui-icon-button-brand h-9 shrink-0 gap-1.5 px-3 text-[13px] font-black disabled:opacity-40"
                  >
                    <Plus className="size-4" /> 문서 추가
                  </button>
                </div>
              </header>
              {editingDocumentId || newDocumentDraft ? (
                <div className="min-h-0 flex-1 overflow-y-auto p-2">
                  <DocumentPane
                    documentId={editingDocumentId ?? undefined}
                    draft={newDocumentDraft ?? undefined}
                    onChanged={invalidate}
                    onCreated={(documentId) => {
                      setNewDocumentDraft(null);
                      setEditingDocumentId(null);
                      setDrawerDocumentId(documentId);
                    }}
                    onSaved={() => {
                      if (!editingDocumentId) return;
                      setEditingDocumentId(null);
                      setDrawerDocumentId(editingDocumentId);
                    }}
                    onCancel={() => {
                      // 취소는 새 문서와 기존 문서 모두 편집기를 닫고 목록으로 돌아간다.
                      setNewDocumentDraft(null);
                      setEditingDocumentId(null);
                    }}
                    onBack={() => {
                      setNewDocumentDraft(null);
                      setEditingDocumentId(null);
                    }}
                  />
                </div>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {submittedSearch ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1 text-xs font-bold text-text-muted">
                        <span>검색 결과</span>
                        {!searchResults.isPending && (
                          <span>{searchResults.data?.length ?? 0}개</span>
                        )}
                      </div>
                      {searchResults.isPending ? (
                        <div className="grid h-24 place-items-center text-text-muted">
                          <Loader2 className="size-5 animate-spin" />
                        </div>
                      ) : searchResults.isError ? (
                        <div className="grid min-h-24 place-items-center text-sm font-semibold text-destructive">
                          검색 중 오류가 발생했습니다. 잠시 후 다시 시도해
                          주세요.
                        </div>
                      ) : searchResults.data?.length ? (
                        searchResults.data.map((result) => (
                          <button
                            key={result.id}
                            type="button"
                            onClick={() => openSearchResult(result)}
                            className="flex w-full items-center gap-2 rounded-md border border-surface-border-soft bg-surface-muted px-3 py-2.5 text-left transition-colors hover:border-brand-border hover:bg-brand-glass"
                          >
                            <FileText className="size-4 shrink-0 text-brand-primary" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-black text-text-primary">
                                {result.title}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] font-semibold text-text-muted">
                                {result.categoryTitle} &gt; {result.topicTitle}
                              </span>
                            </span>
                            <ChevronRight className="size-4 shrink-0 text-text-muted" />
                          </button>
                        ))
                      ) : (
                        <div className="grid h-24 place-items-center text-sm font-semibold text-text-muted">
                          검색 결과가 없습니다.
                        </div>
                      )}
                    </div>
                  ) : documentRows.length ? (
                    <DragDropProvider onDragEnd={handleTreeDragEnd}>
                      <div className="grid gap-1.5">
                        {documentRows.map(({ document, depth, indexPath }) =>
                          isVisible(document) ? (
                            <SortableTreeDocumentRow
                              key={document.id}
                              document={document}
                              depth={depth}
                              indexPath={indexPath}
                              childCount={
                                children.get(document.id)?.length ?? 0
                              }
                              expanded={expandedDocumentIds.has(document.id)}
                              onOpen={() => {
                                setEditingDocumentId(null);
                                setDrawerDocumentId(document.id);
                              }}
                              onToggle={() =>
                                setExpandedDocumentIds((current) => {
                                  const nextIds = new Set(current);
                                  if (nextIds.has(document.id))
                                    nextIds.delete(document.id);
                                  else nextIds.add(document.id);
                                  return nextIds;
                                })
                              }
                              onAddChild={() =>
                                createNewDocument(document.id)
                              }
                              onOpenPage={() =>
                                setPageDocumentId(document.id)
                              }
                            />
                          ) : null,
                        )}
                      </div>
                    </DragDropProvider>
                  ) : (
                    <div className="grid min-h-48 place-items-center text-sm font-semibold text-text-muted">
                      문서를 추가해 학습 흐름을 구성하세요.
                    </div>
                  )}
                </div>
              )}
            </section>
          </main>
        )}
      </div>
      {detail && (
        <DocumentDrawer
          document={detail}
          domain={domain}
          loading={drawerDocument.isPending}
          previous={
            previous
              ? { ...detail, id: previous.id, title: previous.title }
              : undefined
          }
          next={
            next ? { ...detail, id: next.id, title: next.title } : undefined
          }
          onNavigate={(target) => setDrawerDocumentId(target.id)}
          onChanged={invalidate}
          onRefresh={() => drawerDocument.refetch()}
          documents={documents}
          onMove={async (parentId) => {
            const moved = await playbookApi.updateDocument(detail.id, { parentId });
            queryClient.setQueryData(["hospital-playbook", "document", moved.id], moved);
            await queryClient.invalidateQueries({ queryKey: playbookTreeKey(domain) });
            showToast(parentId === null ? "문서를 루트 본문으로 이동했습니다." : "문서를 선택한 본문 아래로 이동했습니다.");
          }}
          onMoveToTopic={() => {
            setMoveDocumentTarget({ document: detail, sourceTopicId: detail.topicId });
            setDrawerDocumentId(null);
          }}
          onOpenPage={() => {
            setDrawerDocumentId(null);
            setPageDocumentId(detail.id);
          }}
          onOpenApiDesign={() => setApiDesignDocument(detail)}
          onOpenContentApi={() => setContentApiDocument(detail)}
          onDelete={() => deleteDocument.mutate(detail.id)}
          onClose={() => setDrawerDocumentId(null)}
          deleting={deleteDocument.isPending}
          deleteError={
            deleteDocument.isError
              ? (deleteDocument.error as Error).message
              : undefined
          }
          canDelete={!isSystemGallery || detail.parentId !== null}
        />
      )}
      {deleteTarget && (
        <StructureDeleteConfirm
          target={deleteTarget}
          deleting={deleteCategory.isPending || deleteTopic.isPending}
          error={
            (deleteCategory.error ?? deleteTopic.error) instanceof Error
              ? (deleteCategory.error ?? (deleteTopic.error as Error)).message
              : undefined
          }
          onCancel={() => {
            if (!deleteCategory.isPending && !deleteTopic.isPending)
              setDeleteTarget(null);
          }}
          onConfirm={confirmStructureDelete}
        />
      )}
      {llmApiGuideOpen && (
        <LlmApiGuideDialog
          domain={domain}
          topicId={topicId}
          topicTitle={topic?.title}
          categoryTitle={category?.title}
          parentDocumentId={drawerDocumentId}
          scope={llmApiGuideScope}
          onClose={() => setLlmApiGuideOpen(false)}
        />
      )}
      {contentApiDialog}
      {apiDesignDocument && (
        <ApiDesignDocumentDialog
          documentId={apiDesignDocument.id}
          topicId={apiDesignDocument.topicId}
          documentTitle={apiDesignDocument.title}
          onClose={() => setApiDesignDocument(null)}
        />
      )}
      <TodoDrawer open={todoDrawerOpen} onOpenChange={setTodoDrawerOpen} scope={todoScope} />
    </div>
  );
}

export default HospitalPlaybookModule;
