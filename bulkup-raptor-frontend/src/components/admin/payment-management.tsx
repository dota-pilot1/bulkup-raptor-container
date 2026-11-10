"use client";

import Link from "next/link";
import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { currentMember } from "@/lib/api";
import { canAccessAdmin } from "@/entities/session";
import { getAdminPayments, type AdminPaymentFilters } from "@/entities/payment/api/get-admin-payments";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { SearchFilterBar } from "@/components/ui/search-filter-bar";

const emptyFilters: AdminPaymentFilters = { search: "", status: "ALL", webhookVerified: "ALL" };
const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "—";

export function PaymentManagement({ initialSearch = "" }: { initialSearch?: string }) {
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const allowed = canAccessAdmin(session.data);
  const [draft, setDraft] = useState<AdminPaymentFilters>({ ...emptyFilters, search: initialSearch });
  const [filters, setFilters] = useState<AdminPaymentFilters>({ ...emptyFilters, search: initialSearch });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const payments = useQuery({
    queryKey: ["admin-payments", session.data?.id, page, size, filters],
    queryFn: () => getAdminPayments({ ...filters, page, size }),
    placeholderData: keepPreviousData,
    enabled: allowed,
  });
  const data = payments.data;
  const showing = data && !payments.isPlaceholderData && !payments.isError;
  const busy = payments.isFetching;

  if (session.isPending) return <main className="px-6 py-16 text-sm text-zinc-500">계정 확인 중입니다.</main>;
  if (session.isError) return <main role="alert" className="px-6 py-16 text-sm text-rose-700">계정 정보를 불러오지 못했습니다. <button type="button" onClick={() => void session.refetch()} className="underline">다시 시도</button></main>;
  if (!allowed) return <main className="mx-auto max-w-3xl px-6 py-16">
    <h1 className="text-2xl font-bold">관리 권한이 필요해요</h1>
    <p className="mt-2 text-sm text-zinc-500">관리자 페이지 접근 권한이 없습니다.</p>
    <Link href="/" className="mt-6 inline-block text-sm underline">상점으로 돌아가기</Link>
  </main>;

  return <div className="flex min-h-screen w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
    <AdminNavigation activeTab="payments" />
    <main className="min-w-0 flex-1 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-950">결제 목록</h1>
          <p className="mt-2 text-sm text-zinc-500">저장된 결제 내역을 최신 준비 순으로 조회합니다. 시각은 한국 시간 기준입니다.</p>
        </div>
        <button type="button" disabled={busy} onClick={() => void payments.refetch()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">새로고침</button>
      </div>
      <SearchFilterBar label="주문 번호 또는 결제 ID 검색" placeholder="주문 번호 전체 또는 결제 ID 일부"
        value={draft.search} onValueChange={(search) => setDraft({ ...draft, search })} busy={busy}
        isDirty={draft.search.trim() !== filters.search || draft.status !== filters.status || draft.webhookVerified !== filters.webhookVerified}
        onSearch={() => {
          const next = { ...draft, search: draft.search.trim() };
          if (page === 0 && JSON.stringify(next) === JSON.stringify(filters)) void payments.refetch();
          setFilters(next); setPage(0);
        }}
        onReset={() => { setDraft(emptyFilters); setFilters(emptyFilters); setPage(0); }}>
        <div className="w-full lg:w-44">
          <Select aria-label="결제 상태 필터" value={draft.status}
            onChange={(status) => setDraft({ ...draft, status: status as AdminPaymentFilters["status"] })}
            options={[{ value: "ALL", label: "전체 결제 상태" }, { value: "CANCELLED", label: "결제 취소" }, { value: "READY", label: "결제 준비 (READY)" }, { value: "PAID", label: "결제 완료 (PAID)" }, { value: "RETIRED", label: "종료된 시도 (RETIRED)" }]} />
        </div>
        <div className="w-full lg:w-48">
          <Select aria-label="웹훅 검증 필터" value={draft.webhookVerified}
            onChange={(webhookVerified) => setDraft({ ...draft, webhookVerified: webhookVerified as AdminPaymentFilters["webhookVerified"] })}
            options={[{ value: "ALL", label: "전체 웹훅 검증 여부" }, { value: "true", label: "웹훅 검증 완료" }, { value: "false", label: "웹훅 검증 미확인" }]} />
        </div>
      </SearchFilterBar>
      <div className="flex items-center justify-end gap-3 text-sm text-zinc-500">
        <span>페이지당 결제 수</span>
        <div className="w-28"><Select aria-label="페이지당 결제 수" value={String(size)}
          onChange={(value) => { setSize(Number(value)); setPage(0); }}
          options={[10, 20, 50].map(value => ({ value: String(value), label: `${value}건` }))} /></div>
      </div>
      <div aria-busy={busy} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
        {(payments.isPending || payments.isPlaceholderData) && !payments.isError && <p role="status" className="p-12 text-center text-sm text-zinc-500">결제 목록을 불러오는 중입니다.</p>}
        {payments.isError && <p role="alert" className="p-8 text-center text-sm text-rose-700">결제 목록을 불러오지 못했습니다. <button type="button" onClick={() => void payments.refetch()} className="underline">다시 시도</button></p>}
        {showing && data.content.length === 0 && <p className="p-12 text-center text-sm text-zinc-500">조건에 일치하는 결제가 없습니다.</p>}
        {showing && data.content.length > 0 && <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm text-zinc-600">
            <caption className="sr-only">관리자 결제 내역</caption>
            <thead className="whitespace-nowrap border-b border-zinc-200 bg-zinc-50 text-xs text-zinc-700"><tr>
              {["주문 번호", "결제 ID", "금액", "결제 수단", "결제 상태", "결제 준비 시각", "결제 시각", "웹훅 검증 시각"].map(label => <th key={label} scope="col" className="px-4 py-3.5">{label}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-zinc-100">{data.content.map(payment => <tr key={payment.paymentId} className="hover:bg-zinc-50">
              <td className="px-4 py-4"><Link href={`/admin/orders/${payment.orderId}`} aria-label={`주문 ${payment.orderId} 상세 보기`} className="font-mono font-semibold text-emerald-700 underline underline-offset-4">{payment.orderId}</Link></td>
              <td className="px-4 py-4 font-mono text-xs">{payment.paymentId}</td>
              <td className="whitespace-nowrap px-4 py-4 font-semibold text-zinc-900">{payment.totalAmount.toLocaleString("ko-KR")} {payment.currency}</td>
              <td className="px-4 py-4">{payment.paymentMethod ?? "미확정"}</td>
              <td className="whitespace-nowrap px-4 py-4"><Badge variant={payment.status === "PAID" ? "success" : "warning"}>{payment.status === "CANCELLED" ? "결제 취소" : payment.status === "PAID" ? "결제 완료" : payment.status === "RETIRED" ? "종료된 시도" : "결제 준비"}</Badge></td>
              <td className="whitespace-nowrap px-4 py-4 text-xs">{formatDate(payment.createdAt)}</td>
              <td className="whitespace-nowrap px-4 py-4 text-xs">{formatDate(payment.paidAt)}</td>
              <td className="whitespace-nowrap px-4 py-4 text-xs">{payment.webhookVerifiedAt ? formatDate(payment.webhookVerifiedAt) : "미확인"}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        {showing && <nav aria-label="결제 목록 페이지 이동" className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-4 text-sm">
          <p aria-live="polite" className="text-zinc-500">검색 결과 {data.totalElements}건{data.totalElements > 0 && ` · ${data.page * data.size + 1}–${data.page * data.size + data.content.length}건 표시`}</p>
          <div className="flex items-center gap-3">
            <button type="button" disabled={data.page === 0 || busy} onClick={() => setPage(data.page - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">이전</button>
            <span>{data.totalPages === 0 ? 0 : data.page + 1} / {data.totalPages} 페이지</span>
            <button type="button" disabled={data.page + 1 >= data.totalPages || busy} onClick={() => setPage(data.page + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">다음</button>
          </div>
        </nav>}
      </div>
      <p className="text-xs text-zinc-500">웹훅 검증 미확인은 검증 성공 시각이 없다는 뜻입니다. 프런트 요청으로만 검증된 결제도 포함됩니다.</p>
    </main>
  </div>;
}
