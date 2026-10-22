"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, Bookmark, Loader2, Search, X } from "lucide-react";
import { playbookApi } from "@/features/hospital-playbook/api";
import { BookmarkButton, useBookmarks } from "@/features/hospital-playbook/bookmarks";
import { playbookModules } from "@/features/hospital-playbook/modules";
import { useToast } from "@/shared/ui/toast";
import { ApiError } from "@/shared/api/client";
import PageHeader from "@/shared/ui/PageHeader";
import { LexicalEditor } from "@/shared/ui/lexical/lexical-editor";

function BookmarkCard({ saved, keyword }: { saved: { id: number; title: string; savedAt: string }; keyword: string }) {
  const [open, setOpen] = useState(false);
  const { update } = useBookmarks();
  const { showToast } = useToast();
  const document = useQuery({ queryKey: ["hospital-playbook", "document", saved.id], queryFn: () => playbookApi.document(saved.id), retry: false });
  const title = document.data?.title ?? saved.title;
  const location = document.data?.location;
  const moduleLabel = Object.entries(playbookModules).find(([, config]) => config.domain === location?.spaceCode)?.[0];
  const navigate = async () => {
    try {
      // Resolve again at click time so moved documents open in their current location.
      const latest = await playbookApi.document(saved.id);
      const target = latest.location;
      const label = Object.entries(playbookModules).find(([, config]) => config.domain === target?.spaceCode)?.[0];
      if (!target || !label) throw new Error("문서의 메뉴 위치를 찾을 수 없습니다.");
      window.sessionStorage.setItem("pkt-study-menu-search-target", JSON.stringify({ ...target, documentId: saved.id }));
      window.location.hash = encodeURIComponent(label);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "문서로 이동하지 못했습니다.", "error");
    }
  };
  const moveButton = <button type="button" onClick={() => void navigate()} disabled={!document.data || document.isError} aria-label={`${title} 문서로 이동`} title="원래 문서 위치로 이동" className="ui-icon-button h-8 shrink-0 gap-1 px-2 text-xs font-bold text-brand-primary disabled:opacity-40"><ArrowUpRight className="size-4" />이동</button>;

  if (keyword && !title.toLocaleLowerCase().includes(keyword.toLocaleLowerCase())) return null;
  const missing = document.error instanceof ApiError && document.error.status === 404;
  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <article className="flex min-w-0 items-center gap-3 rounded-xl border border-surface-border-soft bg-surface-raised px-4 py-3">
      <Bookmark className="size-5 shrink-0 text-brand-primary" fill="currentColor" />
      <div className="min-w-0 flex-1">
        <Dialog.Trigger disabled={!document.data || document.isError} className="block max-w-full truncate text-left text-sm font-bold text-text-primary hover:text-brand-primary disabled:text-text-muted">{title}</Dialog.Trigger>
        {location && <p className="mt-1 truncate text-xs text-text-muted" title={`${moduleLabel ?? location.spaceCode} › ${location.categoryTitle} › ${location.topicTitle}`}>{moduleLabel ?? location.spaceCode} › {location.categoryTitle} › {location.topicTitle}</p>}
        <p className="mt-1 text-xs text-text-muted">{missing ? "삭제되었거나 찾을 수 없는 문서입니다." : document.isError ? "문서를 불러오지 못했습니다." : document.isPending ? "문서 확인 중…" : `저장일 ${new Date(saved.savedAt).toLocaleDateString("ko-KR")}`}</p>
        {document.isError && !missing && <button type="button" onClick={() => void document.refetch()} className="mt-1 text-xs text-brand-primary">다시 시도</button>}
      </div>
      {moveButton}
      {document.isPending && <Loader2 className="size-4 animate-spin text-text-muted" />}
      <button type="button" onClick={() => update(saved, true)} aria-label={`${title} 북마크 해제`} title="북마크 해제" className="ui-icon-button size-8 shrink-0"><X className="size-4" /></button>
    </article>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/35" />
      <Dialog.Content className="fixed inset-y-4 right-4 z-[101] flex w-[min(960px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-2xl">
        <header className="flex shrink-0 items-center gap-3 border-b border-surface-border px-5 py-4">
          <div className="min-w-0 flex-1"><Dialog.Title className="truncate text-lg font-black">{title}</Dialog.Title><Dialog.Description className="text-xs text-text-muted">북마크한 문서 · 상세 보기</Dialog.Description></div>
          {moveButton}
          <BookmarkButton document={document.data ?? saved} />
          <Dialog.Close aria-label="닫기" className="ui-icon-button size-8"><X className="size-4" /></Dialog.Close>
        </header>
        <div className="min-h-0 flex-1 overflow-auto p-5">{document.data && <LexicalEditor key={`${document.data.id}-${document.data.version}`} initialState={document.data.content} onChange={() => {}} readOnly />}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}

export default function BookmarksModule() {
  const { bookmarks } = useBookmarks();
  const [keyword, setKeyword] = useState("");
  return <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-muted/40">
    <PageHeader><Bookmark className="size-4 text-brand-primary" /><span className="text-sm font-bold">북마크</span></PageHeader>
    <section className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-6 py-7">
      <h1 className="text-xl font-black">저장한 문서 <span className="text-brand-primary">{bookmarks.length}</span></h1>
      <p className="mt-1 text-sm text-text-secondary">제목을 눌러 미리 보거나 이동 버튼으로 원래 문서를 여세요. 북마크는 이 기기의 현재 계정에 저장됩니다.</p>
      <div className="my-5 flex items-center gap-2 rounded-lg border border-surface-border bg-surface-raised px-3"><Search className="size-4 text-text-muted" /><input type="search" aria-label="북마크 제목 검색" placeholder="저장한 문서 제목 검색" value={keyword} onChange={(event) => setKeyword(event.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" /></div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pb-6">
        {bookmarks.length ? <div className="grid grid-cols-1 gap-3 lg:grid-cols-2"><p className="col-span-full hidden py-12 text-center text-sm text-text-muted only:block">검색 결과가 없습니다.</p>{bookmarks.map((saved) => <BookmarkCard key={saved.id} saved={saved} keyword={keyword.trim()} />)}</div> : <div className="rounded-xl border border-dashed border-surface-border py-16 text-center text-text-muted"><Bookmark className="mx-auto size-8" /><p className="mt-3 font-bold">아직 북마크한 문서가 없습니다.</p><p className="mt-1 text-sm">본문 상단의 북마크 버튼으로 문서를 저장하세요.</p></div>}
      </div>
    </section>
  </main>;
}
