"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/widgets/header/ui/header";
import { currentMember } from "@/lib/api";
import type { OrderFilter } from "@/entities/order/model/order-types";
import { useOrderCounts, useOrders } from "@/entities/order/model/use-orders";
import { OrderHistory } from "@/entities/order/ui/order-history";
import { OrderDeliveryButton } from "@/features/view-delivery/ui/order-delivery-button";
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

const tabs: { status: OrderFilter; label: string; empty?: string }[] = [
  { status: "CREATED", label: "결제 대기", empty: "결제 대기 중인 주문이 없습니다." },
  { status: "PAID", label: "결제 완료", empty: "결제 완료한 주문이 없습니다." },
  { status: "CANCELLED", label: "주문 취소", empty: "취소한 주문이 없습니다." },
  { status: "ALL", label: "전체" },
];

function MemberOrders({ memberId }: { memberId: number }) {
  const [{ page, status }, setFilter] = useState<{ page: number; status: OrderFilter }>({ page: 0, status: "CREATED" });
  const orders = useOrders(memberId, page, status);
  const counts = useOrderCounts(memberId, orders.data?.content.some(order => order.cancellationPending));
  const selected = tabs.find(tab => tab.status === status)!;
  function select(status: OrderFilter) { setFilter({ status, page: 0 }); }
  function moveTab(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % tabs.length; break;
      case "ArrowLeft": next = (index + tabs.length - 1) % tabs.length; break;
      case "Home": next = 0; break;
      case "End": next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    select(tabs[next].status);
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  }
  if ((orders.error instanceof ApiError && orders.error.status === 401) || (counts.error instanceof ApiError && counts.error.status === 401)) return <LoginMessage />;

  function content() {
    if (orders.isPending) return <Message>주문 내역을 불러오고 있습니다.</Message>;
    if (orders.isError) return <Message error>주문 내역을 불러오지 못했습니다.<button onClick={() => void orders.refetch()} className="ml-3 font-bold underline">다시 시도</button></Message>;
    const data = orders.data;
    return <>
      <div className="mb-3 flex items-center justify-between text-xs text-zinc-400"><p>총 <strong className="font-semibold tabular-nums text-zinc-700">{data.totalElements.toLocaleString("ko-KR")}</strong>건</p><span>최근 주문순</span></div>
      <OrderHistory orders={data.content} emptyMessage={selected.empty}
        renderDelivery={order => <OrderDeliveryButton key={`${memberId}:${order.orderId}`} memberId={memberId} orderId={order.orderId} />} />
      {data.totalPages > 1 && <nav aria-label="주문 내역 페이지" className="mt-8 flex items-center justify-center gap-5">
        <button type="button" disabled={page === 0 || orders.isFetching} onClick={() => setFilter(value => ({ ...value, page: value.page - 1 }))} className="cursor-pointer rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">이전</button>
        <span aria-live="polite" className="text-sm text-zinc-600">{page + 1} / {data.totalPages}</span>
        <button type="button" disabled={page + 1 >= data.totalPages || orders.isFetching} onClick={() => setFilter(value => ({ ...value, page: value.page + 1 }))} className="cursor-pointer rounded-xl border border-zinc-200 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40">다음</button>
      </nav>}
    </>;
  }
  return <>
    <div role="tablist" aria-label="주문 상태" className="mb-5 flex gap-1 overflow-x-auto border-b border-zinc-200">
      {tabs.map((tab, index) => <button key={tab.status} type="button" role="tab"
        id={`orders-tab-${tab.status}`} aria-selected={status === tab.status} aria-controls="orders-panel"
        tabIndex={status === tab.status ? 0 : -1} onClick={() => select(tab.status)} onKeyDown={event => moveTab(event, index)}
        className={`shrink-0 cursor-pointer border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600 ${status === tab.status ? "border-emerald-700 text-emerald-700" : "border-transparent text-zinc-500 hover:text-zinc-950"}`}>
        {tab.label}
        <span title={counts.isError ? "주문 수를 불러오지 못했습니다." : undefined}
          className={`ml-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-xs tabular-nums ${status === tab.status ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
          {counts.data?.[tab.status]?.toLocaleString("ko-KR") ?? "—"}
        </span><span className="sr-only">건</span>
      </button>)}
    </div>
    <section id="orders-panel" role="tabpanel" aria-labelledby={`orders-tab-${status}`} tabIndex={0}>
      {content()}
    </section>
  </>;
}
function Message({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <div role={error ? "alert" : "status"} className="rounded-2xl border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-600">{children}</div>;
}
function LoginMessage() {
  return <Message>로그인 후 주문 내역을 확인할 수 있습니다.<Link href="/login" className="ml-3 font-bold text-emerald-700 underline">로그인</Link></Message>;
}
