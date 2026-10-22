import {
  Check,
  ChevronDown,
  ChevronRight,
  MessageCircle,
  Pencil,
  Reply,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  playbookApi,
  type PlaybookDocumentComment,
} from "../../features/hospital-playbook/api";

const commentKey = (documentId: number) => [
  "hospital-playbook",
  "document",
  documentId,
  "comments",
];

/** 문서 본문을 방해하지 않는 접이식 토론/메모 영역. */
export default function DocumentComments({ documentId }: { documentId: number }) {
  const queryClient = useQueryClient();
  const comments = useQuery({
    queryKey: commentKey(documentId),
    queryFn: () => playbookApi.comments(documentId),
  });
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingContent, setEditingContent] = useState("");

  const create = useMutation({
    mutationFn: (body: {
      title?: string;
      content: string;
      parentId?: number | null;
    }) => playbookApi.createComment(documentId, body),
    onSuccess: (created) => {
      queryClient.setQueryData<PlaybookDocumentComment[]>(
        commentKey(documentId),
        (current = []) => [...current, created],
      );
    },
  });
  const update = useMutation({
    mutationFn: (value: { id: number; title?: string; content: string }) =>
      playbookApi.updateComment(value.id, value),
    onSuccess: (updated) => {
      queryClient.setQueryData<PlaybookDocumentComment[]>(
        commentKey(documentId),
        (current = []) =>
          current.map((comment) =>
            comment.id === updated.id ? updated : comment,
          ),
      );
    },
  });
  const remove = useMutation({
    mutationFn: (id: number) => playbookApi.deleteComment(id),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: commentKey(documentId) }),
  });

  const all = comments.data ?? [];
  const roots = all.filter((comment) => comment.parentId === null);
  const busy = create.isPending || update.isPending || remove.isPending;
  const error = create.error ?? update.error ?? remove.error ?? comments.error;
  const contentId = `document-comments-${documentId}`;

  const addRoot = () => {
    if (!title.trim() || !draft.trim()) return;
    create.mutate(
      { title: title.trim(), content: draft.trim() },
      { onSuccess: () => { setTitle(""); setDraft(""); } },
    );
  };

  const addReply = (parentId: number) => {
    if (!replyDraft.trim()) return;
    create.mutate(
      { title: "답글", content: replyDraft.trim(), parentId },
      { onSuccess: () => { setReplyTo(null); setReplyDraft(""); } },
    );
  };

  const beginEdit = (comment: PlaybookDocumentComment) => {
    setEditing(comment.id);
    setEditingTitle(comment.title ?? "");
    setEditingContent(comment.content);
  };

  const saveEdit = (id: number) => {
    if (!editingContent.trim()) return;
    update.mutate(
      {
        id,
        title: editingTitle.trim() || undefined,
        content: editingContent.trim(),
      },
      { onSuccess: () => setEditing(null) },
    );
  };

  return (
    <section className="mt-7 border-t border-surface-border-soft pt-4">
      <button
        type="button"
        aria-controls={contentId}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <span className="flex items-center gap-2 text-sm font-black text-text-primary">
          <MessageCircle className="size-4 text-brand-primary" />
          댓글
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] text-text-muted">
            {comments.isPending ? "…" : all.length}
          </span>
        </span>
        <span className="flex items-center gap-1 text-xs font-bold text-text-muted">
          {isOpen ? "접기" : "펼치기"}
          {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
      </button>

      {isOpen && (
        <div id={contentId} className="mt-3">
          <div className="space-y-2 rounded-lg border border-surface-border-soft bg-surface-muted p-3">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="댓글 제목"
              className="ui-input h-9 w-full bg-surface-raised text-sm"
            />
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="학습하면서 남길 메모나 질문을 입력하세요."
              rows={3}
              className="ui-input min-h-20 w-full resize-y bg-surface-raised py-2 text-sm"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy || !title.trim() || !draft.trim()}
                onClick={addRoot}
                className="ui-icon-button-brand h-8 gap-1.5 px-3 text-xs font-black disabled:opacity-40"
              >
                <Send className="size-3.5" /> 댓글 등록
              </button>
            </div>
          </div>

          {error && <p className="mt-2 text-xs font-bold text-destructive">{(error as Error).message}</p>}

          <div className="mt-4 space-y-3">
            {comments.isPending ? (
              <p className="text-xs font-semibold text-text-muted">댓글을 불러오는 중입니다.</p>
            ) : roots.length ? (
              roots.map((comment) => {
                const replies = all.filter((reply) => reply.parentId === comment.id);
                const isEditing = editing === comment.id;

                return (
                  <article key={comment.id} className="rounded-lg border border-surface-border-soft bg-surface-muted p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <>
                            <input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} placeholder="댓글 제목" className="ui-input h-8 w-full bg-surface-raised text-xs" />
                            <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={3} className="ui-input mt-2 min-h-18 w-full resize-y bg-surface-raised py-2 text-sm" />
                          </>
                        ) : (
                          <>
                            <p className="text-[10px] font-black text-brand-primary">개발 메모 · {new Date(comment.createdAt).toLocaleDateString("ko-KR")}</p>
                            <p className="mt-1 text-sm font-black text-text-primary">{comment.title || "댓글"}</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{comment.content}</p>
                          </>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {isEditing ? (
                          <>
                            <button type="button" onClick={() => saveEdit(comment.id)} disabled={busy} className="ui-icon-button size-7 text-brand-primary" title="저장"><Check className="size-3.5" /></button>
                            <button type="button" onClick={() => setEditing(null)} className="ui-icon-button size-7" title="취소"><X className="size-3.5" /></button>
                          </>
                        ) : (
                          <>
                            <button type="button" onClick={() => beginEdit(comment)} className="ui-icon-button size-7" title="수정"><Pencil className="size-3.5" /></button>
                            <button type="button" disabled={busy} onClick={() => remove.mutate(comment.id)} className="ui-icon-button size-7 text-destructive" title="삭제"><Trash2 className="size-3.5" /></button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <button type="button" onClick={() => setReplyTo(replyTo === comment.id ? null : comment.id)} className="ui-icon-button h-7 gap-1 px-2 text-[11px] font-black"><Reply className="size-3" /> 답글</button>
                    </div>
                    {replyTo === comment.id && (
                      <div className="mt-3 rounded-md border border-brand-border bg-brand-glass p-2.5">
                        <textarea value={replyDraft} onChange={(event) => setReplyDraft(event.target.value)} rows={2} placeholder="답글을 입력하세요." className="ui-input min-h-14 w-full bg-surface-raised py-2 text-xs" />
                        <div className="mt-2 flex justify-end gap-1.5">
                          <button type="button" onClick={() => { setReplyTo(null); setReplyDraft(""); }} className="ui-icon-button h-7 px-2 text-[11px] font-black">취소</button>
                          <button type="button" disabled={busy || !replyDraft.trim()} onClick={() => addReply(comment.id)} className="ui-icon-button-brand h-7 gap-1 px-2 text-[11px] font-black"><Send className="size-3" /> 등록</button>
                        </div>
                      </div>
                    )}

                    {replies.map((reply) => (
                      <div key={reply.id} className="mt-3 ml-5 rounded-md border-l-2 border-brand-border/50 bg-surface-raised px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            {editing === reply.id ? (
                              <>
                                <input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} className="ui-input h-8 w-full text-xs" />
                                <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={2} className="ui-input mt-2 w-full py-2 text-xs" />
                              </>
                            ) : (
                              <>
                                <p className="text-[10px] font-black text-brand-primary">ㄴ 답글 · {new Date(reply.createdAt).toLocaleDateString("ko-KR")}</p>
                                <p className="mt-1 whitespace-pre-wrap text-sm text-text-secondary">{reply.content}</p>
                              </>
                            )}
                          </div>
                          <div className="flex shrink-0 gap-1">
                            {editing === reply.id ? (
                              <>
                                <button type="button" onClick={() => saveEdit(reply.id)} className="ui-icon-button size-6 text-brand-primary"><Check className="size-3" /></button>
                                <button type="button" onClick={() => setEditing(null)} className="ui-icon-button size-6"><X className="size-3" /></button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => beginEdit(reply)} className="ui-icon-button size-6"><Pencil className="size-3" /></button>
                                <button type="button" disabled={busy} onClick={() => remove.mutate(reply.id)} className="ui-icon-button size-6 text-destructive"><Trash2 className="size-3" /></button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </article>
                );
              })
            ) : (
              <p className="rounded-md border border-dashed border-surface-border-soft px-3 py-5 text-center text-xs font-semibold text-text-muted">아직 남긴 댓글이 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
