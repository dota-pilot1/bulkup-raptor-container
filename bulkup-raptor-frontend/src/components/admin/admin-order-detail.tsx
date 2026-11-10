"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { currentMember } from "@/lib/api";
import { canAccessAdmin, hasPermission } from "@/entities/session";
import { getAdminOrder } from "@/entities/order/api/get-admin-orders";
import { OrderDetails } from "@/entities/order/ui/order-details";
import { deliveryLabels } from "@/entities/delivery/model/delivery-types";
import { CancelOrderButton } from "@/features/cancel-order";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { Badge } from "@/components/ui/badge";
import { ApiError } from "@/shared/api/client";

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "—";

export function AdminOrderDetail({ orderId }: { orderId: number }) {
  const session = useQuery({ queryKey: ["me"], queryFn: currentMember, refetchInterval: 15_000, refetchOnWindowFocus: true });
  const allowed = canAccessAdmin(session.data);
  const validId = Number.isSafeInteger(orderId) && orderId > 0;
  const detail = useQuery({
    queryKey: ["admin-order", session.data?.id, orderId],
    queryFn: ({ signal }) => getAdminOrder(orderId, signal),
    enabled: allowed && validId,
    retry: false,
  });
  if (session.isPending) return <main className="px-6 py-16 text-sm text-zinc-500">계정 확인 중입니다.</main>;
  if (session.isError) return <main role="alert" className="px-6 py-16 text-sm text-rose-700">계정 정보를 불러오지 못했습니다. <button type="button" onClick={() => void session.refetch()} className="underline">다시 시도</button></main>;
  if (!allowed) return <main className="mx-auto max-w-3xl px-6 py-16"><h1 className="text-2xl font-bold">관리 권한이 필요해요</h1><Link href="/" className="mt-6 inline-block text-sm underline">상점으로 돌아가기</Link></main>;
  const data = !detail.isError ? detail.data : undefined;

  return <div className="flex min-h-screen w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:flex-row lg:items-start">
    <AdminNavigation activeTab="orders" />
    <main className="min-w-0 flex-1 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/orders" className="text-sm font-semibold text-zinc-600 hover:underline">← 주문 목록</Link>
        {validId && <button type="button" disabled={detail.isFetching} onClick={() => void detail.refetch()} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40">새로고침</button>}
      </div>
      {!validId || (detail.error instanceof ApiError && detail.error.status === 404)
        ? <p role="alert" className="rounded-2xl border bg-white p-10 text-center text-sm">주문을 찾을 수 없습니다.</p>
        : detail.isError
          ? <p role="alert" className="rounded-2xl bg-rose-50 p-10 text-center text-sm text-rose-700">주문 정보를 불러오지 못했습니다. 새로고침으로 다시 시도해 주세요.</p>
          : detail.isPending && <p role="status" className="p-12 text-center text-sm text-zinc-500">주문 정보를 불러오는 중입니다.</p>}
      {data && <>
        <section className="rounded-2xl border border-zinc-200 bg-white px-6 py-4">
          <h2 className="text-sm font-bold text-zinc-900">주문자</h2>
          <p className="mt-2 text-sm">{data.buyer.name} <span className="text-zinc-500">· {data.buyer.email} · 회원 #{data.buyer.memberId}</span></p>
          <p className="mt-2 text-xs text-zinc-500">주문 시각 {formatDate(data.order.createdAt)} · 한국 시간 기준</p>
          <p className="mt-3 text-sm">배송 상태 <Badge className="ml-2" variant={data.order.deliveryStatus === "DELIVERED" ? "success" : data.order.deliveryStatus === "PREPARING" ? "warning" : data.order.deliveryStatus ? "default" : "secondary"}>{data.order.deliveryStatus ? deliveryLabels[data.order.deliveryStatus] : "—"}</Badge></p>
        </section>
        <OrderDetails order={data.order} paymentAction={hasPermission(session.data, "ORDER_MANAGE")
          ? <CancelOrderButton order={data.order} memberId={session.data!.id} admin />
          : undefined} />
        <section className="rounded-2xl border border-zinc-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">결제 내역</h2>
            {data.payment && <Link href={`/admin/payments?search=${encodeURIComponent(data.payment.paymentId)}`} className="text-sm font-semibold text-emerald-700 underline underline-offset-4">결제 관리에서 보기</Link>}
          </div>
          {data.payment ? <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
            <div className="sm:col-span-2 xl:col-span-3"><dt className="text-zinc-500">결제 ID</dt><dd className="mt-1 break-all font-mono text-xs">{data.payment.paymentId}</dd></div>
            <div><dt className="text-zinc-500">결제 상태</dt><dd className="mt-1"><Badge variant={data.payment.status === "PAID" ? "success" : "warning"}>{data.payment.status === "CANCELLED" ? "결제 취소" : data.payment.status === "PAID" ? "결제 완료" : data.payment.status === "RETIRED" ? "종료된 시도" : "결제 준비"}</Badge></dd></div>
            <div><dt className="text-zinc-500">결제 금액</dt><dd className="mt-1 font-semibold">{data.payment.totalAmount.toLocaleString("ko-KR")} {data.payment.currency}</dd></div>
            <div><dt className="text-zinc-500">결제 수단</dt><dd className="mt-1">{data.payment.paymentMethod ?? "미확정"}</dd></div>
            <div><dt className="text-zinc-500">결제 준비 시각</dt><dd className="mt-1">{formatDate(data.payment.createdAt)}</dd></div>
            <div><dt className="text-zinc-500">결제 시각</dt><dd className="mt-1">{formatDate(data.payment.paidAt)}</dd></div>
            <div><dt className="text-zinc-500">웹훅 검증 시각</dt><dd className="mt-1">{data.payment.webhookVerifiedAt ? formatDate(data.payment.webhookVerifiedAt) : "미확인"}</dd></div>
          </dl> : <p className="mt-4 text-sm text-zinc-500">아직 결제가 준비되지 않은 주문입니다.</p>}
        </section>
      </>}
    </main>
  </div>;
}
