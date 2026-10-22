/* eslint-disable react-hooks/set-state-in-effect -- editor form state synchronizes with fetched document data. */
import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Menu, RotateCcw, Save } from "lucide-react";
import { playbookApi } from "../../features/hospital-playbook/api";
import { LexicalEditor } from "../../shared/ui/lexical/lexical-editor";
import { useToast } from "../../shared/ui/toast";

const TITLE_CONTROL_SIZE = 40;
const EMPTY_LEXICAL_STATE = '{"root":{"children":[]}}';

type DocumentDraft = {
  topicId: number;
  parentId: number | null;
};

/**
 * 선택한 개발 문서의 편집 영역.
 * 개발 노트는 승인/챗봇 상태보다 빠른 작성과 저장에 집중한다.
 */
function DocumentPane({
  documentId,
  draft,
  onChanged,
  onCancel,
  onSaved,
  onCreated,
  onBack,
}: {
  documentId?: number;
  draft?: DocumentDraft;
  onChanged: () => void;
  onCancel?: () => void;
  onSaved?: () => void;
  onCreated?: (documentId: number) => void;
  onBack?: () => void;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const key = ["hospital-playbook", "document", documentId];
  const document = useQuery({
    queryKey: key,
    queryFn: () => playbookApi.document(documentId!),
    enabled: documentId !== undefined,
  });
  const isDraft = draft !== undefined;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState(EMPTY_LEXICAL_STATE);
  const [editorRevision, setEditorRevision] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");

  // 상세 조회가 비동기로 끝난 뒤 Lexical 편집기도 서버 본문으로 초기화한다.
  // LexicalEditor의 initialState는 마운트 시 한 번만 사용되므로, 문서 데이터가
  // 준비되면 editorRevision을 증가시켜 빈 편집기가 남지 않게 한다.
  useEffect(() => {
    if (isDraft) {
      setTitle("");
      setContent(EMPTY_LEXICAL_STATE);
      setEditorRevision((revision) => revision + 1);
      return;
    }
    if (!document.data) return;
    setTitle(document.data.title);
    setContent(document.data.content);
    setEditorRevision((revision) => revision + 1);
  }, [document.data, draft?.parentId, draft?.topicId, isDraft]);

  const afterWrite = (saved: Awaited<ReturnType<typeof playbookApi.updateDocument>>) => {
    // 같은 문서에서는 id가 바뀌지 않으므로, 성공 응답을 직접 기준값으로 삼아야
    // 저장 후에도 "저장하지 않은 변경" 상태가 남지 않는다.
    queryClient.setQueryData(["hospital-playbook", "document", saved.id], saved);
    setTitle(saved.title);
    setContent(saved.content);
    setEditorRevision((revision) => revision + 1);
    setSaveMessage("");
    showToast("저장했습니다.");
    void queryClient.invalidateQueries({ queryKey: key });
    onChanged();
    onCreated?.(saved.id);
    onSaved?.();
  };

  const save = useMutation({
    mutationFn: () =>
      draft
        ? playbookApi.createDocument(draft.topicId, title.trim(), draft.parentId, content)
        : playbookApi.updateDocument(documentId!, { title, content, parentId: document.data?.parentId ?? null }),
    onSuccess: afterWrite,
    onError: (error) => {
      showToast(error instanceof Error ? error.message : "문서를 저장하지 못했습니다.", "error");
    },
  });

  const cancel = useCallback(() => {
    if (isDraft) {
      onCancel?.();
      return;
    }

    const savedDocument = document.data;
    if (savedDocument) {
      setTitle(savedDocument.title);
      setContent(savedDocument.content);
      setEditorRevision((revision) => revision + 1);
      setSaveMessage("변경 내용을 취소했습니다.");
    }
    onCancel?.();
  }, [document.data, isDraft, onCancel]);

  useEffect(() => {
    const cancelWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || save.isPending) return;

      // Esc는 하단 취소와 같게 편집을 버리고 문서 목록으로 돌아간다.
      event.preventDefault();
      event.stopPropagation();
      cancel();
    };

    window.addEventListener("keydown", cancelWithEscape, true);
    return () => window.removeEventListener("keydown", cancelWithEscape, true);
  }, [cancel, save.isPending]);

  const backButton = onBack ? (
    <button
      type="button"
      onClick={onBack}
      disabled={save.isPending}
      aria-label="목록으로"
      title="목록으로"
      className="ui-icon-button disabled:opacity-40"
      style={{ width: TITLE_CONTROL_SIZE, height: TITLE_CONTROL_SIZE, minWidth: TITLE_CONTROL_SIZE, minHeight: TITLE_CONTROL_SIZE, flex: `0 0 ${TITLE_CONTROL_SIZE}px`, padding: 0 }}
    >
      <Menu className="size-[18px]" />
    </button>
  ) : null;
  if (!isDraft && document.isPending) {
    return (
      <div className="rounded-lg border border-surface-border-soft bg-surface-muted p-2 text-text-muted">
        {backButton}
        <div className="grid place-items-center py-8">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </div>
    );
  }
  if (!isDraft && (document.isError || !document.data)) {
    return (
      <div className="rounded-lg border border-surface-border-soft bg-surface-muted p-2">
        {backButton}
        <p className="py-6 text-center text-[13px] font-semibold text-text-muted">문서를 불러오지 못했습니다.</p>
      </div>
    );
  }

  const doc = document.data;
  const dirty = isDraft
    ? title.trim().length > 0 || content !== EMPTY_LEXICAL_STATE
    : title !== doc!.title || content !== doc!.content;
  const busy = save.isPending;

  const handleSave = () => {
    if (isDraft && !title.trim()) {
      showToast("문서 제목을 입력하세요.", "error");
      return;
    }
    if (!dirty) {
      showToast("변경된 내용이 없습니다.", "info");
      onSaved?.();
      return;
    }
    save.mutate();
  };

  return (
    <div className="rounded-lg border border-surface-border-soft bg-surface-muted p-2">
      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setSaveMessage(""); }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!busy) handleSave();
            }
          }}
          placeholder="문서 제목"
          aria-label="문서 제목"
          aria-keyshortcuts="Enter"
          className="ui-input min-w-0 flex-1 font-black"
          style={{ height: TITLE_CONTROL_SIZE, minHeight: TITLE_CONTROL_SIZE }}
        />
        {backButton}
      </div>

      <div className="lexical-editor-frame mt-2">
        <LexicalEditor
          key={`${documentId ?? "draft"}-${editorRevision}`}
          initialState={content}
          onChange={(nextContent) => { setContent(nextContent); setSaveMessage(""); }}
          placeholder="개발 학습 내용을 입력하세요. 코드 블록, 이미지, 표, 체크리스트를 사용할 수 있습니다."
          minHeight="360px"
          scrollable
          toolbarVariant="full"
        />
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <div className="min-w-0 flex-1 text-[12px] font-bold">
          {save.isError ? <span className="text-destructive">{(save.error as Error).message}</span> : dirty ? <span className="text-text-muted">{isDraft ? "제목 입력 후 Enter를 누르면 새 문서가 생성됩니다." : "저장하지 않은 변경이 있습니다."}</span> : saveMessage ? <span className="text-brand-primary">{saveMessage}</span> : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="ui-icon-button-brand h-9 gap-1.5 px-4 text-[13px] font-black disabled:opacity-40"
          >
            {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            저장
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="ui-icon-button h-9 gap-1.5 px-4 text-[13px] font-black disabled:opacity-40"
          >
            <RotateCcw className="size-4" />
            취소
          </button>
        </div>
      </div>
    </div>
  );
}

export default DocumentPane;
