"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { currentMember } from "@/lib/api";
import { Header } from "@/widgets/header/ui/header";
import { ProfileTabs } from "@/views/profile";

export default function ProfilePage() {
  const member = useQuery({ queryKey: ["me"], queryFn: currentMember, refetchOnWindowFocus: "always" });
  const account = member.data;

  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:px-8 sm:py-10">
        <p className="text-xs font-semibold tracking-[0.16em] text-emerald-700">MY ACCOUNT</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950">내 정보</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">계정과 기본 배송지, 사용할 수 있는 기능을 관리하세요.</p>

        {member.isLoading ? (
          <div role="status" aria-label="프로필 불러오는 중" className="mt-8 grid animate-pulse gap-6">
            <div className="h-72 rounded-2xl border border-zinc-200 bg-white" />
            <div className="h-72 rounded-2xl border border-zinc-200 bg-white" />
            <span className="sr-only">프로필을 불러오고 있어요.</span>
          </div>
        ) : member.isError ? (
          <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="font-bold text-zinc-950">프로필을 불러오지 못했어요</h2>
            <p role="alert" className="mt-2 text-sm text-zinc-500">잠시 후 다시 시도해 주세요.</p>
            <button type="button" onClick={() => member.refetch()} className="mt-5 cursor-pointer rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold">다시 시도</button>
          </section>
        ) : account ? (
          <ProfileTabs key={account.id} account={account} />
        ) : (
          <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-xs">
            <h2 className="text-base font-bold text-zinc-950">로그인이 필요해요</h2>
            <p className="mt-2 text-sm text-zinc-500">프로필은 로그인한 회원만 볼 수 있어요.</p>
            <Link href="/login" className="mt-5 inline-flex h-10 items-center rounded-lg bg-zinc-950 px-4 text-sm font-bold text-white transition hover:bg-zinc-800">로그인</Link>
          </section>
        )}
      </main>
    </>
  );
}
