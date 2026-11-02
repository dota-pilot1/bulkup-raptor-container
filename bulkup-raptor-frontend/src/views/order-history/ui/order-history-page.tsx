"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/widgets/header/ui/header";
import { currentMember } from "@/lib/api";
import { useOrders } from "@/entities/order/model/use-orders";
import { OrderHistory } from "@/entities/order/ui/order-history";
import { ApiError } from "@/shared/api/client";

export default function OrderHistoryPage() {
  const member = useQuery({ queryKey: ["me"], queryFn: currentMember });
  return <><Header /><main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 sm:px-8 sm:py-8">
    <div className="mb-5 flex items-center justify-between gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight text-zinc-950">주문 내역</h1>
      <Link href="/" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm">쇼핑 계속하기 <span aria-hidden="true">→</span></Link>
    </div>
    {member.isPending ? <Message>회원 정보를 확인하고 있습니다.</Message>
      : member.isError ? <Message error>회원 정보를 확인하지 못했습니다.<button onClick={() => void member.refetch()} className="ml-3 font-bold underline">다시 시도</button></Message>
      : !member.data ? <LoginMessage /> : <MemberOrders key={member.data.id} memberId={member.data.id} />}
  </main></>;
}

function MemberOrders({ memberId }: { memberId: number }) {
  const [page, setPage] = useState(0);
  const orders = useOrders(memberId, page);
  if (orders.error instanceof ApiError && orders.error.status === 401) return <LoginMessage />;
  if (orders.isPending) return <Message>주문 내역을 불러오고 있습니다.</Message>;
  if (orders.isError) return <Message error>주문 내역을 불러오지 못했습니다.<button onClick={() => void orders.refetch()} className="ml-3 font-bold underline">다시 시도</button></Message>;
  const data = orders.data;
  return <>
    {data.totalElements > 0 && <div className="mb-3 flex items-center justify-between text-xs text-zinc-400"><p>총 <strong className="font-semibold tabular-nums text-zinc-700">{data.totalElements.toLocaleString("ko-KR")}</strong>건</p><span>최근 주문순</span></div>}
    <OrderHistory orders={data.content} />
    {data.totalPages > 1 && <nav aria-label="주문 내역 페이지" className="mt-8 flex items-center justify-center gap-5">
      <button type="button" disabled={page === 0 || orders.isFetching} onClick={() => setPage(value => value - 1)} className="cursor-pointer rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">이전</button>
      <span aria-live="polite" className="text-sm text-zinc-600">{page + 1} / {data.totalPages}</span>
      <button type="button" disabled={page + 1 >= data.totalPages || orders.isFetching} onClick={() => setPage(value => value + 1)} className="cursor-pointer rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">다음</button>
    </nav>}
  </>;
}
function Message({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <div role={error ? "alert" : "status"} className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">{children}</div>;
}
function LoginMessage() {
  return <Message>로그인 후 주문 내역을 확인할 수 있습니다.<Link href="/login" className="ml-3 font-bold text-emerald-700 underline">로그인</Link></Message>;
}
