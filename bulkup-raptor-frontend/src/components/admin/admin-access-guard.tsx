"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { canAccessAdmin } from "@/entities/session";
import { currentMember } from "@/lib/api";

export function AdminAccessGuard({ children }: { children: ReactNode }) {
  const session = useQuery({
    queryKey: ["me"],
    queryFn: currentMember,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 15_000,
    retry: false,
  });

  // 관리자 진입 시에는 이전 화면에 남은 캐시 대신 새 계정 조회 결과를 확인한다.
  if (session.isPending || (!session.isFetchedAfterMount && session.isFetching)) {
    return <main role="status" className="px-6 py-16 text-sm text-zinc-500">계정 확인 중입니다.</main>;
  }
  if (session.isError) {
    return <main role="alert" className="px-6 py-16 text-sm text-rose-700">
      계정 정보를 불러오지 못했습니다. 서버 연결을 확인해 주세요.{" "}
      <button type="button" onClick={() => void session.refetch()} className="underline">다시 시도</button>
    </main>;
  }
  if (!session.data) redirect("/login");
  if (!canAccessAdmin(session.data)) {
    return <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-bold">관리 권한이 필요해요</h1>
      <p className="mt-2 text-sm text-zinc-500">관리자 페이지 접근 권한이 없습니다.</p>
      <Link href="/" className="mt-6 inline-block text-sm font-semibold underline">상점으로 돌아가기</Link>
    </main>;
  }

  return children;
}
