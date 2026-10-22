"use client";

import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Folder, FolderTree, Loader2, Search } from "lucide-react";
import PageHeader from "@/shared/ui/PageHeader";
import { playbookApi, type PlaybookMenuSearchResult } from "@/features/hospital-playbook/api";

const SPACE_LABELS: Record<string, string> = {
  SPRING_BOOT: "스프링 부트", SPRING_SECURITY: "스프링 시큐리티", SPRING_AI: "스프링 AI", DOMAIN_DESIGN: "도메인 설계", SPRING_API: "API 설계 및 문서화", JAVA: "자바 노트", JAVA_OOP: "OOP 실습", DB: "DB 테이블 설계", ARCHITECTURE: "아키텍처 설계", FRONTEND: "리액트 노트", FRONTEND_LIBRARY: "라이브러리 활용", FRONTEND_DOMAIN: "도메인 분석", JS_TS: "JS·TS 노트", BASIC_COMPONENTS: "기본 컴포넌트", PKT_FRONT_LEV1: "기본 화면 설계", COMPONENT_SKETCH: "컴포넌트 스케치", PRODUCT_DESIGN: "제품 설계", PROTOTYPE: "백엔드", PROTOTYPE_FRONT: "프론트", UI_CHALLENGE: "UI 챌린지", AX_BASIC: "AX 기초", AX_CHALLENGE: "AX 챌린지", TESTING: "테스팅", DEBUGGING: "디버깅", CI_CD: "CI/CD", DEPLOYMENT: "배포", MONITORING: "모니터링", INFRASTRUCTURE: "환경·인프라",
};

function ResultCard({ result }: { result: PlaybookMenuSearchResult }) {
  const moduleLabel = SPACE_LABELS[result.spaceCode];
  const targetTitle = result.kind === "topic" ? result.topicTitle : result.categoryTitle;
  const breadcrumb = result.kind === "topic"
    ? `${moduleLabel ?? result.spaceCode} > ${result.categoryTitle}`
    : moduleLabel ?? result.spaceCode;
  const openMenu = () => {
    if (!moduleLabel) return;
    window.sessionStorage.setItem("pkt-study-menu-search-target", JSON.stringify(result));
    window.location.hash = encodeURIComponent(moduleLabel);
  };
  return <button type="button" onClick={openMenu} disabled={!moduleLabel} className="group flex w-full items-center gap-3 rounded-lg border border-surface-border-soft bg-surface-raised px-4 py-3 text-left transition hover:border-brand-border hover:bg-brand-glass disabled:cursor-default">
    <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-muted text-brand-primary">{result.kind === "topic" ? <FolderTree className="size-4" /> : <Folder className="size-4" />}</span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black text-text-primary">{targetTitle}</span><span className="mt-0.5 block truncate text-[11px] font-semibold text-text-muted">{breadcrumb}</span></span>
    <ArrowUpRight className="size-4 shrink-0 text-text-muted group-hover:text-brand-primary" />
  </button>;
}

export default function SearchModule() {
  const [input, setInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const results = useQuery({ queryKey: ["playbook", "menu-search", keyword], queryFn: () => playbookApi.searchAll(keyword), enabled: keyword.length > 0, retry: false });
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setKeyword(input.trim()); };
  return <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface-muted/40"><PageHeader><Search className="size-4 text-brand-primary" /><span className="text-[14px] font-bold tracking-tight text-text-primary">메뉴 검색</span></PageHeader><section className="mx-auto flex w-full max-w-3xl min-h-0 flex-1 flex-col px-6 py-7"><div className="mb-5"><h1 className="text-xl font-black tracking-tight text-text-primary">노트 메뉴 찾기</h1><p className="mt-1 text-sm font-medium text-text-secondary">1차 메뉴와 2차 메뉴 제목에서만 찾습니다.</p></div><form onSubmit={submit} className="flex rounded-xl border border-surface-border bg-surface-raised p-1.5 shadow-sm focus-within:border-brand-border"><Search className="ml-3 size-5 shrink-0 self-center text-text-muted" /><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="예: 컴포넌트, 인증, 상태 관리" aria-label="메뉴 검색어" autoFocus className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted" /><button type="submit" className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-black text-white hover:bg-brand-primary/90">검색</button></form><div className="mt-5 min-h-0 flex-1 overflow-y-auto pb-6">{!keyword ? <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-surface-border bg-surface-raised/60 text-center"><div><FolderTree className="mx-auto size-7 text-text-muted" /><p className="mt-3 text-sm font-bold text-text-secondary">메뉴 이름으로 찾아보세요.</p></div></div> : results.isPending ? <div className="grid min-h-40 place-items-center text-text-muted"><Loader2 className="size-6 animate-spin" /></div> : results.isError ? <div className="grid min-h-40 place-items-center rounded-xl border border-destructive/20 bg-destructive/5 text-sm font-bold text-destructive">검색 중 오류가 발생했습니다.</div> : <><div className="mb-3 flex justify-between px-1 text-xs font-bold text-text-muted"><span>“{keyword}” 메뉴 검색 결과</span><span>{results.data?.length ?? 0}개</span></div>{results.data?.length ? <div className="space-y-2">{results.data.map((result) => <ResultCard key={`${result.kind}-${result.kind === "topic" ? result.topicId : result.categoryId}`} result={result} />)}</div> : <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-surface-border bg-surface-raised/60 text-sm font-bold text-text-muted">일치하는 1차·2차 메뉴가 없습니다.</div>}</>}</div></section></main>;
}
