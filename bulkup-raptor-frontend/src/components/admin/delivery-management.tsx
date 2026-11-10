"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { currentMember } from "@/lib/api";
import { canAccessAdmin } from "@/entities/session";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { AdminDeliveryDetail } from "@/components/admin/admin-delivery-detail";
import { Select } from "@/components/ui/select";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";
import { useAdminDeliveries, useDeliveryCounts } from "@/entities/delivery/model/use-deliveries";
import { deliveryKeys, deliveryLabels, deliveryStatuses, type DeliveryStatus } from "@/entities/delivery/model/delivery-types";
import { DeliveryError, DeliveryStatusBadge, deliveryTime } from "@/entities/delivery/ui/delivery-details";

const descriptions = {
  PREPARING: "결제가 완료된 주문의 상품과 수령 정보를 확인합니다.",
  OUT_FOR_DELIVERY: "캠프로 이동 중인 주문과 전달할 상품을 확인합니다.",
  DELIVERED: "직원에게 전달을 완료한 주문을 확인합니다.",
};
export function DeliveryManagement() {
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember, refetchInterval: 15_000, refetchOnWindowFocus: true });
  if (session.isPending) return <main role="status" className="p-12 text-sm text-zinc-500">계정 확인 중입니다.</main>;
  if (session.isError) return <main role="alert" className="p-12 text-sm text-rose-700">계정 정보를 불러오지 못했습니다. <button type="button" onClick={() => void session.refetch()} className="underline">다시 시도</button></main>;
  if (!canAccessAdmin(session.data) || !session.data) return <main className="p-12"><h1 className="text-xl font-bold">관리 권한이 필요해요</h1><p className="mt-2 text-sm text-zinc-500">배송 관리에 접근할 권한이 없습니다.</p></main>;
  return <MemberDeliveries key={session.data.id} memberId={session.data.id} />;
}
function MemberDeliveries({ memberId }: { memberId: number }) {
  const client = useQueryClient();
  const [status, setStatus] = useState<DeliveryStatus>("PREPARING");
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [selected, setSelected] = useState<number | null>(null);
  const query = useAdminDeliveries(memberId, { status, search, page, size });
  const counts = useDeliveryCounts(memberId);
  const data = query.data;
  const visible = !query.isPending && !query.isError && data;
  const selectStatus = (next: DeliveryStatus) => { setStatus(next); setPage(0); };
  const refresh = () => void client.invalidateQueries({ queryKey: deliveryKeys.member(memberId) });

  return <div className="flex min-h-screen w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
    <AdminNavigation activeTab="deliveries" />
    <main className="min-w-0 flex-1 space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="mb-2 text-xs font-semibold tracking-wider text-emerald-700">배송 운영</p><h1 className="text-2xl font-bold text-zinc-950">배송 관리</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-500">쿠팡 캠프에서 근무하는 직원·헬퍼의 주문을 준비하고 전달합니다.</p></div>
        <button type="button" onClick={refresh} disabled={query.isFetching || counts.isFetching} className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 disabled:opacity-40">새로고침</button>
      </header>
      <div className="grid gap-3 sm:grid-cols-3" aria-label="전체 배송 현황">
        {deliveryStatuses.map((item, index) => <button type="button" key={item} onClick={() => selectStatus(item)} aria-pressed={status === item}
          className={`rounded-2xl border bg-white p-5 text-left transition focus-visible:outline-2 focus-visible:outline-emerald-600 ${status === item ? "border-emerald-300 ring-1 ring-emerald-100" : "border-zinc-200 hover:border-zinc-300"}`}>
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-zinc-600">{deliveryLabels[item]}</p><span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-50 text-xs font-semibold text-zinc-400">0{index + 1}</span></div>
          <p className="mt-4 text-3xl font-semibold tabular-nums text-zinc-950">{counts.isPending || counts.isError ? "—" : counts.data[item].toLocaleString("ko-KR")}<span className="ml-1 text-sm font-normal text-zinc-400">건</span></p>
          <p className="mt-2 text-xs text-zinc-400">{["상품 준비와 수령 정보 확인", "배송 시작 후 전달 진행", "전달 내역 확인"][index]}</p>
        </button>)}
      </div>
      {counts.isError && <p role="alert" className="text-xs text-rose-700">전체 배송 건수를 불러오지 못했습니다. <button onClick={() => void counts.refetch()} className="underline">다시 조회</button></p>}
      <section aria-label="배송 목록" className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
        <nav aria-label="배송 상태" className="flex gap-5 overflow-x-auto border-b border-zinc-200 px-5 sm:gap-8 sm:px-6">
          {deliveryStatuses.map(item => <button key={item} type="button" aria-pressed={status === item} onClick={() => selectStatus(item)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-1 py-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-emerald-600 ${status === item ? "border-emerald-600 text-emerald-700" : "border-transparent text-zinc-500 hover:text-zinc-950"}`}>
            {deliveryLabels[item]}
            <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${status === item ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
              {counts.isPending || counts.isError ? "—" : counts.data[item].toLocaleString("ko-KR")}<span className="sr-only">건</span>
            </span>
          </button>)}
        </nav>
        <div className="space-y-4 border-b border-zinc-100 p-5 sm:p-6">
          <p className="text-sm text-zinc-600">{descriptions[status]}</p>
          <SearchFilterBar label="주문 번호 또는 수령인 검색" placeholder="주문 번호 전체 또는 수령인 이름" value={draft} onValueChange={setDraft} variant="inline"
            busy={query.isFetching} isDirty={draft.trim() !== search}
            onSearch={() => { if (page === 0 && draft.trim() === search) void query.refetch(); setSearch(draft.trim()); setPage(0); }}
            onReset={() => { setDraft(""); setSearch(""); setPage(0); }} />
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400"><span>오래된 배송부터 표시 · 시각은 한국 시간 기준</span>
            <div className="flex items-center gap-2"><span>페이지당</span><div className="w-24"><Select aria-label="페이지당 배송 수" value={String(size)} onChange={value => { setSize(Number(value)); setPage(0); }} options={[10, 20, 50].map(n => ({ value: String(n), label: `${n}건` }))} /></div></div>
          </div>
        </div>
        <div aria-busy={query.isFetching}>
          {query.isPending ? <p role="status" className="p-16 text-center text-sm text-zinc-500">배송 목록을 불러오는 중입니다.</p>
            : query.isError ? <div className="p-6"><DeliveryError error={query.error} onRetry={() => void query.refetch()} /></div>
              : visible && data.content.length === 0 ? <div className="px-6 py-16 text-center"><p className="font-semibold text-zinc-800">{search ? "검색 조건에 맞는 배송이 없습니다." : `${deliveryLabels[status]}인 주문이 없습니다.`}</p><p className="mt-2 text-sm text-zinc-500">결제가 확인된 주문의 배송 정보가 자동으로 표시됩니다.</p></div>
                : visible && <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><caption className="sr-only">{deliveryLabels[status]} 주문 목록</caption>
                  <thead className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500"><tr>{["주문 번호", "수령인", "상품 · 수량", "배송 생성", "배송 상태", "상세"].map(label => <th key={label} scope="col" className="whitespace-nowrap px-5 py-3.5 font-medium">{label}</th>)}</tr></thead>
                  <tbody className="divide-y divide-zinc-100">{data.content.map(item => <tr key={item.deliveryId} className="hover:bg-zinc-50">
                    <td className="px-5 py-4 font-mono font-semibold text-zinc-800">#{item.orderId}</td><td className="px-5 py-4 text-zinc-800">{item.recipientName}</td>
                    <td className="max-w-64 px-5 py-4"><p className="truncate font-medium text-zinc-700">{item.items[0]?.productName ?? "상품 없음"}{item.items.length > 1 && ` 외 ${item.items.length - 1}종`}</p><p className="mt-1 text-xs text-zinc-400">총 {item.items.reduce((n, product) => n + product.quantity, 0)}개</p></td>
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-zinc-500">{deliveryTime(item.createdAt)}</td><td className="px-5 py-4"><DeliveryStatusBadge status={item.status} /></td>
                    <td className="px-5 py-4"><button type="button" onClick={() => setSelected(item.deliveryId)} aria-label={`주문 ${item.orderId} 배송 상세`} className="whitespace-nowrap rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-600 hover:border-emerald-600 hover:text-emerald-700">상세 보기 →</button></td>
                  </tr>)}</tbody>
                </table></div>}
        </div>
        {visible && <nav aria-label="배송 목록 페이지 이동" className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4 text-sm">
          <p className="text-zinc-500">검색 결과 {data.totalElements}건</p><div className="flex items-center gap-3"><button type="button" disabled={data.page === 0 || query.isFetching} onClick={() => setPage(data.page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">이전</button><span>{data.totalPages === 0 ? 0 : data.page + 1} / {data.totalPages} 페이지</span><button type="button" disabled={data.page + 1 >= data.totalPages || query.isFetching} onClick={() => setPage(data.page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">다음</button></div>
        </nav>}
      </section>
      {selected !== null && <AdminDeliveryDetail key={selected} memberId={memberId} deliveryId={selected} onClose={() => setSelected(null)} />}
    </main>
  </div>;
}
