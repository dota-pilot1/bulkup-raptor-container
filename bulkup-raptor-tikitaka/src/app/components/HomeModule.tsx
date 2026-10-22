"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, BookOpen, GraduationCap, LayoutDashboard, Newspaper, Pencil, Plus, Search, Trash2, type LucideIcon } from "lucide-react";
import PageHeader from "@/shared/ui/PageHeader";
import { Button } from "@/shared/ui/button";
import { useToast } from "@/shared/ui/toast";
import { LearningGoalDialog, type GoalDialogState, type LearningGoal, type LearningGoalInput } from "./LearningGoalDialog";
import DocumentationMethodologyDialog from "@/widgets/hospital-playbook/DocumentationMethodologyDialog";

const BOOKMARKS: Array<{ name: string; description: string; href: string; icon: LucideIcon }> = [
  { name: "긱뉴스", description: "개발자 뉴스와 기술 이야기", href: "https://news.hada.io/", icon: Newspaper },
  { name: "Spring Guides", description: "Spring 공식 가이드", href: "https://spring.io/guides/", icon: GraduationCap },
  { name: "React Docs", description: "React 공식 학습 문서", href: "https://react.dev/learn", icon: LayoutDashboard },
  { name: "Next.js Docs", description: "Next.js 공식 문서", href: "https://nextjs.org/docs", icon: Search },
];

const EMPTY_LEARNING_GOALS: LearningGoal[] = [];

async function readApiError(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string } | null;
  return body?.message ?? "요청을 처리하지 못했습니다.";
}

export function HomeModule(_props: { userName?: string; email?: string }) {
  const [activeTab, setActiveTab] = useState<"goals" | "news">("goals");
  const [searchQuery, setSearchQuery] = useState("");
  const [progressEdits, setProgressEdits] = useState<Record<number, number>>({});
  const [dialog, setDialog] = useState<GoalDialogState | null>(null);
  const [documentationMethodologyOpen, setDocumentationMethodologyOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const mutationLock = useRef(false);
  const dialogOpener = useRef<HTMLButtonElement | null>(null);
  const addButton = useRef<HTMLButtonElement | null>(null);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const goalsQuery = useQuery({
    queryKey: ["learning-goals"],
    queryFn: async () => {
      const response = await fetch("/api/learning-goals", { credentials: "same-origin" });
      if (!response.ok) throw new Error(await readApiError(response));
      return response.json() as Promise<LearningGoal[]>;
    },
  });
  const learningGoals = goalsQuery.data ?? EMPTY_LEARNING_GOALS;
  const goalGroups = useMemo(() => Array.from(new Set(learningGoals.map((goal) => goal.groupName))), [learningGoals]);

  const filteredGoals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return learningGoals.filter((goal) => {
      const matchesQuery = !query || [goal.task, goal.skill, goal.groupName, String(goal.orderIdx + 1)]
        .some((value) => value.toLowerCase().includes(query));
      return matchesQuery;
    });
  }, [learningGoals, searchQuery]);

  const openDialog = (state: GoalDialogState, opener: HTMLButtonElement) => {
    dialogOpener.current = opener;
    setDialog(state);
  };

  const mutateGoal = async (method: "POST" | "PATCH" | "DELETE", id?: number, input?: LearningGoalInput) => {
    if (mutationLock.current) throw new Error("이전 작업이 완료된 뒤 다시 시도해 주세요.");
    mutationLock.current = true;
    setPending(true);
    try {
      const response = await fetch(id === undefined ? "/api/learning-goals" : `/api/learning-goals/${id}`, {
        method,
        credentials: "same-origin",
        ...(input ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) } : {}),
      });
      if (!response.ok) throw new Error(await readApiError(response));
      const saved = method === "DELETE" ? null : await response.json() as LearningGoal;
      queryClient.setQueryData<LearningGoal[]>(["learning-goals"], (current = []) => {
        if (method === "DELETE") return current.filter((goal) => goal.id !== id);
        if (method === "POST") return [...current, saved!];
        return current.map((goal) => goal.id === id ? saved! : goal);
      });
      await queryClient.invalidateQueries({ queryKey: ["learning-goals"] });
    } finally {
      mutationLock.current = false;
      setPending(false);
    }
  };

  const saveGoal = async (input: LearningGoalInput) => {
    if (!dialog || dialog.kind === "delete") return;
    await mutateGoal(dialog.kind === "create" ? "POST" : "PATCH", dialog.kind === "edit" ? dialog.goal.id : undefined, input);
    setSearchQuery("");
    setDialog(null);
    showToast(dialog.kind === "create" ? "계획을 추가했습니다." : "계획을 수정했습니다.");
  };

  const removeGoal = async () => {
    if (dialog?.kind !== "delete") return;
    await mutateGoal("DELETE", dialog.goal.id);
    setDialog(null);
    showToast("계획을 삭제했습니다.");
  };

  const saveProgress = async (goal: LearningGoal, progress: number) => {
    if (mutationLock.current) return;
    try {
      await mutateGoal("PATCH", goal.id, { groupName: goal.groupName, task: goal.task, skill: goal.skill, progress });
      showToast(`학습 완성도를 ${progress}%로 저장했습니다.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "학습 완성도를 저장하지 못했습니다.", "error");
    } finally {
      setProgressEdits((current) => {
        const next = { ...current };
        delete next[goal.id];
        return next;
      });
    }
  };

  return (
    <>
      <PageHeader>
        <LayoutDashboard className="size-4 text-brand-primary" />
        <span className="text-[14px] font-bold tracking-tight text-text-primary">Bulkup Raptor 기획 노트</span>
      </PageHeader>

      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-surface-muted">
        <div className="w-full min-w-0 space-y-4 p-4 sm:p-5">
          <section
            aria-labelledby="home-intro-title"
            className="flex items-center gap-4 sm:gap-5 rounded-xl border border-brand-border/70 bg-surface-raised p-4 sm:p-5 shadow-xs"
          >
            <div
              className="relative flex shrink-0 items-center justify-center rounded-xl border border-brand-border/40 bg-brand-glass/60 p-2"
              style={{ width: 88, height: 88, minWidth: 88, minHeight: 88 }}
            >
              <Image
                src="/tikitaka-mascot.png"
                alt="Bulkup Raptor 프로젝트 기획 노트"
                width={1254}
                height={1254}
                priority
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </div>
            <div className="min-w-0 flex-1 break-keep">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-border/40 bg-brand-glass px-2 py-0.2 text-[10.5px] font-black text-brand-primary tracking-wide mb-1">
                <span>BULKUP RAPTOR NOTE</span>
                <span className="opacity-40">·</span>
                <span>쇼핑몰 기획 & 개발 노트</span>
              </div>
              <h1
                id="home-intro-title"
                className="text-[19px] sm:text-[21px] font-black leading-snug tracking-tight text-text-primary"
              >
                쇼핑몰의 다음 단계를 이어가는 노트
              </h1>
              <p className="mt-1 text-[13px] leading-5 text-text-secondary">
                쇼핑몰 기획과 구현 과정을 기록하고, Agent와 함께 의사결정과 지식을 체계화합니다.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {["쇼핑몰 기획", "상품·주문", "사용자 경험", "SEO·콘텐츠", "출시 준비"].map((tag) => (
                  <span
                    key={tag}
                    className="rounded-md border border-surface-border-soft bg-surface-muted px-2 py-0.5 text-[10.5px] font-bold text-text-muted"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setDocumentationMethodologyOpen(true)} className="ui-icon-button h-9 shrink-0 gap-1.5 self-start px-3 text-[11px] font-black text-brand-primary sm:self-center" title="기획 방법론">
              <BookOpen className="size-3.5" /> 기획 방법론
            </button>
          </section>

          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <nav className="flex items-center gap-1" aria-label="홈 콘텐츠">
                <button type="button" onClick={() => setActiveTab("goals")} className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition-all ${activeTab === "goals" ? "bg-brand-primary text-text-on-brand shadow-sm" : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"}`}>
                  <GraduationCap className="size-3.5" /> 현재 계획
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-black ${activeTab === "goals" ? "bg-white/20" : "bg-surface-raised text-text-muted"}`}>{learningGoals.length}</span>
                </button>
                <button type="button" onClick={() => setActiveTab("news")} className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[12.5px] font-bold transition-all ${activeTab === "news" ? "bg-brand-primary text-text-on-brand shadow-sm" : "text-text-secondary hover:bg-surface-raised hover:text-text-primary"}`}>
                  <Newspaper className="size-3.5" /> 뉴스
                </button>
              </nav>

              {activeTab === "goals" && <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                <label className="relative min-w-0 flex-1 sm:w-64">
                  <span className="sr-only">현재 계획 검색</span>
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
                  <input type="search" placeholder="과제명, 스킬 검색..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-8 w-full rounded-lg border border-surface-border bg-surface-raised pl-8 pr-3 text-[11.5px] text-text-primary placeholder:text-text-muted focus:border-brand-border focus:outline-none focus:ring-1 focus:ring-brand-border" />
                </label>
                <Button ref={addButton} size="sm" disabled={pending || goalsQuery.isLoading || goalsQuery.isError} onClick={(event) => openDialog({ kind: "create" }, event.currentTarget)}><Plus className="size-4" />새 계획</Button>
              </div>}
            </div>

            {activeTab === "goals" && (
              <section className="space-y-2" aria-label="현재 계획">
              <h2 className="sr-only">현재 계획</h2>
              {searchQuery.trim() && <p role="status" className="text-[11px] text-text-muted">검색 결과 {filteredGoals.length}개</p>}
              {goalsQuery.isError && <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm text-destructive"><span>계획을 불러오지 못했습니다. 다시 시도해 주세요.</span><Button size="sm" variant="secondary" onClick={() => void goalsQuery.refetch()}>다시 시도</Button></div>}
              <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-raised shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse break-keep text-left text-[12px]">
                    <thead className="bg-surface-muted text-[11px] font-bold uppercase text-text-secondary">
                      <tr>
                        <th className="w-14 px-3 py-2 text-center">No</th>
                        <th className="w-28 px-3 py-2">분류</th>
                        <th className="px-3 py-2">과제명</th>
                        <th className="px-3 py-2">핵심 스킬</th>
                        <th className="w-60 px-3 py-2">학습 완성도</th>
                        <th className="w-24 px-3 py-2 text-center">관리</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-border-soft">
                      {filteredGoals.map((goal) => {
                        const progress = progressEdits[goal.id] ?? goal.progress;
                        return (
                          <tr key={goal.id} className="transition-colors hover:bg-brand-glass/25">
                            <td className="px-3 py-2 text-center font-black tabular-nums text-text-muted">{String(goal.orderIdx + 1).padStart(2, "0")}</td>
                            <td className="px-3 py-2"><span className="inline-block rounded border border-surface-border bg-surface-muted px-1.5 py-0.5 text-[10.5px] font-bold text-text-secondary">{goal.groupName}</span></td>
                            <td className="px-3 py-2 font-bold text-text-primary"><span className={progress === 100 ? "text-text-muted line-through" : undefined}>{goal.task}</span>{progress === 100 && <span className="ml-2 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">완료</span>}</td>
                            <td className="px-3 py-2"><span className="inline-block rounded bg-brand-glass px-1.5 py-0.5 text-[10.5px] font-semibold text-brand-primary">{goal.skill}</span></td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2.5">
                                <input type="range" min="0" max="100" step="5" disabled={pending} value={progress} onChange={(event) => setProgressEdits((current) => ({ ...current, [goal.id]: Number(event.target.value) }))} onPointerUp={(event) => void saveProgress(goal, Number(event.currentTarget.value))} onKeyUp={(event) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(event.key)) void saveProgress(goal, Number(event.currentTarget.value)); }} aria-label={`${goal.task} 학습 완성도`} className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[var(--primary)] disabled:opacity-50" />
                                <span className="w-9 text-right text-[11px] font-black tabular-nums text-brand-primary">{progress}%</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex justify-center gap-1">
                                <Button variant="ghost" size="sm-icon" disabled={pending} aria-label={`${goal.task} 수정`} onClick={(event) => openDialog({ kind: "edit", goal }, event.currentTarget)}><Pencil className="size-3.5" /></Button>
                                <Button variant="ghost" size="sm-icon" tone="danger" disabled={pending} aria-label={`${goal.task} 삭제`} onClick={(event) => openDialog({ kind: "delete", goal }, event.currentTarget)}><Trash2 className="size-3.5" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {goalsQuery.isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-[12px] text-text-muted">현재 계획을 불러오는 중…</td></tr>}
                      {!goalsQuery.isLoading && !goalsQuery.isError && filteredGoals.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-[12px] text-text-muted">{learningGoals.length === 0 ? "아직 등록된 계획이 없습니다. 새 계획을 추가해 보세요." : "일치하는 실습 과제가 없습니다."}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              </section>
            )}

            {activeTab === "news" && (
              <section aria-label="개발 뉴스와 참고 자료">
              <h2 className="sr-only">뉴스</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {BOOKMARKS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <a key={item.name} href={item.href} target="_blank" rel="noreferrer" className="group flex items-center justify-between rounded-xl border border-surface-border bg-surface-raised p-4 shadow-sm transition hover:border-brand-border hover:bg-brand-glass/25">
                      <span className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-lg bg-brand-glass text-brand-primary"><Icon className="size-4" /></span>
                        <span><strong className="block text-[13px] text-text-primary">{item.name}</strong><span className="mt-0.5 block text-[11px] text-text-muted">{item.description}</span></span>
                      </span>
                      <ArrowUpRight className="size-4 text-text-muted transition group-hover:text-brand-primary" />
                    </a>
                  );
                })}
              </div>
              </section>
            )}
          </div>
        </div>
      </main>
      {documentationMethodologyOpen && <DocumentationMethodologyDialog onClose={() => setDocumentationMethodologyOpen(false)} />}
      {dialog && <LearningGoalDialog
        key={dialog.kind === "create" ? "create" : `${dialog.kind}:${dialog.goal.id}`}
        state={dialog}
        groups={goalGroups}
        pending={pending}
        onSave={saveGoal}
        onDelete={removeGoal}
        onClose={() => setDialog(null)}
        onRestoreFocus={() => (dialogOpener.current?.isConnected ? dialogOpener.current : addButton.current)?.focus()}
      />}
    </>
  );
}
